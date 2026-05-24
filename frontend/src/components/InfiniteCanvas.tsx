import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Slider, Tooltip, Drawer, Form, Input, Select, Modal, message, Tag } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  SyncOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  VideoCameraOutlined,
  BuildOutlined,
  LoadingOutlined,
  WarningOutlined
} from '@ant-design/icons';
import {
  getNodes,
  getConnections,
  updateNodePosition,
  connectWebSocket,
  updateNodeData,
  deleteNodeDirectly,
  createNodeDirectly,
  generateSceneVideo,
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

  // Toonflow state variables
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

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
      onOperationProgress: (data) => {
        console.log('⚙️ Canvas operation progress:', data);
        if (data.operationNodeId) {
          setNodes(prev => prev.map(n =>
            n.id === data.operationNodeId
              ? { ...n, data: { ...n.data, progress: data.progress, status: data.status, error: data.error } }
              : n
          ));
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

  // Node editing & CRUD
  const handleNodeDoubleClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    setEditingNode(node);
    form.setFieldsValue({
      title: node.data.title || '',
      description: node.data.description || '',
      voiceover: node.data.voiceover || '',
      duration: node.data.duration || 3,
      shot_type: node.data.shot_type || '中景',
      emotion: node.data.emotion || '积极',
      transition: node.data.transition || 'fade'
    });
    setIsDrawerVisible(true);
  };

  const handleSaveProperties = async () => {
    if (!editingNode) return;
    try {
      const values = await form.validateFields();
      if (values.duration) {
        values.duration = Number(values.duration);
      }

      const res = await updateNodeData(editingNode.id, values);
      if (res.success) {
        message.success('节点数据更新成功，已完美同步回数据库！');
        setIsDrawerVisible(false);
        setEditingNode(null);
      } else {
        message.error(res.error || '保存失败');
      }
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  const handleDeleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确定要从画布上删除这个节点吗？',
      content: '删除后，所有相关的 timeline/operation 连接线也会被一并移除。如果删除的是分镜节点，相应的底层剧本数据也将被同步删减并自动重组序号。',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const res = await deleteNodeDirectly(nodeId);
        if (res.success) {
          message.success('节点已成功从画布和数据库中移除！');
        } else {
          message.error(res.error || '删除失败');
        }
      }
    });
  };

  const handleTriggerRender = async (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    if (node.type !== 'scene') return;

    message.loading(`正在为分镜 ${node.data.sceneId} 发起异步生成任务...`, 2);
    try {
      const res = await generateSceneVideo(projectId, node.data.sceneId, node.data);
      if (res.success) {
        message.success(`分镜 ${node.data.sceneId} 渲染任务已成功启动，请在节点上查看实时进度！`);
      } else {
        message.error(res.error || '生成启动失败');
      }
    } catch (err) {
      message.error('生成发起异常，请稍后重试');
    }
  };

  const handlePlayPreview = (e: React.MouseEvent, videoUrl: string) => {
    e.stopPropagation();
    setPreviewVideoUrl(videoUrl);
    setIsPreviewVisible(true);
  };

  const handleAddSceneNode = async () => {
    const defaultData = {
      description: '镜头微距特写，展示商品精致的外观与设计，商业摄影光影，极简背景',
      voiceover: '看看这个精致的工艺与细节，你一定会爱上它！',
      duration: 3,
      shot_type: '特写',
      emotion: '积极',
      transition: 'fade'
    };

    const x = -viewport.x / viewport.scale + 150 + Math.random() * 50;
    const y = -viewport.y / viewport.scale + 100 + Math.random() * 50;

    const res = await createNodeDirectly(projectId, 'scene', defaultData, { x, y });
    if (res.success) {
      message.success('已在画布和剧本配置中新增了一个分镜节点！');
    } else {
      message.error(res.error || '添加分镜失败');
    }
  };

  const handleAddMaterialNode = async () => {
    const defaultData = {
      filename: '商品宣传图.png',
      url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      type: 'image',
      tags: ['商品图', '高清']
    };

    const x = -viewport.x / viewport.scale + 150 + Math.random() * 50;
    const y = -viewport.y / viewport.scale + 100 + Math.random() * 50;

    const res = await createNodeDirectly(projectId, 'material', defaultData, { x, y });
    if (res.success) {
      message.success('已成功在画布上创建了素材节点！');
    } else {
      message.error(res.error || '添加素材失败');
    }
  };

  // Rendering Styling Helpers
  const getNodeColor = (type: Node['type']) => {
    const colors = {
      script: { border: '#722ed1', bg: '#f9f0ff' },
      scene: { border: '#1890ff', bg: '#e6f7ff' },
      material: { border: '#fa8c16', bg: '#fffaf0' },
      video: { border: '#eb2f96', bg: '#fff0f5' },
      intent: { border: '#13c2c2', bg: '#e6fffb' },
      plan: { border: '#faad14', bg: '#fffbe6' },
      operation: { border: '#52c41a', bg: '#f6ffed' }
    };
    return colors[type] || colors.scene;
  };

  const getNodeTitle = (node: Node) => {
    switch (node.type) {
      case 'intent':
        return '🤖 用户意图';
      case 'plan':
        return '📋 执行计划';
      case 'operation':
        return '⚙️ 运行操作';
      case 'script':
        return '📜 剧本';
      case 'scene':
        return `🎬 分镜 ${node.data.sceneId || 0}`;
      case 'material':
        return node.data.filename || '素材';
      case 'video':
        return '🎥 最终合成成片';
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
        return `最终视频 ${node.data.duration}秒`;
      default:
        return node.type;
    }
  };

  const renderNodeInner = (node: Node) => {
    const status = node.data.status || 'idle';
    const progress = node.data.progress || 0;

    if (node.type === 'scene') {
      return (
        <div className="scene-node-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="scene-desc" style={{ fontSize: 11, color: '#333', maxHeight: 44, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {node.data.description}
          </div>
          <div className="scene-meta" style={{ marginTop: 4, fontSize: 10, color: '#8c8c8c' }}>
            <span>时长: {node.data.duration}s</span> | <span>旁白: {node.data.voiceover?.substring(0, 8)}...</span>
          </div>

          {/* Direct rendering progress bar inside the SceneNode */}
          {status === 'generating' && (
            <div className="scene-progress" style={{ marginTop: 'auto', paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#1890ff', marginBottom: 2 }}>
                <span><LoadingOutlined spin /> 视频渲染中...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 4, background: '#f5f5f5', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #1890ff, #52c41a)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          {status === 'completed' && node.data.videoUrl && (
            <div className="scene-video-ready" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <span style={{ color: '#52c41a', fontSize: 10, fontWeight: 'bold' }}>✓ 视频已就绪</span>
              <Button
                type="primary"
                size="small"
                shape="round"
                icon={<PlayCircleOutlined />}
                onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
              >
                预览
              </Button>
            </div>
          )}

          {status === 'failed' && (
            <div className="scene-video-failed" style={{ marginTop: 'auto', paddingTop: 4 }}>
              <div style={{ color: '#ff4d4f', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <WarningOutlined />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: 140 }}>
                  生成失败: {node.data.error || '未知错误'}
                </span>
              </div>
            </div>
          )}

          {status !== 'generating' && status !== 'completed' && status !== 'failed' && (
            <Button
              type="dashed"
              size="small"
              icon={<VideoCameraOutlined />}
              onClick={(e) => handleTriggerRender(e, node)}
              style={{ marginTop: 'auto', width: '100%', fontSize: 11 }}
            >
              一键渲染分镜
            </Button>
          )}
        </div>
      );
    }

    if (node.type === 'video' && node.data.videoUrl) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#eb2f96', marginBottom: 8 }}>🎥 最终成片 ({node.data.duration}秒)</div>
          <Button
            type="primary"
            danger
            icon={<PlayCircleOutlined />}
            onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
          >
            播放合成成片
          </Button>
        </div>
      );
    }

    if (node.type === 'plan') {
      return (
        <div className="plan-node-inner" style={{ width: '100%', fontSize: 11 }}>
          <div style={{ fontWeight: 'bold', color: '#faad14', marginBottom: 4 }}>{node.data.description}</div>
          <div style={{ color: '#8c8c8c', marginBottom: 6 }}>预计耗时: {Math.ceil((node.data.estimatedDuration || 0) / 60)} 分钟</div>
          <div className="plan-steps-summary">
            {(node.data.steps || []).map((s: any, idx: number) => (
              <div key={s.stepId} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: s.status === 'completed' ? '#52c41a' : s.status === 'executing' ? '#1890ff' : '#d9d9d9'
                }} />
                <span style={{ textDecoration: s.status === 'completed' ? 'line-through' : 'none', color: s.status === 'completed' ? '#8c8c8c' : '#333' }}>
                  {s.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (node.type === 'operation') {
      const opProgress = node.data.progress || 0;
      const opStatus = node.data.status || 'pending';
      return (
        <div className="op-node-inner" style={{ width: '100%' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>{node.data.description}</div>
          <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 6 }}>Agent: {node.data.agentName}</div>
          
          {opStatus === 'executing' && (
            <div>
              <div style={{ height: 4, background: '#f5f5f5', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${opProgress}%`, background: 'linear-gradient(90deg, #1890ff, #52c41a)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 9, color: '#1890ff', textAlign: 'right', marginTop: 2 }}>{opProgress}%</div>
            </div>
          )}
          {opStatus === 'completed' && <Tag color="success">✓ 完成</Tag>}
          {opStatus === 'failed' && <Tag color="error">❌ 失败: {node.data.error?.slice(0, 15)}...</Tag>}
        </div>
      );
    }

    return <span>{getNodeContent(node)}</span>;
  };

  const getConnectionPath = (conn: Connection) => {
    const source = nodes.find(n => n.id === conn.sourceNodeId);
    const target = nodes.find(n => n.id === conn.targetNodeId);
    if (!source || !target) return '';

    const x1 = source.position.x + (source.size?.width || 200) / 2;
    const y1 = source.position.y + (source.size?.height || 150);
    const x2 = target.position.x + (target.size?.width || 200) / 2;
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
                  width: node.size?.width || 200,
                  height: node.size?.height || 150,
                  borderColor: node.style?.borderColor || colors.border,
                  backgroundColor: node.style?.backgroundColor || colors.bg
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
              >
                <div
                  className="node-header"
                  style={{ backgroundColor: node.style?.borderColor || colors.border }}
                >
                  <span className="node-title">{getNodeTitle(node)}</span>
                  <Tooltip title="从画布删除">
                    <DeleteOutlined
                      className="node-delete-btn"
                      onClick={(e) => handleDeleteNode(e, node.id)}
                    />
                  </Tooltip>
                </div>
                <div className="node-content">
                  {renderNodeInner(node)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Add Node toolbox */}
      <div className="canvas-toolbox">
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8c8c8c', marginBottom: 4 }}>
          <BuildOutlined /> 画布工具箱 (Toonflow)
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddSceneNode}
          size="small"
        >
          添加分镜节点
        </Button>
        <Button
          icon={<PlusOutlined />}
          onClick={handleAddMaterialNode}
          size="small"
        >
          添加素材节点
        </Button>
      </div>

      <div className="canvas-toolbar">
        <Tooltip title="刷新画布">
          <Button
            icon={<SyncOutlined />}
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

      {/* Floating properties editor Drawer */}
      <Drawer
        title={`编辑 ${editingNode ? getNodeTitle(editingNode) : '节点属性'}`}
        placement="right"
        width={360}
        onClose={() => { setIsDrawerVisible(false); setEditingNode(null); }}
        open={isDrawerVisible}
        extra={
          <Button type="primary" onClick={handleSaveProperties}>
            确定修改
          </Button>
        }
      >
        {editingNode && (
          <Form form={form} layout="vertical">
            {editingNode.type === 'script' && (
              <Form.Item name="title" label="剧本标题" rules={[{ required: true, message: '请输入剧本标题' }]}>
                <Input />
              </Form.Item>
            )}

            {editingNode.type === 'scene' && (
              <>
                <Form.Item name="description" label="画面描述 (大模型生成提示词)" rules={[{ required: true, message: '请输入画面描述' }]}>
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item name="voiceover" label="分镜旁白 (TTS 文案)" rules={[{ required: true, message: '请输入分镜旁白' }]}>
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="duration" label="分镜时长 (秒)" rules={[{ required: true, message: '请输入时长' }]}>
                  <Input type="number" min={1} max={30} />
                </Form.Item>
                <Form.Item name="shot_type" label="镜头类型">
                  <Select>
                    <Select.Option value="特写">特写</Select.Option>
                    <Select.Option value="近景">近景</Select.Option>
                    <Select.Option value="中景">中景</Select.Option>
                    <Select.Option value="全景">全景</Select.Option>
                    <Select.Option value="俯拍">俯拍</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="emotion" label="情感风格">
                  <Select>
                    <Select.Option value="积极">积极</Select.Option>
                    <Select.Option value="专业">专业</Select.Option>
                    <Select.Option value="热情">热情</Select.Option>
                    <Select.Option value="平静">平静</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="transition" label="转场效果">
                  <Select>
                    <Select.Option value="fade">淡入淡出</Select.Option>
                    <Select.Option value="none">无转场</Select.Option>
                    <Select.Option value="wipe">滑动转场</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}
          </Form>
        )}
      </Drawer>

      {/* Rich Video Player Overlay Preview Modal */}
      <Modal
        title="分镜视频播放预览 (Toonflow Preview)"
        open={isPreviewVisible}
        onCancel={() => { setIsPreviewVisible(false); setPreviewVideoUrl(null); }}
        footer={null}
        destroyOnClose
        width={400}
        bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}
      >
        {previewVideoUrl && (
          <video
            src={previewVideoUrl}
            controls
            autoPlay
            style={{ width: '280px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          />
        )}
      </Modal>
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
