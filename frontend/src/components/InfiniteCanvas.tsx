import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Slider, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import {
  getNodes,
  getConnections,
  updateNodePosition,
  connectWebSocket,
  type Node,
  type Connection
} from '../utils/copilotApi';
import './InfiniteCanvas.css';

interface InfiniteCanvasProps {
  projectId: string;
}

const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({ projectId }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
  const [nodeStartPosition, setNodeStartPosition] = useState({ x: 0, y: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const loadCanvas = async () => {
      const [nodesResult, connectionsResult] = await Promise.all([
        getNodes(projectId),
        getConnections(projectId)
      ]);

      if (nodesResult.success) {
        setNodes(nodesResult.nodes);
      }
      if (connectionsResult.success) {
        setConnections(connectionsResult.connections);
      }
    };

    loadCanvas();

    // WebSocket 连接
    wsRef.current = connectWebSocket(projectId, {
      onCanvasEvent: (event) => {
        if (event.type === 'node_created' && event.node) {
          setNodes(prev => [...prev, event.node]);
        } else if (event.type === 'node_updated' && event.nodeId) {
          setNodes(prev => prev.map(n =>
            n.id === event.nodeId ? { ...n, data: { ...n.data, ...event.updates } } : n
          ));
        } else if (event.type === 'node_deleted' && event.nodeId) {
          setNodes(prev => prev.filter(n => n.id !== event.nodeId));
          setConnections(prev => prev.filter(c =>
            c.sourceNodeId !== event.nodeId && c.targetNodeId !== event.nodeId
          ));
        } else if (event.type === 'connection_created' && event.connection) {
          setConnections(prev => [...prev, event.connection]);
        }
      },
      onConnected: () => console.log('✅ Canvas WebSocket connected'),
      onDisconnected: () => console.log('🔌 Canvas WebSocket disconnected')
    });

    return () => {
      wsRef.current?.close();
    };
  }, [projectId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, viewport.scale * delta));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport(prev => ({
      x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
      y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
      scale: newScale
    }));
  }, [viewport]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - viewport.x,
        y: e.clientY - viewport.y
      });
      setSelectedNodeId(null);
    }
  }, [viewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    } else if (isDraggingNode && draggingNodeId) {
      const dx = (e.clientX - nodeDragStart.x) / viewport.scale;
      const dy = (e.clientY - nodeDragStart.y) / viewport.scale;

      const newPosition = {
        x: nodeStartPosition.x + dx,
        y: nodeStartPosition.y + dy
      };

      setNodes(prev => prev.map(n =>
        n.id === draggingNodeId ? { ...n, position: newPosition } : n
      ));
    }
  }, [isDragging, dragStart, isDraggingNode, draggingNodeId, nodeDragStart, nodeStartPosition, viewport]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingNode && draggingNodeId) {
      const node = nodes.find(n => n.id === draggingNodeId);
      if (node) {
        updateNodePosition(draggingNodeId, node.position);
      }
    }
    setIsDragging(false);
    setIsDraggingNode(false);
    setDraggingNodeId(null);
  }, [isDraggingNode, draggingNodeId, nodes]);

  const resetViewport = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  const handleScaleChange = (value: number) => {
    const centerX = (window.innerWidth / 2);
    const centerY = (window.innerHeight / 2);
    
    setViewport(prev => ({
      x: centerX - (centerX - prev.x) * (value / prev.scale),
      y: centerY - (centerY - prev.y) * (value / prev.scale),
      scale: value
    }));
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setIsDraggingNode(true);
    setDraggingNodeId(node.id);
    setNodeDragStart({ x: e.clientX, y: e.clientY });
    setNodeStartPosition({ ...node.position });
  };

  const getNodeColor = (type: Node['type']) => {
    const colors = {
      script: { border: '#722ed1', bg: '#f9f0ff' },
      scene: { border: '#1890ff', bg: '#e6f7ff' },
      material: { border: '#fa8c16', bg: '#fffaf0' },
      video: { border: '#eb2f96', bg: '#fff0f5' },
      intent: { border: '#1890ff', bg: '#e6f7ff' },
      plan: { border: '#faad14', bg: '#fffbe6' },
      operation: { border: '#52c41a', bg: '#f6ffed' }
    };
    return colors[type] || colors.scene;
  };

  const getNodeTitle = (node: Node) => {
    switch (node.type) {
      case 'intent':
        return '意图';
      case 'plan':
        return '计划';
      case 'operation':
        return '操作';
      case 'script':
        return '剧本';
      case 'scene':
        return `分镜 ${node.data.sceneId || 0}`;
      case 'material':
        return node.data.filename || '素材';
      case 'video':
        return '视频';
      default:
        return node.type;
    }
  };

  const getNodeContent = (node: Node) => {
    switch (node.type) {
      case 'intent':
        return node.data.originalMessage?.slice(0, 50) || '...';
      case 'plan':
        return node.data.description || '计划';
      case 'operation':
        return node.data.description || '操作';
      case 'script':
        return node.data.title || '剧本';
      case 'scene':
        return node.data.description?.slice(0, 40) || '分镜';
      case 'material':
        return node.data.filename || '素材';
      case 'video':
        return `视频 ${node.data.duration}秒`;
      default:
        return node.type;
    }
  };

  const getConnectionPath = (conn: Connection) => {
    const source = nodes.find(n => n.id === conn.sourceNodeId);
    const target = nodes.find(n => n.id === conn.targetNodeId);
    if (!source || !target) return '';

    const x1 = source.position.x + source.size.width / 2;
    const y1 = source.position.y + source.size.height;
    const x2 = target.position.x + target.size.width / 2;
    const y2 = target.position.y;

    const cpY1 = y1 + Math.abs(y2 - y1) / 2;
    const cpY2 = y2 - Math.abs(y2 - y1) / 2;

    return `M ${x1} ${y1} C ${x1} ${cpY1}, ${x2} ${cpY2}, ${x2} ${y2}`;
  };

  const getConnectionColor = (type: string) => {
    const colors = {
      timeline: '#8c8c8c',
      reference: '#1890ff',
      dependency: '#fa8c16',
      operation: '#722ed1',
      alternative: '#d9d9d9'
    };
    return colors[type as keyof typeof colors] || '#d9d9d9';
  };

  return (
    <div className="infinite-canvas">
      <div
        ref={canvasRef}
        className="canvas-container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="canvas-background"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${20 * viewport.scale}px ${20 * viewport.scale}px`
          }}
        />

        <div
          className="canvas-transform"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
          }}
        >
          <svg className="connections-layer">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#8c8c8c" />
              </marker>
            </defs>
            {connections.map(conn => (
              <path
                key={conn.id}
                d={getConnectionPath(conn)}
                stroke={getConnectionColor(conn.connectionType)}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            ))}
          </svg>

          {nodes.map(node => {
            const colors = getNodeColor(node.type);
            return (
              <div
                key={node.id}
                className={`canvas-node ${node.type} ${selectedNodeId === node.id ? 'selected' : ''}`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: node.size.width || 200,
                  height: node.size.height || 150,
                  borderColor: node.style?.borderColor || colors.border,
                  backgroundColor: node.style?.backgroundColor || colors.bg
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
              >
                <div
                  className="node-header"
                  style={{ backgroundColor: node.style?.borderColor || colors.border }}
                >
                  <span className="node-title">{getNodeTitle(node)}</span>
                </div>
                <div className="node-content">
                  {node.type === 'video' && node.data.videoUrl ? (
                    <video
                      src={node.data.videoUrl}
                      className="node-video"
                      muted
                      playsInline
                    />
                  ) : (
                    <span>{getNodeContent(node)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="canvas-toolbar">
        <Tooltip title="刷新画布">
          <Button
            icon={<SyncOutlined spin={false} />}
            onClick={() => {
              getNodes(projectId).then(r => r.success && setNodes(r.nodes));
              getConnections(projectId).then(r => r.success && setConnections(r.connections));
            }}
          >
            刷新
          </Button>
        </Tooltip>
        <Tooltip title="重置视图">
          <Button
            icon={<ReloadOutlined />}
            onClick={resetViewport}
          />
        </Tooltip>
        <Tooltip title="缩小">
          <Button
            icon={<ZoomOutOutlined />}
            onClick={() => setViewport(p => ({ ...p, scale: Math.max(0.1, p.scale * 0.8) }))}
          />
        </Tooltip>
        <Slider
          className="scale-slider"
          min={0.1}
          max={3}
          step={0.1}
          value={viewport.scale}
          onChange={handleScaleChange}
          style={{ width: 120 }}
        />
        <Tooltip title="放大">
          <Button
            icon={<ZoomInOutlined />}
            onClick={() => setViewport(p => ({ ...p, scale: Math.min(3, p.scale * 1.25) }))}
          />
        </Tooltip>
        <span className="scale-text">{Math.round(viewport.scale * 100)}%</span>
      </div>

      <MiniMap nodes={nodes} viewport={viewport} />
    </div>
  );
};

const MiniMap: React.FC<{ nodes: Node[]; viewport: { x: number; y: number; scale: number } }> = ({ nodes, viewport }) => {
  const miniWidth = 200;
  const miniHeight = 150;

  if (nodes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + (node.size?.width || 200));
    maxY = Math.max(maxY, node.position.y + (node.size?.height || 150));
  });

  const padding = 50;
  const contentWidth = maxX - minX + padding * 2;
  const contentHeight = maxY - minY + padding * 2;
  const scale = Math.min(miniWidth / contentWidth, miniHeight / contentHeight, 0.1);

  const toMiniX = (x: number) => (x - minX + padding) * scale;
  const toMiniY = (y: number) => (y - minY + padding) * scale;

  const viewportWidth = 800;
  const viewportHeight = 600;

  const vpX = -viewport.x / viewport.scale - minX + padding;
  const vpY = -viewport.y / viewport.scale - minY + padding;

  return (
    <div className="mini-map">
      <svg width={miniWidth} height={miniHeight}>
        {nodes.map(node => (
          <rect
            key={node.id}
            x={toMiniX(node.position.x)}
            y={toMiniY(node.position.y)}
            width={(node.size?.width || 200) * scale}
            height={(node.size?.height || 150) * scale}
            fill="#d9d9d9"
            stroke="#bfbfbf"
          />
        ))}
        <rect
          x={vpX * scale}
          y={vpY * scale}
          width={viewportWidth * scale / viewport.scale}
          height={viewportHeight * scale / viewport.scale}
          fill="rgba(24, 144, 255, 0.1)"
          stroke="#1890ff"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

export default InfiniteCanvas;
