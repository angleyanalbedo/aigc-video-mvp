const express = require('express');
const router = express.Router();
const observabilityService = require('../services/observabilityService');
const { logger } = require('../utils/logger');

router.get('/health', (req, res) => {
  try {
    const healthStatus = observabilityService.getHealthStatus();
    res.json({ success: true, data: healthStatus });
  } catch (error) {
    logger.error('Failed to get health status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/system', (req, res) => {
  try {
    const metrics = observabilityService.getSystemMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to get system metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/requests', (req, res) => {
  try {
    const metrics = observabilityService.getRequestMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to get request metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alerts', (req, res) => {
  try {
    const alerts = observabilityService.getAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Failed to get alerts', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/alerts/config', (req, res) => {
  try {
    const config = req.body;
    const updatedConfig = observabilityService.updateAlertsConfig(config);
    res.json({ success: true, data: updatedConfig });
  } catch (error) {
    logger.error('Failed to update alerts config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alerts/:index/resolve', (req, res) => {
  try {
    const { index } = req.params;
    const resolved = observabilityService.resolveAlert(parseInt(index));
    if (resolved) {
      res.json({ success: true, message: 'Alert resolved' });
    } else {
      res.status(404).json({ success: false, error: 'Alert not found' });
    }
  } catch (error) {
    logger.error('Failed to resolve alert', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/metrics/reset', (req, res) => {
  try {
    observabilityService.resetMetrics();
    res.json({ success: true, message: 'Metrics reset successfully' });
  } catch (error) {
    logger.error('Failed to reset metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
