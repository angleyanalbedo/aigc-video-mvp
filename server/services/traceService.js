/**
 * TraceService - 生成过程追踪服务
 * 记录整个生成流程的步骤、时间和数据
 */

class TraceService {
  constructor() {
    // 内存存储，生产环境应使用数据库
    this.traces = new Map();
  }

  /**
   * 开始一个新的追踪
   * @param {string} taskId - 任务ID
   * @param {object} metadata - 任务元数据
   */
  startTrace(taskId, metadata = {}) {
    this.traces.set(taskId, {
      id: taskId,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      duration: null,
      metadata,
      steps: [],
      errors: []
    });
    return this.traces.get(taskId);
  }

  /**
   * 添加一个步骤
   * @param {string} taskId - 任务ID
   * @param {string} stepName - 步骤名称
   * @param {object} data - 步骤数据
   */
  addStep(taskId, stepName, data = {}) {
    const trace = this.traces.get(taskId);
    if (!trace) {
      console.warn(`Trace not found for task: ${taskId}`);
      return;
    }

    const step = {
      name: stepName,
      timestamp: Date.now(),
      relativeTime: Date.now() - trace.startTime,
      data
    };

    trace.steps.push(step);
    console.log(`📍 [Trace] ${taskId} - ${stepName} (+${step.relativeTime}ms)`);
    
    return step;
  }

  /**
   * 记录错误
   * @param {string} taskId - 任务ID
   * @param {string} stepName - 步骤名称
   * @param {Error} error - 错误对象
   */
  addError(taskId, stepName, error) {
    const trace = this.traces.get(taskId);
    if (!trace) return;

    trace.errors.push({
      step: stepName,
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    });

    this.addStep(taskId, `error:${stepName}`, { error: error.message });
  }

  /**
   * 完成追踪
   * @param {string} taskId - 任务ID
   * @param {string} status - 最终状态
   * @param {object} result - 最终结果
   */
  completeTrace(taskId, status = 'completed', result = {}) {
    const trace = this.traces.get(taskId);
    if (!trace) return;

    trace.status = status;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.result = result;

    this.addStep(taskId, 'completed', { status, duration: trace.duration });
    console.log(`✅ [Trace] ${taskId} 完成，耗时 ${trace.duration}ms`);

    return trace;
  }

  /**
   * 获取追踪记录
   * @param {string} taskId - 任务ID
   */
  getTrace(taskId) {
    return this.traces.get(taskId);
  }

  /**
   * 获取所有追踪记录
   */
  getAllTraces() {
    return Array.from(this.traces.values());
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const traces = Array.from(this.traces.values());
    const completed = traces.filter(t => t.status === 'completed');
    const failed = traces.filter(t => t.status === 'failed');
    const running = traces.filter(t => t.status === 'running');

    return {
      total: traces.length,
      completed: completed.length,
      failed: failed.length,
      running: running.length,
      avgDuration: completed.length > 0 
        ? Math.round(completed.reduce((sum, t) => sum + t.duration, 0) / completed.length)
        : 0
    };
  }

  /**
   * 清理过期记录
   * @param {number} maxAge - 最大存活时间（毫秒）
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, trace] of this.traces) {
      if (trace.endTime && (now - trace.endTime) > maxAge) {
        this.traces.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [Trace] 清理了 ${cleaned} 条过期记录`);
    }

    return cleaned;
  }

  /**
   * 导出为可读格式
   * @param {string} taskId - 任务ID
   */
  exportTrace(taskId) {
    const trace = this.getTrace(taskId);
    if (!trace) return null;

    return {
      taskId: trace.id,
      status: trace.status,
      duration: trace.duration ? `${trace.duration}ms` : 'running',
      metadata: trace.metadata,
      timeline: trace.steps.map(s => ({
        step: s.name,
        time: `+${s.relativeTime}ms`,
        data: s.data
      })),
      errors: trace.errors,
      summary: {
        totalSteps: trace.steps.length,
        errorCount: trace.errors.length,
        result: trace.result
      }
    };
  }
}

// 单例模式
const traceService = new TraceService();

// 定期清理（每小时）
setInterval(() => traceService.cleanup(), 60 * 60 * 1000);

module.exports = traceService;
