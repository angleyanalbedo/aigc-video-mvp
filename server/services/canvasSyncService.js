const db = require('../db');

class CanvasSyncService {
  constructor() {
    this.eventEmitter = null;
  }

  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  // ─────────────────────────────────────────────────────────
  // 节点操作
  // ─────────────────────────────────────────────────────────

  async createNode(projectId, nodeType, nodeData, position, style = {}, customNodeId = null) {
    const nodeId = customNodeId || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO canvas_nodes
      (id, project_id, node_type, node_data, position_x, position_y, style)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nodeId,
      projectId,
      nodeType,
      JSON.stringify(nodeData),
      position.x,
      position.y,
      JSON.stringify(style)
    );

    const node = {
      id: nodeId,
      projectId,
      type: nodeType,
      data: nodeData,
      position,
      style
    };

    this.broadcast(projectId, {
      type: 'node_created',
      node
    });

    return node;
  }

  async updateNode(projectId, nodeId, updates) {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`节点不存在: ${nodeId}`);
    }

    // Filter out columns from data updates if they are stored in columns
    const { position, size, style, metadata, ...dataUpdates } = updates;
    const newData = { ...node.data, ...dataUpdates };

    let query = 'UPDATE canvas_nodes SET node_data = ?, updated_at = ?';
    const params = [JSON.stringify(newData), new Date().toISOString()];

    if (position) {
      query += ', position_x = ?, position_y = ?';
      params.push(position.x, position.y);
    }
    if (size) {
      query += ', width = ?, height = ?';
      params.push(size.width, size.height);
    }
    if (style) {
      query += ', style = ?';
      params.push(JSON.stringify(style));
    }
    if (metadata) {
      query += ', metadata = ?';
      params.push(JSON.stringify(metadata));
    }

    query += ' WHERE id = ?';
    params.push(node.id);

    db.prepare(query).run(...params);

    // If it's a scene node, sync back to projects.script.scenes
    if (node.type === 'scene' && node.data.id) {
      try {
        const projectModel = require('../models/project');
        const project = await projectModel.getById(projectId);
        if (project && project.script) {
          const script = project.script;
          if (script.scenes) {
            const idx = script.scenes.findIndex(s => s.id === node.data.id);
            if (idx >= 0) {
              script.scenes[idx] = { ...script.scenes[idx], ...updates };
              await projectModel.update(projectId, { script });
              console.log(`✅ Synced Canvas SceneNode ${node.data.id} update back to projects.script!`);
            }
          }
        }
      } catch (err) {
        console.error('⚠️ Failed to sync SceneNode update to projects:', err.message);
      }
    }

    const updatedNode = { ...node, data: newData };
    this.broadcast(projectId, {
      type: 'node_updated',
      nodeId: node.id,
      updates,
      newData
    });

    return updatedNode;
  }

  async deleteNode(projectId, nodeId) {
    const node = await this.getNode(nodeId);
    if (!node) return false;

    db.prepare(`
      DELETE FROM canvas_connections
      WHERE source_node_id = ? OR target_node_id = ?
    `).run(node.id, node.id);

    db.prepare('DELETE FROM canvas_nodes WHERE id = ?').run(node.id);

    // If it's a scene node, sync back deletion and re-index remaining scenes!
    if (node.type === 'scene' && node.data.id) {
      try {
        const projectModel = require('../models/project');
        const project = await projectModel.getById(projectId);
        if (project && project.script) {
          const script = project.script;
          if (script.scenes) {
            script.scenes = script.scenes.filter(s => s.id !== node.data.id);
            // Re-index remaining scenes 1, 2, 3...
            script.scenes.forEach((s, index) => {
              s.id = index + 1;
              if (s.sceneId) s.sceneId = index + 1;
            });
            await projectModel.update(projectId, { script });
            console.log(`✅ Synced Canvas SceneNode ${node.data.id} deletion and re-indexing back to projects.script!`);
          }
        }
      } catch (err) {
        console.error('⚠️ Failed to sync SceneNode deletion to projects:', err.message);
      }
    }

    this.broadcast(projectId, {
      type: 'node_deleted',
      nodeId: node.id
    });

    return true;
  }

  async getNode(nodeId) {
    let row = db.prepare('SELECT * FROM canvas_nodes WHERE id = ?').get(nodeId);
    if (!row && typeof nodeId === 'string' && nodeId.startsWith('scene_')) {
      const sceneIdVal = parseInt(nodeId.split('_')[1], 10);
      if (!isNaN(sceneIdVal)) {
        // Search by scene id in node_data
        const rows = db.prepare("SELECT * FROM canvas_nodes WHERE node_type = 'scene'").all();
        row = rows.find(r => {
          try {
            const data = JSON.parse(r.node_data);
            return data.id === sceneIdVal || data.sceneId === sceneIdVal;
          } catch {
            return false;
          }
        });
      }
    }
    if (!row) return null;

    return this.parseNode(row);
  }

  async ensureCanvasInitialized(projectId) {
    try {
      const countRow = db.prepare(
        'SELECT COUNT(*) as count FROM canvas_nodes WHERE project_id = ?'
      ).get(projectId);

      if (countRow && countRow.count > 0) {
        return; // Already initialized
      }

      const projectModel = require('../models/project');
      const project = await projectModel.getById(projectId);
      if (project && project.script && project.script.scenes && project.script.scenes.length > 0) {
        console.log(`🤖 Auto-initializing canvas nodes from project script for project: ${projectId}`);
        await this.syncScriptToCanvas(projectId, project.script);
      }
    } catch (err) {
      console.error('⚠️ Failed to auto-initialize canvas nodes:', err.message);
    }
  }

  async getNodes(projectId, skipInit = false) {
    if (!skipInit) {
      await this.ensureCanvasInitialized(projectId);
    }
    const rows = db.prepare(
      'SELECT * FROM canvas_nodes WHERE project_id = ? ORDER BY created_at'
    ).all(projectId);

    return rows.map(row => this.parseNode(row));
  }

  parseNode(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.node_type,
      data: JSON.parse(row.node_data),
      position: { x: row.position_x, y: row.position_y },
      size: { width: row.width, height: row.height },
      style: row.style ? JSON.parse(row.style) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ─────────────────────────────────────────────────────────
  // 连接线操作
  // ─────────────────────────────────────────────────────────

  async createConnection(projectId, sourceNodeId, targetNodeId, connectionType, options = {}) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO canvas_connections
      (id, project_id, source_node_id, target_node_id, connection_type, label, style)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      connectionId,
      projectId,
      sourceNodeId,
      targetNodeId,
      connectionType,
      options.label || null,
      JSON.stringify(options.style || {})
    );

    const connection = {
      id: connectionId,
      projectId,
      sourceNodeId,
      targetNodeId,
      connectionType,
      label: options.label,
      style: options.style
    };

    this.broadcast(projectId, {
      type: 'connection_created',
      connection
    });

    return connection;
  }

  async getConnections(projectId, skipInit = false) {
    if (!skipInit) {
      await this.ensureCanvasInitialized(projectId);
    }
    const rows = db.prepare(
      'SELECT * FROM canvas_connections WHERE project_id = ?'
    ).all(projectId);

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      connectionType: row.connection_type,
      label: row.label,
      style: row.style ? JSON.parse(row.style) : {}
    }));
  }

  // ─────────────────────────────────────────────────────────
  // Agent 特定操作
  // ─────────────────────────────────────────────────────────

  async createIntentAndPlan(projectId, intent, plan, sessionId) {
    // 根据用户需求：intent 和 plan 不再显示在画布上
    // Agent 内部理解用户意图并生成执行计划，但不创建节点
    // 只返回计划信息供 Agent 内部使用
    
    console.log(`🤖 Agent 理解用户意图: ${intent.primaryIntent}`);
    console.log(`📋 Agent 生成执行计划: ${plan.steps.length} 个步骤`);

    return {
      intentNodeId: null,
      planNodeId: null,
      operationNodeIds: []
    };
  }

  async updatePlanStatus(planNodeId, status) {
    // 不再更新画布上的 plan 节点
    console.log(`📋 Plan status updated (internal): ${status}`);
  }

  async updateStepStatus(planNodeId, stepId, status, result = null, error = null) {
    // 不再更新画布上的 step 状态
    console.log(`📋 Step ${stepId} status: ${status}`);
  }

  async createOperationNode(projectId, step, parentPlanId) {
    // 不再创建 operation 节点到画布
    console.log(`⚙️ Operation node would be created (not displayed): ${step.type}`);
    return null;
  }

  async updateOperationNode(operationNodeId, updates) {
    // 不再更新画布上的 operation 节点
    console.log(`⚙️ Operation node updated (internal):`, updates);
  }

  // ─────────────────────────────────────────────────────────
  // 业务表同步
  // ─────────────────────────────────────────────────────────

  async syncScriptToCanvas(projectId, script) {
    const existingNodes = await this.getNodes(projectId, true);
    const existingScriptNodes = existingNodes.filter(n => n.type === 'script');

    let scriptNodeId;

    if (existingScriptNodes.length > 0) {
      scriptNodeId = existingScriptNodes[0].id;
      await this.updateNode(projectId, scriptNodeId, script);
    } else {
      const scriptNode = await this.createNode(
        projectId,
        'script',
        script,
        { x: 50, y: 50 }
      );
      scriptNodeId = scriptNode.id;
    }

    const existingSceneNodes = existingNodes.filter(n => n.type === 'scene');

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const sceneNodeId = `scene_${scene.id}`;

      const existingNode = existingSceneNodes.find(n => 
        n.id === sceneNodeId || n.data.id === scene.id || n.data.sceneId === scene.id
      );

      if (existingNode) {
        await this.updateNode(projectId, existingNode.id, scene);
      } else {
        const sceneNode = await this.createNode(
          projectId,
          'scene',
          scene,
          { x: 350, y: 50 + i * 180 },
          {},
          sceneNodeId
        );

        await this.createConnection(
          projectId,
          scriptNodeId,
          sceneNode.id,
          'timeline'
        );
      }
    }

    const existingVideoNodes = existingNodes.filter(n => n.type === 'video');
    let videoNodeId;

    if (existingVideoNodes.length === 0) {
      const videoNode = await this.createNode(
        projectId,
        'video',
        {
          title: '最终合成成片',
          description: '将所有分镜视频与背景音乐合成最终商业短视频',
          status: 'idle',
          videoUrl: null
        },
        { x: 680, y: 50 }
      );
      videoNodeId = videoNode.id;

      for (let i = 0; i < script.scenes.length; i++) {
        const resolvedSceneNode = await this.getNode(`scene_${script.scenes[i].id}`);
        const actualSceneNodeId = resolvedSceneNode ? resolvedSceneNode.id : `scene_${script.scenes[i].id}`;
        await this.createConnection(
          projectId,
          actualSceneNodeId,
          videoNodeId,
          'dependency'
        );
      }
    } else {
      videoNodeId = existingVideoNodes[0].id;
    }

    return scriptNodeId;
  }

  // ─────────────────────────────────────────────────────────
  // 实时推送
  // ─────────────────────────────────────────────────────────

  broadcast(projectId, event) {
    try {
      const webSocketService = require('./webSocketService');
      webSocketService.broadcast(projectId, event);
    } catch (wsErr) {
      console.warn('⚠️ WebSocket Broadcast error:', wsErr.message);
    }

    if (this.eventEmitter) {
      try {
        if (typeof this.eventEmitter.to === 'function') {
          this.eventEmitter.to(`canvas:${projectId}`).emit('canvasEvent', event);
        } else {
          console.log('📡 Broadcast (Socket.io not configured):', event.type, projectId);
        }
      } catch (error) {
        console.error('Broadcast error:', error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 聊天会话管理
  // ─────────────────────────────────────────────────────────

  async createChatSession(projectId, title = '新会话') {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO chat_sessions (id, project_id, title)
      VALUES (?, ?, ?)
    `).run(sessionId, projectId, title);

    return sessionId;
  }

  async addChatMessage(sessionId, role, messageType, content, metadata = {}) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, message_type, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      sessionId,
      role,
      messageType,
      content,
      JSON.stringify(metadata)
    );

    // Broadcast chat message created event
    try {
      const session = db.prepare('SELECT project_id FROM chat_sessions WHERE id = ?').get(sessionId);
      if (session) {
        const projectId = session.project_id;
        const message = {
          id: messageId,
          role,
          messageType,
          content,
          metadata,
          createdAt: Date.now()
        };
        this.broadcast(projectId, {
          type: 'chat_message_created',
          message
        });
      }
    } catch (broadcastErr) {
      console.warn('⚠️ Failed to broadcast chat message over WebSocket:', broadcastErr.message);
    }

    return messageId;
  }

  async getChatHistory(sessionId) {
    const rows = db.prepare(`
      SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC
    `).all(sessionId);

    return rows.map(row => ({
      id: row.id,
      role: row.role,
      messageType: row.message_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at
    }));
  }

  async createSceneNodeDirectly(projectId, sceneData, position) {
    const projectModel = require('../models/project');
    const project = await projectModel.getById(projectId);
    let script = project.script || { title: '未命名剧本', scenes: [] };
    if (!script.scenes) script.scenes = [];

    const newSceneId = script.scenes.length + 1;
    const newScene = {
      id: newSceneId,
      sceneId: newSceneId,
      description: sceneData.description || '新分镜描述',
      voiceover: sceneData.voiceover || '新旁白文案',
      duration: Number(sceneData.duration) || 3,
      shot_type: sceneData.shot_type || '中景',
      emotion: sceneData.emotion || '积极',
      transition: sceneData.transition || 'fade',
      status: 'idle',
      videoUrl: null,
      audioUrl: null
    };

    script.scenes.push(newScene);
    await projectModel.update(projectId, { script });

    const sceneNode = await this.createNode(
      projectId,
      'scene',
      newScene,
      position || { x: 350, y: 50 + (newSceneId - 1) * 180 },
      {},
      `scene_${newSceneId}`
    );

    const scriptNode = (await this.getNodes(projectId)).find(n => n.type === 'script');
    if (scriptNode) {
      await this.createConnection(projectId, scriptNode.id, sceneNode.id, 'timeline');
    }

    return sceneNode;
  }
}

module.exports = new CanvasSyncService();
