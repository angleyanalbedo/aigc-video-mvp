/**
 * 重试工具函数
 * 支持指数退避、最大重试次数、自定义判断
 */

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行
 * @param {Function} fn - 要执行的异步函数
 * @param {object} options - 配置选项
 * @param {number} options.maxRetries - 最大重试次数，默认 3
 * @param {number} options.initialDelay - 初始延迟毫秒数，默认 1000
 * @param {number} options.maxDelay - 最大延迟毫秒数，默认 30000
 * @param {number} options.backoffFactor - 退避因子，默认 2
 * @param {Function} options.shouldRetry - 判断是否应该重试的函数
 * @param {Function} options.onRetry - 重试时的回调函数
 * @returns {Promise} 函数执行结果
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = (error) => true, // 默认所有错误都重试
    onRetry = (attempt, error, delay) => {
      console.log(`🔄 重试 ${attempt}/${maxRetries}，等待 ${delay}ms，错误: ${error.message}`);
    }
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        console.log(`✅ 重试成功，第 ${attempt} 次尝试`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // 检查是否应该重试
      if (attempt === maxRetries || !shouldRetry(error)) {
        console.error(`❌ 重试失败，已达到最大次数或不可重试的错误: ${error.message}`);
        throw error;
      }

      // 调用重试回调
      onRetry(attempt + 1, error, delay);

      // 等待后重试
      await sleep(delay);

      // 指数退避
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * 视频生成专用重试配置
 */
const videoRetryOptions = {
  maxRetries: 1,         // 外层重试 1 次即可；内层 pollVideoCompletion 已有 300 次检查
  initialDelay: 5000,
  maxDelay: 60000,
  backoffFactor: 2,
  shouldRetry: (error) => {
    // 网络错误、超时、服务端错误可以重试（兼容英文和中文错误信息）
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'timeout',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal error',
      '超时',        // 中文超时
      '视频生成超时', // 中文明确超时
      '网络',        // 中文网络错误
      '连接'         // 中文连接错误
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    // 中文关键词单独匹配（不 toLowerCase 避免破坏中文字符）
    const chineseKeywords = ['超时', '视频生成超时', '网络', '连接'];
    const matchesChinese = chineseKeywords.some(k => error.message?.includes(k));
    const matchesEnglish = retryableErrors.some(e => errorMessage.includes(e.toLowerCase()));
    return matchesChinese || matchesEnglish;
  }
};

/**
 * TTS 生成专用重试配置
 */
const ttsRetryOptions = {
  maxRetries: 2,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error) => {
    // TTS 错误通常可以重试
    return !error.message?.includes('voice not found');
  }
};

/**
 * API 调用专用重试配置
 */
const apiRetryOptions = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error) => {
    const status = error.response?.status;
    // 5xx 错误和 429 可以重试
    return status >= 500 || status === 429;
  }
};

/**
 * 批量重试执行多个任务
 * @param {Array<Function>} tasks - 任务函数数组
 * @param {object} options - 重试配置
 * @returns {Promise<Array>} 所有任务的结果
 */
async function batchWithRetry(tasks, options = {}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < tasks.length; i++) {
    try {
      const result = await withRetry(tasks[i], options);
      results.push({ index: i, success: true, result });
    } catch (error) {
      errors.push({ index: i, success: false, error: error.message });
      results.push({ index: i, success: false, error: error.message });
    }
  }

  return { results, errors, successCount: results.filter(r => r.success).length };
}

module.exports = {
  withRetry,
  sleep,
  videoRetryOptions,
  ttsRetryOptions,
  apiRetryOptions,
  batchWithRetry
};
