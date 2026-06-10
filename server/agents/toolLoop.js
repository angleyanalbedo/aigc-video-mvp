/**
 * Tool Loop — 统一工具调用循环
 *
 * 替代原有的 ReAct 文本解析循环 + 计划执行流程。
 * 模型在 system prompt 中看到工具描述，以 JSON 格式输出工具调用，
 * 循环执行直到模型输出最终回答。
 *
 * 因为 Ark/DashScope 不支持原生 tool_call，所以用 prompt 引导 + JSON 解析。
 */

const { llmProvider } = require('../services/providers');
const { getToolDescriptions, executeTool, getToolNames } = require('./tools/toolRegistry');

const MAX_ITERATIONS = 20;

/**
 * 格式化工具描述为 system prompt 的一部分
 */
function formatToolsPrompt(tools) {
  const lines = tools.map(t => {
    const paramsStr = JSON.stringify(t.parameters, null, 2);
    return `### ${t.name}\n${t.description}\n参数:\n\`\`\`json\n${paramsStr}\n\`\`\``;
  });
  return `## 可用工具\n\n${lines.join('\n\n')}`;
}

const TOOL_USE_INSTRUCTIONS = `## 工具调用规范

当你需要调用工具时，输出以下 JSON 格式（不要包含其他内容）：

\`\`\`tool_call
{
  "tool": "工具名称",
  "params": { ... }
}
\`\`\`

当你完成所有操作并要回复用户时，输出：

\`\`\`final_answer
你的最终回复内容
\`\`\`

**重要规则：**
- 每次只调用一个工具
- 工具调用必须用 \`\`\`tool_call 代码块包裹
- 最终回复必须用 \`\`\`final_answer 代码块包裹
- 如果不需要调用工具，直接输出 final_answer
- 先思考再行动，简要说明你的思路

**多步任务执行规范（关键）：**
- 用户的请求通常需要多步操作才能完成，不要调用一个工具就停下来！
- 每次工具调用成功后，检查用户的原始请求是否已完全满足
- 如果还有未完成的步骤，继续调用下一个工具，不要输出 final_answer
- 只有当所有步骤都执行完毕后，才输出 final_answer 汇总结果
- 例如用户说"生成剧本然后渲染所有分镜"，你需要：1) generate_script 2) generate_video(分镜1) 3) generate_video(分镜2) ... 直到所有分镜都渲染完

**执行计划示例：**
用户请求 → 先在内心列出所有需要的步骤 → 逐步执行每个工具 → 全部完成后输出 final_answer`;

/**
 * 从 LLM 响应中提取工具调用或最终回答
 */
function parseResponse(text) {
  // 1. 检查 tool_call
  const toolCallMatch = text.match(/```tool_call\s*\n([\s\S]*?)\n```/);
  if (toolCallMatch) {
    try {
      const parsed = JSON.parse(toolCallMatch[1].trim());
      if (parsed.tool) {
        return {
          type: 'tool_call',
          tool: parsed.tool,
          params: parsed.params || {},
          thought: text.replace(/```tool_call[\s\S]*?```/, '').trim()
        };
      }
    } catch (e) {
      // JSON 解析失败，尝试修复常见问题
      console.warn('⚠️ tool_call JSON 解析失败，尝试修复:', e.message);
    }
  }

  // 2. 检查 final_answer
  const finalMatch = text.match(/```final_answer\s*\n([\s\S]*?)\n```/);
  if (finalMatch) {
    return {
      type: 'final_answer',
      answer: finalMatch[1].trim()
    };
  }

  // 3. 兜底：检查是否包含裸 JSON 工具调用（兼容格式不太规范的输出）
  const jsonMatch = text.match(/\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{[\s\S]*?\})\s*\}/);
  if (jsonMatch) {
    try {
      const params = JSON.parse(jsonMatch[2]);
      return {
        type: 'tool_call',
        tool: jsonMatch[1],
        params,
        thought: text.replace(/\{[\s\S]*"tool"[\s\S]*\}/, '').trim()
      };
    } catch (e) { /* ignore */ }
  }

  // 4. 如果整个响应看起来像是自然语言回答（没有工具调用），当作最终回答
  return {
    type: 'final_answer',
    answer: text
  };
}

