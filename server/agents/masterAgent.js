/**
 * MasterAgent — 统一调度 Agent
 *
 * 使用 toolLoop 替代原有的 intentParser + taskPlanner + toolExecutor + ReAct 循环。
 * 所有用户消息统一进入工具调用循环，由 LLM 自主决策调用哪些工具。
 */

const EventEmitter = require('events');
const canvasSyncService = require('../services/canvasSyncService');
const projectModel = require('../models/project');
const { runToolLoop } = require('./toolLoop');
const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const imageAgent = require('./imageAgent');
const clipAgent = require('./clipAgent');
const assetAgent = require('./assetAgent');
const reviewAgent = require('./reviewAgent');

class MasterAgent extends EventEmitter {
  constructor() {
    super();
    this.name = 'Copilot Master Agent';
    this.agentName = 'MasterAgent';
    this.activeSessions = new Map();

    this.subAgents = {
      scriptAgent, videoAgent, imageAgent, clipAgent, assetAgent, reviewAgent
    };

    canvasSyncService.setEventEmitter(this);
  }

  /**
   * 处理用户消息 — 统一入口
   * 所有消息都进入 toolLoop，由 LLM 自主决定调用什么工具
   */
  async processMessage(message, projectId, context = {}) {
    console.log(`\n🤖 MasterAgent: 收到消息 "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`);

    const sessionId = context.sessionId || await this.createChatSession(projectId);
    const sessionContext = await this.loadSessionContext(projectId, sessionId);

    // 保存用户消息
    await canvasSyncService.addChatMessage(
      sessionId, 'user', 'text', message, context.metadata || {}
    );

    // 异步运行工具循环
    const resultPromise = runToolLoop(message, projectId, {
      sessionContext,
      onThought: async (thought) => {
        await this.broadcastChatMessage(projectId, sessionId, 'assistant', 'operation_log', `🧠 ${thought}`);
      },
      onToolCall: async (tool, params) => {
        await this.broadcastChatMessage(projectId, sessionId, 'system', 'operation_log', `⚙️ 调用 ${tool}...`);
      },
      onToolResult: async (tool, result) => {
        const preview = result.length > 100 ? result.slice(0, 100) + '...' : result;
        await this.broadcastChatMessage(projectId, sessionId, 'system', 'operation_log', `📋 ${tool}: ${preview}`);
      },
      onProgress: async (msg) => {
        console.log(`📊 ${msg}`);
      }
    });

    // 立即返回，不阻塞前端
    resultPromise.then(async (result) => {
      await canvasSyncService.addChatMessage(
        sessionId, 'assistant', 'text', result.answer
      );
      console.log(`✅ 工具循环完成: ${result.iterations} 轮, ${result.toolCalls.length} 次工具调用`);
    }).catch(async (err) => {
      console.error('❌ 工具循环失败:', err);
      await canvasSyncService.addChatMessage(
        sessionId, 'assistant', 'error', `❌ 处理失败: ${err.message}`
      );
    });

    return {
      type: 'chat',
      sessionId,
      message: '🤖 正在为您处理，请稍候...'
    };
  }

  /**
   * 执行已确认的计划（保留用于兼容 /copilot/execute 端点）
   */
  async executeConfirmedPlan(planNodeId, projectId, sessionId) {
    console.log(`🚀 MasterAgent: 执行计划 ${planNodeId}`);

    const planNode = await canvasSyncService.getNode(planNodeId);
    if (!planNode) throw new Error(`计划节点不存在: ${planNodeId}`);

    const plan = planNode.data;
    await canvasSyncService.updatePlanStatus(planNodeId, 'confirmed');

    if (sessionId) {
      await canvasSyncService.addChatMessage(sessionId, 'system', 'operation_log', '🚀 开始执行计划...');
    }

    const results = [];
    for (const step of plan.steps) {
      if (step.status === 'skipped') continue;

      try {
        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'executing');

        if (sessionId) {
          await canvasSyncService.addChatMessage(sessionId, 'system', 'operation_log', `⚙️ ${step.description}...`);
        }

        // 通过 toolLoop 执行单个步骤
        const { executeTool } = require('./tools/toolRegistry');
        const result = await executeTool(step.type, step.params || {}, { projectId, sessionContext: {} });

        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'completed', result);

        if (sessionId) {
          await canvasSyncService.addChatMessage(sessionId, 'system', 'operation_log', `✅ ${step.description} 完成`);
        }

        results.push({ stepId: step.stepId, success: true, result });

      } catch (error) {
        await canvasSyncService.updateStepStatus(planNodeId, step.stepId, 'failed', null, error.message);

        if (sessionId) {
          await canvasSyncService.addChatMessage(sessionId, 'assistant', 'error', `❌ ${step.description} 失败: ${error.message}`);
        }

        results.push({ stepId: step.stepId, success: false, error: error.message });
        if (step.critical) break;
      }
    }

    const allSuccess = results.every(r => r.success);
    await canvasSyncService.updatePlanStatus(planNodeId, allSuccess ? 'completed' : 'failed');

    const summary = allSuccess
      ? `✅ 所有 ${results.length} 个操作执行成功！`
      : `⚠️ 执行完成：${results.filter(r => r.success).length} 成功，${results.filter(r => !r.success).length} 失败`;

    if (sessionId) {
      await canvasSyncService.addChatMessage(sessionId, 'assistant', 'text', summary);
    }

    return { planNodeId, success: allSuccess, results, summary };
  }

  async cancelPlan(planNodeId, projectId, sessionId) {
    await canvasSyncService.updatePlanStatus(planNodeId, 'cancelled');
    if (sessionId) {
      await canvasSyncService.addChatMessage(sessionId, 'system', 'operation_log', '❌ 已取消执行');
    }
    return { success: true, message: '计划已取消' };
  }

  // ─── 辅助方法 ─────────────────────────────────────────

  async loadSessionContext(projectId, sessionId) {
    const cacheKey = `${projectId}:${sessionId}`;
    if (this.activeSessions.has(cacheKey)) return this.activeSessions.get(cacheKey);

    const project = await projectModel.getById(projectId);
    const recentMessages = await canvasSyncService.getChatHistory(sessionId);

    const context = {
      project,
      recentMessages,
      script: project?.script,
      productInfo: project?.product_info,
      timestamp: Date.now()
    };

    this.activeSessions.set(cacheKey, context);
    return context;
  }

  async createChatSession(projectId, title = '新会话') {
    return await canvasSyncService.createChatSession(projectId, title);
  }

  async broadcastChatMessage(projectId, sessionId, role, messageType, content, metadata = {}) {
    const messageId = await canvasSyncService.addChatMessage(sessionId, role, messageType, content, metadata);
    canvasSyncService.broadcast(projectId, {
      type: 'chat_message_created',
      message: { id: messageId, role, messageType, content, timestamp: Date.now(), metadata }
    });
    return messageId;
  }
}

module.exports = new MasterAgent();
