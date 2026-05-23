const express = require('express');
const router = express.Router();

const { masterAgent } = require('../agents');
const canvasSyncService = require('../services/canvasSyncService');
const projectModel = require('../models/project');

router.post('/chat', async (req, res) => {
  const { message, projectId, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  try {
    const project = projectModel.getById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const result = await masterAgent.processMessage(message, projectId, { sessionId });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('MasterAgent chat endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/execute', async (req, res) => {
  const { planNodeId, projectId, sessionId } = req.body;

  if (!planNodeId) {
    return res.status(400).json({ success: false, error: 'Plan node ID is required' });
  }

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  try {
    const project = projectModel.getById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const result = await masterAgent.executeConfirmedPlan(planNodeId, projectId, sessionId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('MasterAgent execute endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cancel', async (req, res) => {
  const { planNodeId, projectId, sessionId } = req.body;

  if (!planNodeId) {
    return res.status(400).json({ success: false, error: 'Plan node ID is required' });
  }

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  try {
    const result = await masterAgent.cancelPlan(planNodeId, projectId, sessionId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('MasterAgent cancel endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/canvas/nodes/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const nodes = await canvasSyncService.getNodes(projectId);
    res.json({ success: true, nodes });
  } catch (error) {
    console.error('Canvas nodes endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/canvas/connections/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const connections = await canvasSyncService.getConnections(projectId);
    res.json({ success: true, connections });
  } catch (error) {
    console.error('Canvas connections endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/canvas/nodes/:nodeId/position', async (req, res) => {
  const { nodeId } = req.params;
  const { x, y } = req.body;

  if (x === undefined || y === undefined) {
    return res.status(400).json({ success: false, error: 'Position (x, y) is required' });
  }

  try {
    const node = await canvasSyncService.getNode(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    await canvasSyncService.updateNode(node.projectId, nodeId, { position: { x, y } });

    res.json({ success: true, nodeId, position: { x, y } });
  } catch (error) {
    console.error('Node position update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/chat/sessions/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const db = require('../db');
    const sessions = await db.all(
      'SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC',
      [projectId]
    );

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Chat sessions endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/chat/sessions/:sessionId/messages', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const messages = await canvasSyncService.getChatHistory(sessionId);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Chat messages endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/chat/sessions', async (req, res) => {
  const { projectId, title } = req.body;

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  try {
    const sessionId = await canvasSyncService.createChatSession(projectId, title || '新会话');
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Create chat session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
