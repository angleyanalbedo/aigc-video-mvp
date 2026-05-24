const EventEmitter = require('events');
const IntentParser = require('./intent/intentParser');
const TaskPlanner = require('./planner/taskPlanner');
const ToolExecutor = require('./executor/toolExecutor');
const canvasSyncService = require('../services/canvasSyncService');
const projectModel = require('../models/project');
const agentChatService = require('../services/agentChatService');
const { llmProvider } = require('../services/providers');
const skillLoader = require('./skills/skillLoader');
const { getToolsForAgent } = require('./tools/agentTools');
const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const imageAgent = require('./imageAgent');
const clipAgent = require('./clipAgent');
const assetAgent = require('./assetAgent');
const reviewAgent = require('./reviewAgent');

const FALLBACK_PROMPT = `你是 Copilot Master Agent，负责协调所有子 Agent 完成复杂任务。

## 核心职责
1. 意图解析：理解用户需求，分解为可执行的任务
2. 任务规划：制定执行计划，协调多个 Agent
3. 工具执行：调用各种工具完成具体操作
4. 结果整合：汇总各 Agent 的结果，返回给用户

## 协作模式
- 决策层 Agent：ScriptAgent、AssetAgent
- 执行层 Agent：VideoAgent、ImageAgent、ClipAgent
- 监督层 Agent：ReviewAgent

## 错误处理
- 单个 Agent 失败不影响整体流程
- 自动重试失败的步骤
- 优雅降级到备选方案`;

class MasterAgent extends EventEmitter {
  constructor() {
    super();
    this.name = 'Copilot Master Agent';
    this.agentName = 'MasterAgent';
    this.skillId = 'ChatCopilot';
    this.intentParser = new IntentParser();
    this.taskPlanner = new TaskPlanner();
    this.toolExecutor = new ToolExecutor();
    this.activeSessions = new Map();
    this.tools = getToolsForAgent('MasterAgent');

    this.subAgents = {
      scriptAgent,
      videoAgent,
      imageAgent,
      clipAgent,
      assetAgent,
      reviewAgent
    };

    canvasSyncService.setEventEmitter(this);
  }

  getSystemPrompt() {
    const skillPrompt = skillLoader.loadPrompt(this.skillId);
    return skillPrompt || FALLBACK_PROMPT;
  }



  async callSkill(params, options = {}) {
    const result = await skillLoader.callSkill(this.skillId, {
      prompt: params.prompt,
      schema: params.schema
    }, options);
    
    if (!result.success) {
      throw new Error(result.error || 'Skill execution failed');
    }
    
    return result.result;
  }

  async callOtherAgent(agentName, params, options = {}) {
    const result = await skillLoader.call(agentName, params, options);
    
    if (!result.success) {
      throw new Error(result.error || `Skill call to ${agentName} failed`);
    }
    
    return result.result;
  }

  async processMessage(message, projectId, context = {}) {
    console.log(`
🤖 MasterAgent: 收到消息 "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`);

    const sessionId = context.sessionId || await this.createChatSession(projectId);
    const sessionContext = await this.loadSessionContext(projectId, sessionId);

    await canvasSyncService.addChatMessage(
      sessionId,
      'user',
      'text',
      message,
      context.metadata || {}
    );

    const intent = await this.intentParser.parse(message, sessionContext);
    console.log(`🎯 意图识别: ${intent.primaryIntent}, 置信度: ${intent.confidence}`);

    // 检测是否进入 ReAct 自主模式
    if (this.isReActMode(message, intent)) {
      console.log('🤖 MasterAgent: 检测到 ReAct 自主模式触发条件，转入后台 ReAct 循环！');
      
      const startupMessage = '🤖 已为您开启 **ReAct 智能自主创作模式**。我会根据您的目标进行深度思考、规划，并自主调用工具。请留意下方我的思考链路以及画布变化！';
      
      await canvasSyncService.addChatMessage(
        sessionId,
        'assistant',
        'text',
        startupMessage
      );

      this.runReActLoop(message, projectId, sessionId, sessionContext, intent).catch(err => {
        console.error('❌ ReAct 循环失败:', err);
      });

      return {
        type: 'chat',
        sessionId,
        message: startupMessage
      };
    }

    // 若是未知意图（无法匹配到任何指令）或纯解释询问，则直接进入智能对话，不生成画布节点
    if (intent.primaryIntent === 'unknown' || intent.primaryIntent === 'explain') {
      const reply = await agentChatService.generateGeneralChat(message, sessionContext);
      
      await canvasSyncService.addChatMessage(
        sessionId,
        'assistant',
        'text',
        reply
      );

      return {
        type: 'chat',
        sessionId,
        message: reply
      };
    }

    const plan = await this.taskPlanner.generatePlan(intent, projectId, sessionContext);
    console.log(`📋 生成计划: ${plan.steps.length} 个步骤`);

    const canvasUpdate = await canvasSyncService.createIntentAndPlan(
      projectId,
      intent,
      plan,
      sessionId
    );

    const confirmationMessage = this.generateConfirmationMessage(plan);

    await canvasSyncService.addChatMessage(
      sessionId,
      'assistant',
      plan.requiresConfirmation ? 'plan_confirmation' : 'text',
      plan.requiresConfirmation ? confirmationMessage : '正在执行...',
      { intentNodeId: canvasUpdate.intentNodeId, planNodeId: canvasUpdate.planNodeId }
    );

    if (plan.requiresConfirmation) {
      return {
        type: 'plan_confirmation',
        intentNodeId: canvasUpdate.intentNodeId,
        planNodeId: canvasUpdate.planNodeId,
        sessionId,
        message: confirmationMessage,
        plan: plan,
        estimatedDuration: plan.estimatedDuration
      };
    }

    return await this.executeSimpleActions(plan, projectId, canvasUpdate, sessionId);
  }

