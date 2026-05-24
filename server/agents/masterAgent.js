const EventEmitter = require('events');
const IntentParser = require('./intent/intentParser');
const TaskPlanner = require('./planner/taskPlanner');
const ToolExecutor = require('./executor/toolExecutor');
const canvasSyncService = require('../services/canvasSyncService');
const projectModel = require('../models/project');
const agentChatService = require('../services/agentChatService');

class MasterAgent extends EventEmitter {
  constructor() {
    super();
    this.name = 'Copilot Master Agent';
    this.intentParser = new IntentParser();
    this.taskPlanner = new TaskPlanner();
    this.toolExecutor = new ToolExecutor();
    this.activeSessions = new Map();

    canvasSyncService.setEventEmitter(this);
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
      message
    );

    const intent = await this.intentParser.parse(message, sessionContext);
    console.log(`🎯 意图识别: ${intent.primaryIntent}, 置信度: ${intent.confidence}`);

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
}

module.exports = new MasterAgent();