/**
 * 运行工具调用循环
 *
 * @param {string} userMessage - 用户消息
 * @param {string} projectId - 项目ID
 * @param {object} options - 可选参数
 * @param {function} options.onThought - 思考回调 (thought: string)
 * @param {function} options.onToolCall - 工具调用回调 (tool: string, params: object)
 * @param {function} options.onToolResult - 工具结果回调 (tool: string, result: string)
 * @param {function} options.onProgress - 进度回调 (message: string)
 * @param {object} options.sessionContext - 会话上下文
 * @returns {Promise<{answer: string, iterations: number, toolCalls: Array}>}
 */
async function runToolLoop(userMessage, projectId, options = {}) {
  const {
    onThought, onToolCall, onToolResult, onProgress,
    sessionContext, maxIterations = MAX_ITERATIONS
  } = options;

  const toolDescriptions = getToolDescriptions();
  const toolsPrompt = formatToolsPrompt(toolDescriptions);

  const meta = sessionContext?.currentMessageMetadata;
  const fileHint = meta?.fileUrl ? `\n用户本次消息附带了文件: ${meta.fileName || '未知文件'} (类型: ${meta.fileType || 'file'}, URL: ${meta.fileUrl})` : '';

  const contextSnippet = sessionContext
    ? `\n## 当前上下文\n项目ID: ${projectId}\n${sessionContext.script ? `剧本: ${sessionContext.script.title} (${sessionContext.script.scenes?.length || 0} 个分镜)\n分镜列表: ${sessionContext.script.scenes?.map((s, i) => `${i+1}.${s.description?.slice(0, 20)}`).join(' | ')}` : '暂无剧本'}\n${sessionContext.productInfo ? `商品: ${sessionContext.productInfo.title}` : ''}\n素材数: ${sessionContext.project?.materials?.length || 0}${fileHint}`
    : '';

  const systemPrompt = `你是 AI 视频创作助手，负责帮助用户完成短视频创作任务。用户可以通过聊天窗口上传图片、视频或文件，当用户上传了附件并要求分析时，使用 analyze_material 工具。${contextSnippet}

${toolsPrompt}

${TOOL_USE_INSTRUCTIONS}`;

  const conversationHistory = [
    { role: 'user', content: userMessage }
  ];

  const toolCalls = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    onProgress?.(`思考中... (第 ${iterations} 轮)`);

    // 调用 LLM — 使用多轮消息格式，让 LLM 正确感知对话轮次
    const response = await llmProvider.generateText({
      system: systemPrompt,
      messages: conversationHistory.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,  // tool 结果作为 user 消息发回（OpenAI 兼容格式不支持 tool role）
        content: m.role === 'tool'
          ? `[工具执行结果]\n${m.content}\n\n请根据以上结果决定：如果用户的任务还有未完成的步骤，继续调用工具；如果所有步骤已完成，输出 final_answer 汇总。`
          : m.content
      })),
      temperature: 0.3,
      maxTokens: 2000
    });

    const parsed = parseResponse(response);

    if (parsed.type === 'final_answer') {
      console.log(`✅ 工具循环完成，${iterations} 轮，${toolCalls.length} 次工具调用`);
      return {
        answer: parsed.answer,
        iterations,
        toolCalls
      };
    }

    if (parsed.type === 'tool_call') {
      const { tool, params, thought } = parsed;

      if (thought) {
        console.log(`🧠 思考: ${thought.slice(0, 100)}`);
        onThought?.(thought);
      }

      console.log(`🔧 调用工具: ${tool}(${JSON.stringify(params).slice(0, 100)})`);
      onToolCall?.(tool, params);

      // 执行工具
      const result = await executeTool(tool, params, { projectId, sessionContext });
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

      console.log(`📋 结果: ${resultStr.slice(0, 100)}`);
      onToolResult?.(tool, resultStr);

      toolCalls.push({ tool, params, result: resultStr });

      // 将工具调用和结果加入对话历史
      conversationHistory.push(
        { role: 'assistant', content: response },
        { role: 'tool', content: resultStr }
      );

      continue;
    }

    // 不应该到这里
    conversationHistory.push({ role: 'assistant', content: response });
  }

  console.warn(`⚠️ 工具循环达到最大迭代次数 (${maxIterations})`);
  return {
    answer: '抱歉，处理超时，请尝试简化您的请求。',
    iterations,
    toolCalls
  };
}

module.exports = {
  runToolLoop,
  parseResponse,
  formatToolsPrompt
};
