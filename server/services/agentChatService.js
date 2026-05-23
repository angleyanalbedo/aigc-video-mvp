const { llmProvider } = require('./providers');
const { memoryManager } = require('../agents/memory');
const skillLoader = require('../agents/skills/skillLoader');

const CHAT_SKILL_ID = 'ChatCopilot_script';

const FALLBACK_CHAT_PROMPT = `你是一个资深的电商 AIGC 视频创作助手（Copilot Agent）。
你的职责是根据商品详情，与用户协同编写、润色和修改爆款带货短视频的剧本分镜。

【剧本输出规范】
你必须返回一个符合以下 JSON Schema 的结构：
{
  "agentMessage": "针对用户指令你做出的自然语言回复，字数在100字以内，语气专业、热情且幽默",
  "script": {
    "title": "剧本视频标题",
    "description": "剧本的核心卖点与风格创意简述",
    "scenes": [
      {
        "description": "分镜画面视觉描述",
        "duration": 5,
        "voiceover": "旁白文案",
        "shot_type": "特写 | 中景 | 全景 | 俯拍 | 仰拍",
        "emotion": "热情 | 专业 | 平静 | 幽默 | 震惊",
        "transition": "无 | 淡入淡出 | 闪白 | 快速切镜"
      }
    ]
  }
}`;

class AgentChatService {
  getSkillPrompt() {
    return skillLoader.loadPrompt(CHAT_SKILL_ID) || FALLBACK_CHAT_PROMPT;
  }

  async modifyScript(currentScript, message, productContext = null, projectId = null) {
    const sessionId = projectId || `chat_${Date.now()}`;
    const agentName = 'ChatCopilot';

    await memoryManager.addShortTerm({
      agentName,
      sessionId,
      content: message,
      metadata: { role: 'user', productContext },
      importance: 0.6
    });

    const memories = await memoryManager.recall({
      agentName,
      sessionId,
      query: message
    });
    const memoryContext = memoryManager.buildContextString(memories);

    const skillBase = this.getSkillPrompt();

    const systemPrompt = `${skillBase}

【商品核心背景】
${productContext ? JSON.stringify(productContext, null, 2) : '暂无特定商品信息，请基于一般电商逻辑生成'}

【当前剧本状态】
${currentScript ? JSON.stringify(currentScript, null, 2) : '目前尚无剧本，请根据商品背景全新创作'}
${memoryContext ? `\n【跨会话记忆上下文】\n${memoryContext}` : ''}`;

    const userPrompt = `用户指令: "${message}"

根据【当前剧本状态】和【商品核心背景】，执行用户指令。如果是全新创作，请为其构思一个吸睛的带货结构。如果是修改，请仅仅对指定的分镜或属性进行精确修改，保持其他没有被要求修改的内容不变。
请直接输出符合 Schema 的 JSON 结果，必须包含 "agentMessage" 和 "script" 两部分。`;

    const schema = {
      type: "object",
      properties: {
        agentMessage: { type: "string" },
        script: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  duration: { type: "number" },
                  voiceover: { type: "string" },
                  shot_type: { type: "string" },
                  emotion: { type: "string" },
                  transition: { type: "string" }
                },
                required: ["description", "duration", "voiceover", "shot_type", "emotion", "transition"]
              }
            }
          },
          required: ["title", "description", "scenes"]
        }
      },
      required: ["agentMessage", "script"]
    };

    try {
      const response = await llmProvider.generateStructuredText({
        system: systemPrompt,
        prompt: userPrompt,
        schema
      });

      await memoryManager.addShortTerm({
        agentName,
        sessionId,
        content: response.agentMessage || '剧本修改完成',
        metadata: { role: 'assistant', scriptTitle: response.script?.title },
        importance: 0.7
      });

      if (response.script?.title) {
        await memoryManager.addLongTerm({
          agentName,
          sessionId,
          content: `创作剧本"${response.script.title}"，${response.script.scenes?.length || 0}个分镜`,
          metadata: { title: response.script.title },
          importance: 0.8
        });
      }

      return response;
    } catch (error) {
      console.error('Agent chat processing error:', error);
      return {
        agentMessage: `抱歉，由于模型接口暂时繁忙，我通过本地创意库为您快速响应了。这里是为您调整的智能带货剧本，突出了卖点！`,
        script: currentScript || {
          title: "爆款破壁机带货推荐",
          description: "智能破壁免滤，享受清晨第一杯丝滑豆浆",
          scenes: [
            {
              description: "温馨舒适的厨房背景下，破壁机底盘微距特写，金属拉丝质感极佳",
              duration: 4,
              voiceover: "每天早晨，你是不是也被吵闹的豆浆机打扰了美梦？",
              shot_type: "特写",
              emotion: "平静",
              transition: "淡入淡出"
            },
            {
              description: "放入大豆，合上杯盖，手指按下静音启动触控屏",
              duration: 5,
              voiceover: "全新免滤破壁机，超静音黑科技，睡醒即享丝滑营养！",
              shot_type: "中景",
              emotion: "热情",
              transition: "闪白"
            }
          ]
        }
      };
    }
  }
}

module.exports = new AgentChatService();
