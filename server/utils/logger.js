const winston = require('winston');
const { format } = winston;
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 自定义日志格式
const logFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// 控制台输出格式（更易读）
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.stack === undefined) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    if (meta.stack) {
      logMessage += `\n${meta.stack}`;
    }
    return logMessage;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: winston.config.npm.levels,
  format: logFormat,
  defaultMeta: {
    service: 'aigc-video-server',
    version: '1.0.0'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  exitOnError: false
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 请求追踪 ID 生成
let requestCounter = 0;
function generateTraceId() {
  const timestamp = Date.now().toString(36);
  const counter = (requestCounter++ % 10000).toString(36).padStart(4, '0');
  return `${timestamp}-${counter}`;
}

// 创建带追踪 ID 的子日志记录器
logger.childWithTrace = function(traceId) {
  return this.child({ traceId });
};

module.exports = {
  logger,
  generateTraceId
};
