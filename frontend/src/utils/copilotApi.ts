const API_BASE = '/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'plan_confirmation' | 'operation_log' | 'error';
  content: string;
  timestamp: number;
  metadata?: any;
}

export interface Node {
  id: string;
  type: 'script' | 'scene' | 'material' | 'video' | 'intent' | 'plan' | 'operation';
  data: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: any;
  createdAt: number;
  updatedAt: number;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  connectionType: string;
  label?: string;
  style?: any;
}

export interface Plan {
  steps: Array<{
    stepId: string;
    type: string;
    agent: string;
    description: string;
    status?: string;
  }>;
  description: string;
  estimatedDuration: number;
}

export async function sendMessage(
  projectId: string,
  message: string,
  sessionId?: string,
  metadata?: any
): Promise<{
  success: boolean;
  type: 'plan_confirmation' | 'completed' | 'error';
  message?: string;
  intentNodeId?: string;
  planNodeId?: string;
  sessionId?: string;
  plan?: Plan;
  estimatedDuration?: number;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      projectId,
      sessionId,
      metadata
    })
  });
  return response.json();
}

export async function executePlan(
  planNodeId: string,
  projectId: string,
  sessionId?: string
): Promise<{
  success: boolean;
  results: any[];
  summary?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planNodeId,
      projectId,
      sessionId
    })
  });
  return response.json();
}

export async function cancelPlan(
  planNodeId: string,
  projectId: string,
  sessionId?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planNodeId,
      projectId,
      sessionId
    })
  });
  return response.json();
}

export async function getNodes(projectId: string): Promise<{
  success: boolean;
  nodes: Node[];
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/nodes/${projectId}`);
  return response.json();
}

export async function getConnections(projectId: string): Promise<{
  success: boolean;
  connections: Connection[];
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/connections/${projectId}`);
  return response.json();
}

export async function createConnection(
  projectId: string,
  sourceNodeId: string,
  targetNodeId: string,
  connectionType: string = 'dependency'
): Promise<{
  success: boolean;
  connection?: Connection;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourceNodeId, targetNodeId, connectionType })
  });
  return response.json();
}

export async function updateNodePosition(
  nodeId: string,
  position: { x: number; y: number }
): Promise<{
  success: boolean;
  nodeId?: string;
  position?: { x: number; y: number };
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/nodes/${nodeId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(position)
  });
  return response.json();
}

export async function getChatHistory(sessionId: string): Promise<{
  success: boolean;
  messages: Message[];
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/chat/sessions/${sessionId}/messages`);
  return response.json();
}

export async function createChatSession(projectId: string, title?: string): Promise<{
  success: boolean;
  sessionId: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, title })
  });
  return response.json();
}

export async function updateNodeData(
  nodeId: string,
  updates: any
): Promise<{
  success: boolean;
  node?: Node;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates })
  });
  return response.json();
}

export async function deleteNodeDirectly(
  nodeId: string
): Promise<{
  success: boolean;
  nodeId?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/nodes/${nodeId}`, {
    method: 'DELETE'
  });
  return response.json();
}

export async function createNodeDirectly(
  projectId: string,
  type: string,
  data?: any,
  position?: { x: number; y: number }
): Promise<{
  success: boolean;
  node?: Node;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, type, data, position })
  });
  return response.json();
}

export async function generateSceneVideo(
  projectId: string,
  sceneId: number,
  scene: any
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/canvas/generate-scene-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sceneId, scene })
  });
  return response.json();
}

export function connectWebSocket(
  projectId: string,
  handlers: {
    onCanvasEvent?: (event: any) => void;
    onOperationProgress?: (progress: any) => void;
    onChatMessage?: (message: Message) => void;
    onError?: (error: any) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/canvas/${projectId}`;
  
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    handlers.onConnected?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type?.startsWith('node_') || data.type?.startsWith('connection_')) {
        handlers.onCanvasEvent?.(data);
      } else if (data.type === 'operation_progress') {
        handlers.onOperationProgress?.(data);
      } else if (data.type === 'chat_message_created' && data.message) {
        handlers.onChatMessage?.(data.message);
      }
    } catch (e) {
      console.error('❌ WebSocket message parse error:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    handlers.onError?.(error);
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected');
    handlers.onDisconnected?.();
  };

  return ws;
}

export async function getChatSessions(projectId: string): Promise<{
  success: boolean;
  sessions: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/copilot/chat/sessions/${projectId}`);
  return response.json();
}
