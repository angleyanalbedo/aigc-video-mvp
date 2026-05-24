// Canvas Sync Service - Manages synchronization between canvas nodes and project data
const db = require('../db');

class CanvasSyncService {
  constructor() {
    this.eventEmitter = null;
  }

  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  // Node CRUD
  async createNode(projectId, nodeType, data, position = { x: 0, y: 0 }) {
    const id = `${nodeType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO canvas_nodes (id, project_id, node_type, node_data, position_x, position_y, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, nodeType, JSON.stringify(data), position.x, position.y, new Date().toISOString(), new Date().toISOString());

    const node = await this.getNode(id);
    this.broadcast(projectId, {
      type: 'node_created',
      node,
      projectId
    });
    return node;
  }

  async getNode(nodeId) {
    let row = db.prepare('SELECT * FROM canvas_nodes WHERE id = ?').get(nodeId);
    if (!row) return null;
    return this.parseNode(row);
  }

  async getNodes(projectId, nodeType = null) {
    let query = 'SELECT * FROM canvas_nodes WHERE project_id = ?';
    const params = [projectId];
    
    if (nodeType) {
      query += ' AND node_type = ?';
      params.push(nodeType);
    }
    
    const rows = db.prepare(query).all(...params);
    return rows.map(row => this.parseNode(row));
  }

  parseNode(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.node_type,
      data: JSON.parse(row.node_data),
      position: { x: row.position_x, y: row.position_y },
      width: row.width,
      height: row.height,
      style: row.style ? JSON.parse(row.style) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateNode(projectId, nodeId, updates) {
    const node = await this.getNode(nodeId);
    if (!node) return null;

    const newData = { ...node.data, ...updates };
    
    db.prepare(`
      UPDATE canvas_nodes 
      SET node_data = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(newData), new Date().toISOString(), nodeId);

    // Sync scene updates back to projects.script
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

  async ensureCanvasInitialized(projectId) {
    try {
      const countRow = db.prepare(
        'SELECT COUNT(*) as count FROM canvas_nodes WHERE project_id = ?'
      ).get(projectId);

      if (countRow && countRow.count > 0) {
        return; // Already initialized
      }
    } catch (err) {
      console.error('⚠️ Failed to check canvas initialization:', err.message);
    }
  }

  // Connections
  async createConnection(projectId, sourceNodeId, targetNodeId, connectionType = 'dependency') {
    const connId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO canvas_connections (id, project_id, source_node_id, target_node_id, connection_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(connId, projectId, sourceNodeId, targetNodeId, connectionType, new Date().toISOString());

    const connection = {
      id: connId,
      projectId,
      sourceNodeId,
      targetNodeId,
      type: connectionType
    };

    this.broadcast(projectId, {
      type: 'connection_created',
      connection
    });

    return connection;
  }

  async getConnections(projectId) {
    const rows = db.prepare(`
      SELECT * FROM canvas_connections 
      WHERE project_id = ?
    `).all(projectId);
    
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      type: row.connection_type,
      label: row.label,
      style: row.style ? JSON.parse(row.style) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at
    }));
  }

  async deleteConnection(projectId, connectionId) {
    db.prepare('DELETE FROM canvas_connections WHERE id = ?').run(connectionId);

    this.broadcast(projectId, {
      type: 'connection_deleted',
      connectionId
    });

    return true;
  }

  // Sync Script to Canvas
  async syncScriptToCanvas(projectId, script) {
    if (!script || !script.scenes) return;

    const existingNodes = await this.getNodes(projectId, 'scene');
    const existingIds = new Set(existingNodes.map(n => n.data.id));
    const scriptSceneIds = new Set(script.scenes.map(s => s.id));

    // Add new scenes
    for (const scene of script.scenes) {
      if (!existingIds.has(scene.id)) {
        const yPos = 100 + (scene.id - 1) * 180;
        await this.createNode(projectId, 'scene', {
          id: scene.id,
          title: `分镜 ${scene.id}`,
          description: scene.description || '',
          voiceover: scene.voiceover || '',
          duration: scene.duration || 5,
          shot_type: scene.shot_type || '中景',
          status: scene.status || 'idle'
        }, { x: 400, y: yPos });

        // Connect to script node if exists
        const scriptNode = await this.getNodes(projectId, 'script');
        if (scriptNode.length > 0) {
          await this.createConnection(projectId, scriptNode[0].id, `scene_${scene.id}`, 'timeline');
        }
      }
    }

    // Ensure video node exists
    const videoNodes = await this.getNodes(projectId, 'video');
    if (videoNodes.length === 0) {
      await this.createNode(projectId, 'video', {
        title: '最终成片',
        description: '将所有分镜视频与背景音乐合成最终商业短视频',
        status: 'idle',
        videoUrl: null
      }, { x: 680, y: 50 });

      // Connect all scenes to video node
      const sceneNodes = await this.getNodes(projectId, 'scene');
      const videoNode = (await this.getNodes(projectId, 'video'))[0];
      if (videoNode) {
        for (const sceneNode of sceneNodes) {
          await this.createConnection(projectId, sceneNode.id, videoNode.id, 'dependency');
        }
      }
    }
  }

  // Broadcast events
  broadcast(projectId, event) {
    try {
      const webSocketService = require('./webSocketService');
      webSocketService.broadcast(projectId, event);
    } catch (wsErr) {
      // WebSocket service not available, ignore
    }

    if (this.eventEmitter) {
      try {
        if (typeof this.eventEmitter.to === 'function') {
          this.eventEmitter.to(`canvas:${projectId}`).emit('canvasEvent', event);
        }
      } catch (error) {
        // Socket.io not configured, ignore
      }
    }
  }

  // Chat Session Management
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

    return messageId;
  }

  async getChatMessages(sessionId) {
    const rows = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId);
    
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      type: row.message_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at
    }));
  }

  async getChatSessions(projectId) {
    const rows = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId);
    
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

module.exports = new CanvasSyncService();
