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

router.put('/canvas/nodes/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  const { updates } = req.body;

  if (!updates) {
    return res.status(400).json({ success: false, error: 'Updates object is required' });
  }

  try {
    const node = await canvasSyncService.getNode(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const updatedNode = await canvasSyncService.updateNode(node.projectId, nodeId, updates);
    res.json({ success: true, node: updatedNode });
  } catch (error) {
    console.error('Node updates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/canvas/nodes/:nodeId', async (req, res) => {
  const { nodeId } = req.params;

  try {
    const node = await canvasSyncService.getNode(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    await canvasSyncService.deleteNode(node.projectId, nodeId);
    res.json({ success: true, nodeId });
  } catch (error) {
    console.error('Node deletion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/canvas/nodes', async (req, res) => {
  const { projectId, type, data, position } = req.body;

  if (!projectId || !type) {
    return res.status(400).json({ success: false, error: 'Project ID and node type are required' });
  }

  try {
    let node;
    if (type === 'scene') {
      node = await canvasSyncService.createSceneNodeDirectly(projectId, data || {}, position);
    } else {
      node = await canvasSyncService.createNode(projectId, type, data || {}, position || { x: 100, y: 100 });
    }
    res.json({ success: true, node });
  } catch (error) {
    console.error('Node creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/canvas/generate-scene-video', async (req, res) => {
  const { projectId, sceneId, scene } = req.body;

  if (!projectId || !sceneId || !scene) {
    return res.status(400).json({ success: false, error: 'Project ID, scene ID, and scene data are required' });
  }

  // 1. Send the HTTP response immediately to prevent timeout, and run rendering in background
  res.json({ success: true, message: '视频生成任务已在后台启动' });

  (async () => {
    const webSocketService = require('../services/webSocketService');
    const videoAgent = require('../agents/videoAgent');

    // Broadcast starting status
    webSocketService.broadcast(projectId, {
      type: 'operation_progress',
      operationNodeId: `scene_${sceneId}`,
      progress: 0,
      stepId: `scene_${sceneId}_render`,
      status: 'executing'
    });

    try {
      // Direct scene update status on canvas
      await canvasSyncService.updateNode(projectId, `scene_${sceneId}`, { status: 'generating' });

      const result = await videoAgent.generateScene(scene, {
        projectId,
        sceneIndex: sceneId - 1,
        resolution: '720p',
        ratio: '9:16'
      }, (progress) => {
        // Broadcast rendering progress in real-time!
        webSocketService.broadcast(projectId, {
          type: 'operation_progress',
          operationNodeId: `scene_${sceneId}`,
          progress: progress.progress || 0,
          stepId: `scene_${sceneId}_render`,
          status: 'executing'
        });
      });

      // Update node data with final video url and status completed
      if (result && result.videoUrl) {
        await canvasSyncService.updateNode(projectId, `scene_${sceneId}`, {
          videoUrl: result.videoUrl,
          status: 'completed'
        });
      } else {
        throw new Error('视频渲染成功，但未返回有效的视频 URL');
      }

      webSocketService.broadcast(projectId, {
        type: 'operation_progress',
        operationNodeId: `scene_${sceneId}`,
        progress: 100,
        stepId: `scene_${sceneId}_render`,
        status: 'completed'
      });

    } catch (error) {
      console.error(`❌ Canvas SceneNode ${sceneId} Video rendering failed:`, error.message);
      
      await canvasSyncService.updateNode(projectId, `scene_${sceneId}`, {
        status: 'failed',
        error: error.message
      });

      webSocketService.broadcast(projectId, {
        type: 'operation_progress',
        operationNodeId: `scene_${sceneId}`,
        progress: 0,
        stepId: `scene_${sceneId}_render`,
        status: 'failed',
        error: error.message
      });
    }
  })();
});

module.exports = router;
