const WebSocket = require('ws');
const url = require('url');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.projectClients = new Map(); // projectId -> Set of ws client sockets
  }

  init(server) {
    console.log('🔌 WebSocketService: Initializing WebSocket Server...');
    this.wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;
      
      // Matches /ws/canvas/:projectId
      const match = pathname.match(/^\/ws\/canvas\/([^/]+)$/);
      
      if (match) {
        const projectId = match[1];
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, projectId);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws, request, projectId) => {
      console.log(`📡 WebSocket: Client connected for project "${projectId}"`);
      
      if (!this.projectClients.has(projectId)) {
        this.projectClients.set(projectId, new Set());
      }
      this.projectClients.get(projectId).add(ws);

      ws.on('close', () => {
        const clients = this.projectClients.get(projectId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            this.projectClients.delete(projectId);
          }
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket Error for project "${projectId}":`, error.message);
        ws.close();
      });
    });

    // Listen to MasterAgent events
    try {
      const masterAgent = require('../agents/masterAgent');
      masterAgent.on('operationProgress', ({ projectId, operationNodeId, progress, stepId }) => {
        this.broadcast(projectId, {
          type: 'operation_progress',
          operationNodeId,
          progress,
          stepId
        });
      });
    } catch (err) {
      console.error('❌ WebSocketService: Failed to bind MasterAgent events:', err.message);
    }
  }

  broadcast(projectId, event) {
    const clients = this.projectClients.get(projectId);
    if (!clients || clients.size === 0) {
      return;
    }
    
    const message = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (sendErr) {
          console.error(`❌ WebSocketService: Failed to send message to a client:`, sendErr.message);
        }
      }
    }
  }
}

module.exports = new WebSocketService();
