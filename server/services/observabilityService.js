const { logger } = require('../utils/logger');
const os = require('os');

class ObservabilityService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        duration: []
      },
      endpoints: {},
      alerts: []
    };
    this.alertsConfig = {
      errorRateThreshold: 0.1,
      avgResponseTimeThreshold: 1000,
      memoryUsageThreshold: 0.85,
      cpuUsageThreshold: 0.80
    };
    this.alertHistory = [];
    this.startMonitoring();
  }

  trackRequest(method, path, statusCode, duration) {
    this.metrics.requests.total++;
    this.metrics.requests.duration.push(duration);
    
    if (statusCode >= 400) {
      this.metrics.requests.error++;
    } else {
      this.metrics.requests.success++;
    }

    const endpointKey = `${method} ${path}`;
    if (!this.metrics.endpoints[endpointKey]) {
      this.metrics.endpoints[endpointKey] = {
        calls: 0,
        errors: 0,
        duration: []
      };
    }
    this.metrics.endpoints[endpointKey].calls++;
    if (statusCode >= 400) {
      this.metrics.endpoints[endpointKey].errors++;
    }
    this.metrics.endpoints[endpointKey].duration.push(duration);

    this.checkAlerts();
  }

  getSystemMetrics() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = usedMemory / totalMemory;
    const uptime = os.uptime();

    const avgLoad = os.loadavg();
    
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 1 - (totalIdle / totalTick);

    return {
      timestamp: Date.now(),
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: (memoryUsage * 100).toFixed(2)
      },
      cpu: {
        usagePercent: (cpuUsage * 100).toFixed(2),
        load1: avgLoad[0],
        load5: avgLoad[1],
        load15: avgLoad[2],
        cores: cpus.length
      },
      os: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: uptime,
        uptimeFormatted: this.formatUptime(uptime)
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      }
    };
  }

  getRequestMetrics() {
    const durationAvg = this.metrics.requests.duration.length > 0
      ? this.metrics.requests.duration.reduce((a, b) => a + b, 0) / this.metrics.requests.duration.length
      : 0;
    
    const errorRate = this.metrics.requests.total > 0
      ? this.metrics.requests.error / this.metrics.requests.total
      : 0;

    const endpointsStats = Object.entries(this.metrics.endpoints).map(([key, data]) => ({
      endpoint: key,
      calls: data.calls,
      errors: data.errors,
      errorRate: data.calls > 0 ? (data.errors / data.calls * 100).toFixed(2) : 0,
      avgDuration: data.duration.length > 0 
        ? (data.duration.reduce((a, b) => a + b, 0) / data.duration.length).toFixed(2)
        : 0
    }));

    return {
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        error: this.metrics.requests.error,
        errorRate: (errorRate * 100).toFixed(2),
        avgDuration: durationAvg.toFixed(2)
      },
      endpoints: endpointsStats
    };
  }

  getAlerts() {
    return {
      current: this.alertsConfig,
      history: this.alertHistory.slice(-50),
      activeAlerts: this.alertHistory.filter(a => a.resolved === false).slice(-10)
    };
  }

  updateAlertsConfig(config) {
    this.alertsConfig = { ...this.alertsConfig, ...config };
    logger.info('Alerts config updated', { config: this.alertsConfig });
    return this.alertsConfig;
  }

  checkAlerts() {
    const systemMetrics = this.getSystemMetrics();
    const requestMetrics = this.getRequestMetrics();
    const alerts = [];

    if (parseFloat(systemMetrics.memory.usagePercent) > this.alertsConfig.memoryUsageThreshold * 100) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `内存使用率过高: ${systemMetrics.memory.usagePercent}%`,
        value: parseFloat(systemMetrics.memory.usagePercent),
        threshold: this.alertsConfig.memoryUsageThreshold * 100,
        timestamp: Date.now()
      });
    }

    if (parseFloat(systemMetrics.cpu.usagePercent) > this.alertsConfig.cpuUsageThreshold * 100) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `CPU 使用率过高: ${systemMetrics.cpu.usagePercent}%`,
        value: parseFloat(systemMetrics.cpu.usagePercent),
        threshold: this.alertsConfig.cpuUsageThreshold * 100,
        timestamp: Date.now()
      });
    }

    if (parseFloat(requestMetrics.requests.errorRate) > this.alertsConfig.errorRateThreshold * 100) {
      alerts.push({
        type: 'errorRate',
        severity: 'critical',
        message: `错误率过高: ${requestMetrics.requests.errorRate}%`,
        value: parseFloat(requestMetrics.requests.errorRate),
        threshold: this.alertsConfig.errorRateThreshold * 100,
        timestamp: Date.now()
      });
    }

    if (parseFloat(requestMetrics.requests.avgDuration) > this.alertsConfig.avgResponseTimeThreshold) {
      alerts.push({
        type: 'responseTime',
        severity: 'warning',
        message: `平均响应时间过长: ${requestMetrics.requests.avgDuration}ms`,
        value: parseFloat(requestMetrics.requests.avgDuration),
        threshold: this.alertsConfig.avgResponseTimeThreshold,
        timestamp: Date.now()
      });
    }

    alerts.forEach(alert => {
      logger.warn(`Alert triggered: ${alert.message}`, alert);
      this.alertHistory.push({ ...alert, resolved: false });
    });
  }

  resolveAlert(alertIndex) {
    if (this.alertHistory[alertIndex]) {
      this.alertHistory[alertIndex].resolved = true;
      this.alertHistory[alertIndex].resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  getHealthStatus() {
    const systemMetrics = this.getSystemMetrics();
    const requestMetrics = this.getRequestMetrics();
    const alerts = this.getAlerts();

    const criticalAlerts = alerts.activeAlerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.activeAlerts.filter(a => a.severity === 'warning');
    
    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (warningAlerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: Date.now(),
      systemMetrics,
      requestMetrics,
      activeAlerts: alerts.activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      warningAlerts: warningAlerts.length
    };
  }

  formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  }

  startMonitoring() {
    setInterval(() => {
      this.checkAlerts();
    }, 30000);
    logger.info('Observability service monitoring started');
  }

  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        duration: []
      },
      endpoints: {},
      alerts: []
    };
    logger.info('Metrics reset');
  }
}

module.exports = new ObservabilityService();