  async executeSimpleActions(plan, projectId, canvasUpdate, sessionId) {
    console.log(`⚡ MasterAgent: 直接执行简单操作`);

    const results = [];
    for (const step of plan.steps) {
      try {
        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'system',
            'operation_log',
            `⚙️ ${step.description}...`
          );
        }

        const result = await this.toolExecutor.execute(step, projectId, {});

        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'assistant',
            'text',
            result.message || result
          );
        }

        results.push({ stepId: step.stepId, success: true, result });

      } catch (error) {
        console.error(`❌ 简单操作失败:`, error);
        results.push({ stepId: step.stepId, success: false, error: error.message });

        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'assistant',
            'error',
            `❌ ${step.description} 失败: ${error.message}`
          );
        }
      }
    }

    return {
      type: 'completed',
      success: results.every(r => r.success),
      results,
      message: results.every(r => r.success) ? '操作完成！' : '部分操作失败'
    };
  }

  async executeConfirmedPlan(planNodeId, projectId, sessionId) {
    console.log(`🚀 MasterAgent: 开始执行计划 ${planNodeId}`);

    const planNode = await canvasSyncService.getNode(planNodeId);
    if (!planNode) {
      throw new Error(`计划节点不存在: ${planNodeId}`);
    }

    const plan = planNode.data;
    await canvasSyncService.updatePlanStatus(planNodeId, 'confirmed');

    if (sessionId) {
      await canvasSyncService.addChatMessage(
        sessionId,
        'system',
        'operation_log',
        '🚀 开始执行计划...'
      );
    }

    const results = [];
    for (const step of plan.steps) {
      if (step.status === 'skipped') continue;

      const operationNodeId = await canvasSyncService.createOperationNode(
        projectId,
        step,
        planNodeId
      );

      try {
        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'executing');
        await canvasSyncService.updateOperationNode(operationNodeId, {
          status: 'executing',
          startTime: Date.now()
        });

        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'system',
            'operation_log',
            `⚙️ ${step.description}...`
          );
        }

        const result = await this.toolExecutor.execute(step, projectId, {
          onProgress: (progress) => {
            this.emit('operationProgress', {
              operationNodeId,
              progress,
              stepId: step.stepId,
              projectId
            });
          }
        });

        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'completed', result);
        await canvasSyncService.updateOperationNode(operationNodeId, {
          status: 'completed',
          result,
          endTime: Date.now()
        });

        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'system',
            'operation_log',
            `✅ ${step.description} 完成`
          );
        }

        results.push({ stepId: step.stepId, success: true, result });

      } catch (error) {
        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'failed', null, error.message);
        await canvasSyncService.updateOperationNode(operationNodeId, {
          status: 'failed',
          error: error.message,
          endTime: Date.now()
        });

        if (sessionId) {
          await canvasSyncService.addChatMessage(
            sessionId,
            'assistant',
            'error',
            `❌ ${step.description} 失败: ${error.message}`
          );
        }

        results.push({ stepId: step.stepId, success: false, error: error.message });

        if (step.critical) {
          console.error(`❌ 关键步骤失败，停止执行`);
          break;
        }
      }
    }

    const allSuccess = results.every(r => r.success);
    await canvasSyncService.updatePlanStatus(planNodeId, allSuccess ? 'completed' : 'failed');

    const summary = this.generateExecutionSummary(results);

    if (sessionId) {
      await canvasSyncService.addChatMessage(
        sessionId,
        'assistant',
        'text',
        summary
      );
    }

    return {
      planNodeId,
      success: allSuccess,
      results,
      summary
    };
  }

  async cancelPlan(planNodeId, projectId, sessionId) {
    await canvasSyncService.updatePlanStatus(planNodeId, 'cancelled');

    if (sessionId) {
      await canvasSyncService.addChatMessage(
        sessionId,
        'system',
        'operation_log',
        '❌ 已取消执行'
      );
    }

    return { success: true, message: '计划已取消' };
  }

  async loadSessionContext(projectId, sessionId) {
    const cacheKey = `${projectId}:${sessionId}`;

    if (this.activeSessions.has(cacheKey)) {
      return this.activeSessions.get(cacheKey);
    }

    const project = await projectModel.getById(projectId);
    const recentMessages = await canvasSyncService.getChatHistory(sessionId);
    const canvasNodes = await canvasSyncService.getNodes(projectId);

    const context = {
      project,
      recentMessages,
      canvasNodes,
      timestamp: Date.now()
    };

    this.activeSessions.set(cacheKey, context);
    return context;
  }

  async createChatSession(projectId, title = '新会话') {
    return await canvasSyncService.createChatSession(projectId, title);
  }

  generateConfirmationMessage(plan) {
    const stepDescriptions = plan.steps
      .map((s, i) => `${i + 1}. ${s.description}`)
      .join('\n');

    const minutes = Math.ceil(plan.estimatedDuration / 60);

    return `我将执行以下 ${plan.steps.length} 个操作：\n\n${stepDescriptions}\n\n预计耗时: ${minutes} 分钟\n\n是否确认执行？`;
  }

  generateExecutionSummary(results) {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    if (failed === 0) {
      return `✅ 所有 ${success} 个操作执行成功！`;
    }

    return `⚠️ 执行完成：${success} 成功，${failed} 失败`;
  }

  isReActMode(message, intent) {
    const reactKeywords = [/react/i, /react-mode/i, /自主模式/i, /自动模式/i, /一键成片/i];
    const matchesKeyword = reactKeywords.some(pattern => pattern.test(message));
    
    const isVideoCreationRequest = intent.primaryIntent === 'generate_video' || 
      (intent.primaryIntent === 'generate_script' && /视频/i.test(message));
    
    return matchesKeyword || isVideoCreationRequest;
  }

  async runReActLoop(userQuery, projectId, sessionId, initialContext, initialIntent) {
    console.log(`🤖 ReAct 循环启动! 项目: ${projectId}, 会话: ${sessionId}`);

    // 1. 初始化画布上 ReAct 的 IntentNode 与 PlanNode
    const reactPlan = {
      description: 'ReAct 自主智能视频创作',
      steps: [
        {
          stepId: `react_step_main_${Date.now()}`,
          type: 'react_loop',
          agent: 'MasterAgent',
          description: 'ReAct 自主决策执行循环',
          status: 'executing'
        }
      ],
      estimatedDuration: 180,
      requiresConfirmation: false
    };

    const canvasUpdate = await canvasSyncService.createIntentAndPlan(
      projectId,
      initialIntent,
      reactPlan,
      sessionId
    );

    const planNodeId = canvasUpdate.planNodeId;
    await canvasSyncService.updatePlanStatus(planNodeId, 'confirmed');

    const project = await projectModel.getById(projectId);
    const sceneCount = project?.script?.scenes?.length || 0;
    const maxIterations = Math.max(30, sceneCount * 3 + 10);

    let reactHistory = [];
    let iteration = 0;
    let finalAnswer = null;

    const systemPrompt = `你是一个具备自主决策能力的电商带货视频创作 Master Agent。
你以 ReAct (Reasoning and Acting) 模式运行。你可以通过不断地 思考(Thought)、采取行动(Action) 并观察结果(Observation) 来逐步完成用户的目标。

你的终极目标是根据用户输入，自主且高效地调用相应的工具来完成视频创作任务（例如，一键端到端生成完整视频，包括写剧本、渲染视频、剪辑合成等）。

【可选工具清单】
1. generate_script: 生成剧本和分镜。参数：{ "productInfo": { "title": "商品名称", "sellingPoints": "卖点描述" } }
2. generate_video: 渲染单个分镜的视频。参数：{ "sceneId": 1 }
3. compose_video: 剪辑与合成最终视频。参数：{}
4. update_scene: 修改分镜。参数：{ "sceneId": 1, "updates": { "shot_type": "特写", "duration": 5, "voiceover": "新旁白" } }
5. explain: 对用户进行非操作性的解答与说明。参数：{ "message": "解答内容" }

【ReAct 输出格式规范】
你的每一次回复必须严格且只包含以下结构（不需要 JSON，直接纯文本输出，必须换行）：
Thought: <你当前的思考逻辑，阐述下一步要调用哪个工具以及为什么>
Action: <工具名称，必须是工具清单中的一个>
Action Input: <工具参数，必须是合法的 JSON 格式，例如 {"sceneId": 1} 或 {"productInfo": {"title": "手表"}}>

当且仅当你完成了所有的工作，或者认为已经无法继续时，你可以输出：
Thought: <总结完成的工作>
Final Answer: <给用户的自然语言总结，宣告任务完成并展示成果，可以用 Markdown 格式>

【极其重要的约束】
- 每次 Action 只能调用一个工具！
- 你调用工具后，系统会返回 Observation 作为反馈。不要自己伪造 Observation！
- 对于 Action Input，务必确保它是合法的 JSON，不要包含 Markdown 代码块（如 \`\`\`json ）。`;

    const prodInfo = project.product_info || { title: project.name || '爆款商品', sellingPoints: project.description || '高品质' };
    
    let promptContext = `【当前项目背景】
项目 ID: ${projectId}
商品信息: ${JSON.stringify(prodInfo)}
当前剧本: ${project.script ? JSON.stringify(project.script.scenes?.map(s => ({ id: s.id, status: s.status, hasVideo: !!s.videoUrl }))) : '暂无剧本'}

【用户终极任务】
"${userQuery}"

请开始你的 ReAct 循环！写下你的 Thought 以及对应的 Action 与 Action Input。`;

    while (iteration < maxIterations && !finalAnswer) {
      iteration++;
      console.log(`🧠 [ReAct 迭代 ${iteration}/${maxIterations}] 正在调用 LLM...`);

      let fullPrompt = promptContext;
      if (reactHistory.length > 0) {
        fullPrompt += "\n\n【对话历史与工具调用记录】\n" + reactHistory.join("\n\n");
        fullPrompt += "\n\n接下来，请继续你的思考和下一步动作：";
      }

      try {
        const response = await llmProvider.generateText({
          system: systemPrompt,
          prompt: fullPrompt,
          temperature: 0.2,
          maxTokens: 1000
        });

        console.log(`🤖 LLM 回复:\n${response}`);

        const parsed = this.parseReActResponse(response);
        
        if (parsed.thought) {
          await this.broadcastChatMessage(
            projectId,
            sessionId,
            'assistant',
            'operation_log',
            `🧠 思考 [步骤 ${iteration}]: ${parsed.thought}`
          );
        }

        if (parsed.finalAnswer) {
          finalAnswer = parsed.finalAnswer;
          await canvasSyncService.updatePlanStatus(planNodeId, 'completed');
          
          await this.broadcastChatMessage(
            projectId,
            sessionId,
            'assistant',
            'text',
            finalAnswer
          );
          break;
        }

        if (parsed.action) {
          console.log(`🎬 准备执行行动: ${parsed.action}, 参数:`, parsed.actionInput);

          await this.broadcastChatMessage(
            projectId,
            sessionId,
            'system',
            'operation_log',
            `⚙️ 准备执行行动: ${parsed.action}...`
          );

          const step = {
            stepId: `react_step_${iteration}_${Date.now()}`,
            type: parsed.action,
            agent: 'MasterAgent',
            description: `ReAct 步骤 ${iteration}: ${parsed.action}`,
            params: parsed.actionInput
          };

          if (parsed.action === 'generate_video') {
            const currentProj = await projectModel.getById(projectId);
            const script = currentProj.script;
            const scene = script?.scenes?.find(s => s.id === parsed.actionInput.sceneId);
            if (scene) {
              step.params.scene = scene;
              step.description = `渲染分镜 ${parsed.actionInput.sceneId} 的视频`;
            } else {
              throw new Error(`找不到分镜 ID: ${parsed.actionInput.sceneId}`);
            }
          }

          const operationNodeId = await canvasSyncService.createOperationNode(
            projectId,
            step,
            planNodeId
          );

          await canvasSyncService.updateOperationNode(operationNodeId, {
            status: 'executing',
            startTime: Date.now()
          });

          let observationResult;
          try {
            const toolResult = await this.toolExecutor.execute(step, projectId, {
              onProgress: (progress) => {
                this.emit('operationProgress', {
                  operationNodeId,
                  progress,
                  stepId: step.stepId,
                  projectId
                });
              }
            });

            observationResult = `成功。结果: ${JSON.stringify(toolResult)}`;
            
            await canvasSyncService.updateOperationNode(operationNodeId, {
              status: 'completed',
              result: toolResult,
              endTime: Date.now()
            });

            await this.broadcastChatMessage(
              projectId,
              sessionId,
              'system',
              'operation_log',
              `✅ 行动 [${parsed.action}] 执行成功！`
            );

          } catch (execErr) {
            console.error(`❌ ReAct 步骤执行出错:`, execErr);
            observationResult = `失败。错误: ${execErr.message}`;

            await canvasSyncService.updateOperationNode(operationNodeId, {
              status: 'failed',
              error: execErr.message,
              endTime: Date.now()
            });

            await this.broadcastChatMessage(
              projectId,
              sessionId,
              'assistant',
              'error',
              `❌ 行动 [${parsed.action}] 失败: ${execErr.message}`
            );
          }

          const turnLog = `Thought: ${parsed.thought}\nAction: ${parsed.action}\nAction Input: ${JSON.stringify(parsed.actionInput)}\nObservation: ${observationResult}`;
          reactHistory.push(turnLog);
        } else {
          console.warn('⚠️ 无法解析 LLM 的 ReAct 格式。');
          reactHistory.push(`Thought: LLM回复了非规范格式，需要纠正。\nObservation: 请务必按照 Thought: ... Action: ... Action Input: ... 的规范进行输出！`);
        }

      } catch (err) {
        console.error('❌ ReAct 循环抛出异常:', err);
        await this.broadcastChatMessage(
          projectId,
          sessionId,
          'assistant',
          'error',
          `❌ 智能自主决策遇到异常: ${err.message}`
        );
        await canvasSyncService.updatePlanStatus(planNodeId, 'failed');
        break;
      }
    }

    if (iteration >= maxIterations && !finalAnswer) {
      console.warn('⚠️ ReAct 达到最大迭代次数。');
      await this.broadcastChatMessage(
        projectId,
        sessionId,
        'assistant',
        'text',
        `⚠️ 智能助理已达到自主决策的最大尝试次数（${maxIterations}次），已为您自动结束。目前已生成的内容已同步在画布中，您可以进行预览或手动微调。`
      );
      await canvasSyncService.updatePlanStatus(planNodeId, 'completed');
    }
  }

  parseReActResponse(text) {
    const result = {
      thought: '',
      action: '',
      actionInput: null,
      finalAnswer: ''
    };

    const thoughtMatch = text.match(/Thought:\s*([\s\S]*?)(?=(Action:|Final Answer:|$))/i);
    if (thoughtMatch) {
      result.thought = thoughtMatch[1].trim();
    }

    const finalAnswerMatch = text.match(/Final Answer:\s*([\s\S]*)$/i);
    if (finalAnswerMatch) {
      result.finalAnswer = finalAnswerMatch[1].trim();
      return result;
    }

    const actionMatch = text.match(/Action:\s*([a-zA-Z_0-9]+)/i);
    if (actionMatch) {
      result.action = actionMatch[1].trim();
    }

    const actionInputMatch = text.match(/Action Input:\s*([\s\S]*?)$/i);
    if (actionInputMatch) {
      const rawInput = actionInputMatch[1].trim();
      try {
        const jsonStr = rawInput.replace(/```json/i, '').replace(/```/g, '').trim();
        result.actionInput = JSON.parse(jsonStr);
      } catch (err) {
        console.error('❌ 解析 Action Input JSON 失败:', rawInput, err.message);
        result.actionInput = {};
      }
    }

    return result;
  }

  async broadcastChatMessage(projectId, sessionId, role, messageType, content, metadata = {}) {
    const messageId = await canvasSyncService.addChatMessage(
      sessionId,
      role,
      messageType,
      content,
      metadata
    );

    canvasSyncService.broadcast(projectId, {
      type: 'chat_message_created',
      message: {
        id: messageId,
        role,
        messageType,
        content,
        timestamp: Date.now(),
        metadata
      }
    });

    return messageId;
  }
}

module.exports = new MasterAgent();
