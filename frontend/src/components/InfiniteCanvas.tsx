import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Slider, Tooltip, Drawer, Form, Input, Select, Modal, message, Tag, Row, Col } from 'antd';
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
  WarningOutlined,
  RobotOutlined
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [nodeStartPositions, setNodeStartPositions] = useState<{ [id: string]: { x: number; y: number } }>({});
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);

  const [viewport, setViewport] = useState(() => {
    try {
      const saved = localStorage.getItem(`canvas_viewport_${projectId}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load canvas viewport:', e);
    }
    return { x: 0, y: 0, scale: 1 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(`canvas_viewport_${projectId}`, JSON.stringify(viewport));
    } catch (e) {
      console.warn('Failed to save canvas viewport:', e);
    }
  }, [viewport, projectId]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale
    };
  }, [viewport]);

  const getMarqueeStyle = () => {
    if (!marqueeStart || !marqueeEnd) return {};
    const left = Math.min(marqueeStart.x, marqueeEnd.x);
    const top = Math.min(marqueeStart.y, marqueeEnd.y);
    const width = Math.abs(marqueeStart.x - marqueeEnd.x);
    const height = Math.abs(marqueeStart.y - marqueeEnd.y);
    return {
      left,
      top,
      width,
      height,
      position: 'absolute' as const,
      border: '1.5px dashed #1890ff',
      backgroundColor: 'rgba(24, 144, 255, 0.08)',
      borderRadius: '4px',
      pointerEvents: 'none' as const,
      zIndex: 9999
    };
  };

  // 只显示创作相关的节点类型：script、scene、material、video
  const DISPLAY_NODE_TYPES = ['script', 'scene', 'material', 'video'];
  
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
        // 过滤掉不需要显示的节点类型
        const displayNodes = nodesResult.nodes.filter((n: Node) => DISPLAY_NODE_TYPES.includes(n.type));
        setNodes(displayNodes);
      }
      if (connectionsResult.success) {
        setConnections(connectionsResult.connections);
      }
    };

    loadCanvas();

    // WebSocket 连接
    wsRef.current = connectWebSocket(projectId, {
      onCanvasEvent: (event) => {
        // 只处理创作相关的节点事件
        if (event.type === 'node_created' && event.node && DISPLAY_NODE_TYPES.includes(event.node.type)) {
          setNodes(prev => [...prev, event.node]);
        } else if (event.type === 'node_updated' && event.nodeId) {
          // 更新时也只处理创作相关的节点
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
      if (e.shiftKey) {
        // Shift + Drag starts marquee selection
        const coords = getCanvasCoords(e.clientX, e.clientY);
        setMarqueeStart(coords);
        setMarqueeEnd(coords);
        setIsMarqueeSelecting(true);
      } else {
        // Regular Drag pans viewport
        setIsDragging(true);
        setDragStart({
          x: e.clientX - viewport.x,
          y: e.clientY - viewport.y
        });
        setSelectedNodeIds([]);
      }
    }
  }, [viewport, getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMarqueeSelecting && marqueeStart) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setMarqueeEnd(coords);
    } else if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    } else if (isDraggingNode && draggingNodeId) {
      const dx = (e.clientX - nodeDragStart.x) / viewport.scale;
      const dy = (e.clientY - nodeDragStart.y) / viewport.scale;

      setNodes(prev => prev.map(n => {
        if (nodeStartPositions[n.id]) {
          return {
            ...n,
            position: {
              x: nodeStartPositions[n.id].x + dx,
              y: nodeStartPositions[n.id].y + dy
            }
          };
        }
        return n;
      }));
    }
  }, [isMarqueeSelecting, marqueeStart, isDragging, dragStart, isDraggingNode, draggingNodeId, nodeDragStart, nodeStartPositions, viewport, getCanvasCoords]);

  const handleMouseUp = useCallback(() => {
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

      const newlySelected = nodes.filter(n => {
        const nx = n.position.x;
        const ny = n.position.y;
        const nw = n.size?.width || 200;
        const nh = n.size?.height || 150;
        return !(nx + nw < x1 || nx > x2 || ny + nh < y1 || ny > y2);
      }).map(n => n.id);

      setSelectedNodeIds(newlySelected);
      if (newlySelected.length > 0) {
        message.success(`已框选 ${newlySelected.length} 个节点！拖动其中任意一个可整体移动。`);
      }
      
      setMarqueeStart(null);
      setMarqueeEnd(null);
      setIsMarqueeSelecting(false);
    } else if (isDraggingNode) {
      const activeSelection = Object.keys(nodeStartPositions);
      Promise.all(activeSelection.map(id => {
        const targetNode = nodes.find(n => n.id === id);
        if (targetNode) {
          return updateNodePosition(id, targetNode.position);
        }
        return Promise.resolve({ success: false });
      })).then(results => {
        console.log('✅ Batch node positions persisted:', results);
      });

      setNodeStartPositions({});
      setIsDraggingNode(false);
      setDraggingNodeId(null);
    }
    
    setIsDragging(false);
  }, [isMarqueeSelecting, marqueeStart, marqueeEnd, nodes, nodeStartPositions]);

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
    
    let activeSelection = [...selectedNodeIds];
    if (e.shiftKey) {
      // Toggle node selection on Shift + Click
      if (activeSelection.includes(node.id)) {
        activeSelection = activeSelection.filter(id => id !== node.id);
      } else {
        activeSelection.push(node.id);
      }
      setSelectedNodeIds(activeSelection);
    } else {
      // Regular click: if not already selected, select only this node
      if (!activeSelection.includes(node.id)) {
        activeSelection = [node.id];
        setSelectedNodeIds(activeSelection);
      }
    }

    setIsDraggingNode(true);
    setDraggingNodeId(node.id);
    setNodeDragStart({ x: e.clientX, y: e.clientY });

    // Store start positions for all nodes in the selection
    const starts: { [id: string]: { x: number; y: number } } = {};
    activeSelection.forEach(id => {
      const targetNode = nodes.find(n => n.id === id);
      if (targetNode) {
        starts[id] = { ...targetNode.position };
      }
    });
    setNodeStartPositions(starts);
  };

  // Node editing & CRUD
  const handleNodeDoubleClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    setEditingNode(node);
    form.setFieldsValue({
      title: node.data.title || '',
      description: node.data.description || '',
      voiceover: node.data.voiceover || '',
      narration: node.data.narration || '',
      duration: node.data.duration || 3,
      shot_type: node.data.shot_type || '中景',
      emotion: node.data.emotion || '积极',
      transition: node.data.transition || 'fade',
      ai_prompt: node.data.ai_prompt || '',
      music_mood: node.data.music_mood || '无',
      subtitle: node.data.subtitle || '',
      referenceImageUrl: node.data.referenceImageUrl || '',
      referenceImageId: node.data.referenceImageId || '',
      firstFrameUrl: node.data.firstFrameUrl || '',
      lastFrameUrl: node.data.lastFrameUrl || '',
      sourceVideoUrl: node.data.sourceVideoUrl || '',
      imageUrl: node.data.imageUrl || '',
      audioUrl: node.data.audioUrl || '',
      ttsEstDuration: node.data.ttsEstDuration || '',
      videoUrl: node.data.videoUrl || '',
      status: node.data.status || 'idle',
      errorMessage: node.data.errorMessage || ''
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

  const handleDeleteSelectedNodes = () => {
    if (selectedNodeIds.length === 0) return;
    Modal.confirm({
      title: `确定要从画布上批量删除这 ${selectedNodeIds.length} 个节点吗？`,
      content: '删除后，所有相关的 timeline/operation 连接线也会被一并移除。如果删除的包含分镜节点，底层剧本数据也将自动被删减并重组序号。',
      okText: '确定批量删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const hide = message.loading('正在批量删除节点...', 0);
        try {
          const promises = selectedNodeIds.map(id => deleteNodeDirectly(id));
          const results = await Promise.all(promises);
          
          hide();
          if (results.every(r => r.success)) {
            message.success('选中的所有节点已成功从画布和数据库中移除！');
            setSelectedNodeIds([]);
          } else {
            message.error('部分节点删除失败，请重试');
          }
        } catch (err) {
          hide();
          message.error('批量删除操作发生异常，请重试');
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
    const existingSceneIds = nodes
      .filter(n => n.type === 'scene' && n.data.sceneId)
      .map(n => n.data.sceneId);
    const nextSceneId = existingSceneIds.length > 0 ? Math.max(...existingSceneIds) + 1 : 1;

    const defaultData = {
      sceneId: nextSceneId,
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

  const handleAddBgmNode = async () => {
    const defaultData = {
      filename: '商业欢快氛围BGM.mp3',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      type: 'audio',
      duration: 180,
      tags: ['BGM', '欢快']
    };

    const x = -viewport.x / viewport.scale + 150 + Math.random() * 50;
    const y = -viewport.y / viewport.scale + 100 + Math.random() * 50;

    const res = await createNodeDirectly(projectId, 'material', defaultData, { x, y });
    if (res.success) {
      message.success('已成功在画布上添加了背景音乐节点！双击可编辑音频信息。');
    } else {
      message.error(res.error || '添加背景音乐失败');
    }
  };

  const handleAddVideoNode = async () => {
    const defaultData = {
      title: '合成总视频',
      duration: 0,
      status: 'idle',
      videoUrl: null
    };

    const x = -viewport.x / viewport.scale + 450;
    const y = -viewport.y / viewport.scale + 150;

    const res = await createNodeDirectly(projectId, 'video', defaultData, { x, y });
    if (res.success) {
      message.success('已成功在画布上添加了最终成片节点！您可以在节点中一键触发多分镜合成。');
    } else {
      message.error(res.error || '添加视频合成节点失败');
    }
  };

  const handleTriggerSynthesis = async (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    
    // Find all scene nodes that are completed and have videoUrls!
    const completedScenes = nodes
      .filter(n => n.type === 'scene' && n.data.status === 'completed' && n.data.videoUrl)
      .map(n => ({
        id: n.data.id || n.data.sceneId,
        sceneId: n.data.sceneId,
        description: n.data.description,
        voiceover: n.data.voiceover,
        duration: n.data.duration,
        videoUrl: n.data.videoUrl
      }))
      .sort((a, b) => a.sceneId - b.sceneId); // Sort chronologically!

    if (completedScenes.length === 0) {
      message.warning('当前画布上没有已渲染完成的分镜视频，请先生成部分分镜视频再触发合成！');
      return;
    }

    // Find if there is a BGM audio node in the nodes!
    const bgmNode = nodes.find(n => n.type === 'material' && n.data.type === 'audio');
    const audioUrl = bgmNode ? bgmNode.data.url : null;

    message.loading('正在拼接多分镜视频并合成最终成片，请稍后...', 0);
    try {
      // Direct call to video compose endpoint
      const response = await fetch('/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: completedScenes,
          options: {
            bgmUrl: audioUrl
          }
        })
      });
      const res = await response.json();
      message.destroy();
      
      if (res.success && res.videoUrl) {
        message.success('🎬 最终成片拼接与音频合成成功！已在节点上提供预览！');
        // Update the video node on the canvas
        const updatedVideoNode = await updateNodeData(node.id, {
          videoUrl: res.videoUrl,
          duration: res.duration || completedScenes.reduce((sum, s) => sum + s.duration, 0),
          status: 'completed'
        });
        if (updatedVideoNode.success) {
          // Local state update
          setNodes(prev => prev.map(n => n.id === node.id ? { ...n, data: { ...n.data, videoUrl: res.videoUrl, status: 'completed' } } : n));
        }
      } else {
        message.error(res.error || '合成成片失败，请检查音视频素材是否正确');
      }
    } catch (err) {
      message.destroy();
      message.error('成片合成触发异常，请稍后重试');
    }
  };

  const handleTriggerAIScenes = async (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    message.loading('正在触发 AI Copilot 故事分镜大纲生成，请稍后...', 0);
    try {
      const response = await fetch('/api/copilot/canvas/generate-script-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const res = await response.json();
      message.destroy();
      if (res.success) {
        message.success('🤖 AI 分镜创作任务已成功在后台启动！请留意聊天栏日志和画布刷新。');
      } else {
        message.error(res.error || '大纲分镜生成失败');
      }
    } catch (err) {
      message.destroy();
      message.error('触发 AI Storyboard 大纲生成异常');
    }
  };

  const handleTriggerRenderAllScenes = async (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    
    // Find all scene nodes that are idle (not completed and not generating)
    const idleScenes = nodes.filter(n => n.type === 'scene' && n.data.status !== 'completed' && n.data.status !== 'generating');
    
    if (idleScenes.length === 0) {
      message.info('画布上没有需要渲染的分镜节点（所有分镜已完成或正在渲染中）。');
      return;
    }

    message.success(`⚡ 已批量触发 ${idleScenes.length} 个分镜视频并发生成任务！`, 3);
    
    // Loop and fire background rendering for all of them
    idleScenes.forEach(sceneNode => {
      generateSceneVideo(projectId, sceneNode.data.sceneId, sceneNode.data).then(res => {
        if (res.success) {
          console.log(`⚡ Scene ${sceneNode.data.sceneId} render task successfully fired.`);
        }
      });
    });
  };

  const handleRetryFailedScenes = async (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    
    // Find all scene nodes that are failed
    const failedScenes = nodes.filter(n => n.type === 'scene' && n.data.status === 'failed');
    
    if (failedScenes.length === 0) {
      message.info('画布上没有渲染失败的分镜节点。');
      return;
    }

    Modal.confirm({
      title: `确定要重试 ${failedScenes.length} 个失败的的分镜吗？`,
      content: '这些分镜之前渲染失败了，现在将重新触发渲染。',
      okText: '确认重试',
      cancelText: '取消',
      onOk: async () => {
        message.loading(`🔄 正在重试 ${failedScenes.length} 个失败的分镜...`, 0);
        
        try {
          // Reset failed scenes status and retry rendering
          failedScenes.forEach(async (sceneNode) => {
            try {
              // First reset the status in canvas
              await updateNodeData(sceneNode.id, { 
                status: 'idle',
                errorMessage: ''
              });
              
              // Then trigger the render
              const res = await generateSceneVideo(projectId, sceneNode.data.sceneId, sceneNode.data);
              if (res.success) {
                console.log(`✅ Scene ${sceneNode.data.sceneId} retry task successfully fired.`);
              } else {
                console.error(`❌ Scene ${sceneNode.data.sceneId} retry failed:`, res.error);
              }
            } catch (err) {
              console.error(`❌ Failed to retry scene ${sceneNode.data.sceneId}:`, err);
            }
          });
          
          message.destroy();
          message.success(`🔄 已成功触发 ${failedScenes.length} 个失败分镜的重试任务！`);
        } catch (err) {
          message.destroy();
          message.error('重试失败，请稍后重试');
        }
      }
    });
  };

  // Rendering Styling Helpers
  const getNodeColor = (type: Node['type']) => {
    const colors = {
      script: { border: '#722ed1', bg: '#f9f0ff' },
      scene: { border: '#1890ff', bg: '#e6f7ff' },
      material: { border: '#fa8c16', bg: '#fffaf0' },
      video: { border: '#eb2f96', bg: '#fff0f5' }
    };
    return colors[type as keyof typeof colors] || colors.scene;
  };

  const getNodeTitle = (node: Node) => {
    switch (node.type) {
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
            <div 
              className="scene-video-wrapper" 
              style={{ 
                marginTop: 'auto', 
                position: 'relative', 
                width: '100%', 
                height: '75px', 
                borderRadius: '6px', 
                overflow: 'hidden', 
                border: '1.5px solid #e8e8e8', 
                backgroundColor: '#0c0c0c',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                cursor: 'zoom-in'
              }}
              onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
            >
              <video
                src={node.data.videoUrl}
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '4px', 
                  zIndex: 10 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="primary"
                  size="small"
                  shape="circle"
                  icon={<PlayCircleOutlined />}
                  onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
                  style={{ width: 22, height: 22, minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
                />
              </div>
              <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0, 0, 0, 0.65)', color: '#fff', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', pointerEvents: 'none', fontWeight: 500, letterSpacing: '0.5px' }}>
                Hover 播放
              </div>
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

    if (node.type === 'video') {
      if (node.data.videoUrl) {
        return (
          <div className="synthesis-node-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="synthesis-desc" style={{ fontSize: 11, fontWeight: 'bold', color: '#eb2f96', marginBottom: 4 }}>
              🎥 最终成片已就绪 ({node.data.duration}秒)
            </div>
            <div 
              className="scene-video-wrapper" 
              style={{ 
                marginTop: 'auto', 
                position: 'relative', 
                width: '100%', 
                height: '75px', 
                borderRadius: '6px', 
                overflow: 'hidden', 
                border: '1.5px solid #e8e8e8', 
                backgroundColor: '#0c0c0c',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                cursor: 'zoom-in'
              }}
              onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
            >
              <video
                src={node.data.videoUrl}
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '4px', 
                  zIndex: 10 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="primary"
                  danger
                  size="small"
                  shape="circle"
                  icon={<PlayCircleOutlined />}
                  onClick={(e) => handlePlayPreview(e, node.data.videoUrl)}
                  style={{ width: 22, height: 22, minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
                />
              </div>
              <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(235, 47, 150, 0.85)', color: '#fff', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', pointerEvents: 'none', fontWeight: 500, letterSpacing: '0.5px' }}>
                Hover 播放成片
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
            <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 8, textAlign: 'center' }}>
              将所有分镜视频与背景音乐合成最终商业短视频
            </div>
            <Button
              type="primary"
              size="small"
              icon={<BuildOutlined />}
              style={{ background: '#eb2f96', borderColor: '#eb2f96', width: '100%' }}
              onClick={(e) => handleTriggerSynthesis(e, node)}
            >
              一键合成成片
            </Button>
          </div>
        );
      }
    }

    if (node.type === 'material') {
      if (node.data.type === 'audio') {
        return (
          <div className="audio-node-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 8, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🎵</span>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#13c2c2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.data.filename}
                </div>
                <div style={{ fontSize: 9, color: '#8c8c8c' }}>时长: {node.data.duration}s</div>
              </div>
            </div>
            <audio src={node.data.url} controls style={{ width: '100%', height: 26, scale: '0.85', transformOrigin: 'left center', marginTop: 4 }} />
          </div>
        );
      } else {
        return (
          <div className="material-node-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
            {node.data.url && (
              <img 
                src={node.data.url} 
                alt={node.data.filename} 
                style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 6, marginBottom: 4, border: '1px solid #f0f0f0' }} 
              />
            )}
            <div style={{ fontSize: 11, fontWeight: 500, color: '#333', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              {node.data.filename}
            </div>
            <div style={{ marginTop: 2 }}>
              {(node.data.tags || []).slice(0, 2).map((t: string) => (
                <Tag key={t} size="small" color="orange" style={{ fontSize: 9, lineHeight: '14px', height: 16 }}>{t}</Tag>
              ))}
            </div>
          </div>
        );
      }
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

    if (node.type === 'script') {
      const sceneNodes = nodes.filter(n => n.type === 'scene');
      const totalDuration = sceneNodes.reduce((sum, n) => sum + (n.data.duration || 0), 0);
      const completedScenes = sceneNodes.filter(n => n.data.status === 'completed').length;
      const failedScenes = sceneNodes.filter(n => n.data.status === 'failed').length;
      const idleScenes = sceneNodes.filter(n => n.data.status === 'idle').length;
      
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#722ed1', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📜 {node.data.title || '剧本大纲'}
          </div>
          <div style={{ fontSize: 10, color: '#8c8c8c', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 6 }}>
            {node.data.description || '双击编辑产品大纲描述...'}
          </div>
          
          {/* 剧本统计信息 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#f9f0ff', padding: '4px 8px', borderRadius: '4px', marginBottom: 6, border: '1px dashed #d3adf7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🎬 分镜: <strong>{sceneNodes.length}</strong></span>
                <span style={{ fontSize: 14 }}>|</span>
                <span>⏱️ 时长: <strong>{totalDuration}s</strong></span>
              </div>
              <div style={{ fontSize: 10, color: completedScenes === sceneNodes.length && sceneNodes.length > 0 ? '#52c41a' : '#1890ff' }}>
                {sceneNodes.length > 0 ? `${completedScenes}/${sceneNodes.length} 完成` : '未创建分镜'}
              </div>
            </div>
            
            {failedScenes > 0 && (
              <div style={{ fontSize: 10, color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>❌ 失败: <strong>{failedScenes}</strong></span>
                {idleScenes > 0 && <span style={{ color: '#8c8c8c' }}>|</span>}
                {idleScenes > 0 && <span>待生成: <strong>{idleScenes}</strong></span>}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
            <Button
              type="primary"
              size="small"
              icon={<RobotOutlined />}
              onClick={(e) => handleTriggerAIScenes(e, node)}
              style={{ background: '#722ed1', borderColor: '#722ed1', fontSize: 11, width: '100%' }}
            >
              🤖 AI 智能生成分镜
            </Button>
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={(e) => handleTriggerRenderAllScenes(e, node)}
              style={{ fontSize: 11, width: '100%' }}
            >
              ⚡ 一键渲染所有分镜
            </Button>
            {failedScenes > 0 && (
              <Button
                size="small"
                danger
                icon={<ReloadOutlined />}
                onClick={(e) => handleRetryFailedScenes(e, node)}
                style={{ fontSize: 11, width: '100%' }}
              >
                🔄 重试失败的 {failedScenes} 个分镜
              </Button>
            )}
          </div>
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
    const colors: Record<string, string> = {
      timeline: '#8c8c8c',
      reference: '#1890ff',
      dependency: '#fa8c16',
      operation: '#722ed1',
      alternative: '#d9d9d9'
    };
    return colors[type] || '#8c8c8c';
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
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
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

          {isMarqueeSelecting && marqueeStart && marqueeEnd && (
            <div style={getMarqueeStyle()} />
          )}

          {nodes.map(node => {
            const colors = getNodeColor(node.type);
            return (
              <div
                key={node.id}
                className={`canvas-node ${node.type} ${selectedNodeIds.includes(node.id) ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
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
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8c8c8c', marginBottom: 6 }}>
          <BuildOutlined /> 画布工具箱 (Toonflow)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddSceneNode}
            size="small"
            className="scene-toolbox-btn"
          >
            添加分镜节点
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddMaterialNode}
            size="small"
            className="material-toolbox-btn"
          >
            添加图片素材
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddBgmNode}
            size="small"
            className="bgm-toolbox-btn"
          >
            添加背景音乐
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddVideoNode}
            size="small"
            className="synthesis-toolbox-btn"
          >
            添加成片合成节点
          </Button>
        </div>

        {selectedNodeIds.length > 0 && (
          <Button
            danger
            type="primary"
            icon={<DeleteOutlined />}
            onClick={handleDeleteSelectedNodes}
            size="small"
            style={{ marginTop: 8 }}
          >
            批量删除 ({selectedNodeIds.length})
          </Button>
        )}

        <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px dashed #e8e8e8', paddingTop: 8 }}>
          <span style={{ fontWeight: 'bold', color: '#262626' }}>💡 高级快捷操作：</span>
          <span>• <b>Shift + 框选画布</b>：批量选择多个节点</span>
          <span>• <b>Shift + 点击节点</b>：多选或反选节点</span>
          <span>• <b>拖动选中节点</b>：整体移动所选组合</span>
          <span>• <b>批量删除按钮</b>：一键清除所选节点</span>
        </div>
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
              <>
                <Form.Item name="title" label="剧本标题" rules={[{ required: true, message: '请输入剧本标题' }]}>
                  <Input placeholder="给这个视频起个吸引人的标题" />
                </Form.Item>
                
                <Form.Item name="description" label="产品/主题描述">
                  <Input.TextArea rows={2} placeholder="简要描述这个视频要介绍的产品或主题" />
                </Form.Item>

                <Form.Item name="totalDuration" label="视频总时长 (秒)">
                  <Input type="number" min={10} max={600} placeholder="60" />
                </Form.Item>

                <Form.Item name="style" label="视频风格">
                  <Select mode="multiple" placeholder="选择视频风格">
                    <Select.Option value="专业">专业</Select.Option>
                    <Select.Option value="轻松">轻松</Select.Option>
                    <Select.Option value="科技感">科技感</Select.Option>
                    <Select.Option value="温暖">温暖</Select.Option>
                    <Select.Option value="简约">简约</Select.Option>
                    <Select.Option value="活力">活力</Select.Option>
                    <Select.Option value="电影感">电影感</Select.Option>
                    <Select.Option value="Vlog风格">Vlog风格</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="targetAudience" label="目标受众">
                  <Select placeholder="选择目标受众">
                    <Select.Option value="年轻白领">年轻白领</Select.Option>
                    <Select.Option value="中年商务">中年商务</Select.Option>
                    <Select.Option value="学生群体">学生群体</Select.Option>
                    <Select.Option value="家庭主妇">家庭主妇</Select.Option>
                    <Select.Option value="老年用户">老年用户</Select.Option>
                    <Select.Option value="专业从业者">专业从业者</Select.Option>
                    <Select.Option value="普通大众">普通大众</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="narrator" label="配音风格">
                  <Select placeholder="选择配音风格">
                    <Select.Option value="男声-磁性">男声-磁性</Select.Option>
                    <Select.Option value="男声-活力">男声-活力</Select.Option>
                    <Select.Option value="女声-甜美">女声-甜美</Select.Option>
                    <Select.Option value="女声-知性">女声-知性</Select.Option>
                    <Select.Option value="AI合成">AI合成</Select.Option>
                    <Select.Option value="无需配音">无需配音</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}

            {editingNode.type === 'scene' && (
              <>
                <Form.Item name="description" label="画面描述 (核心内容)" rules={[{ required: true, message: '请输入画面描述' }]}>
                  <Input.TextArea rows={3} placeholder="描述这个分镜要展示的核心画面内容" />
                </Form.Item>
                
                <Form.Item name="voiceover" label="旁白文案 (TTS)" rules={[{ required: true, message: '请输入旁白' }]}>
                  <Input.TextArea rows={2} placeholder="这个分镜的旁白配音内容" />
                </Form.Item>
                
                <Form.Item name="narration" label="旁白文案 (备选)">
                  <Input.TextArea rows={1} placeholder="备用旁白内容" />
                </Form.Item>
                
                <Form.Item name="duration" label="预计时长 (秒)" rules={[{ required: true, message: '请输入时长' }]}>
                  <Input type="number" min={1} max={60} placeholder="5" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="shot_type" label="镜头类型">
                      <Select placeholder="选择镜头">
                        <Select.Option value="特写">特写</Select.Option>
                        <Select.Option value="近景">近景</Select.Option>
                        <Select.Option value="中景">中景</Select.Option>
                        <Select.Option value="全景">全景</Select.Option>
                        <Select.Option value="远景">远景</Select.Option>
                        <Select.Option value="俯拍">俯拍</Select.Option>
                        <Select.Option value="仰拍">仰拍</Select.Option>
                        <Select.Option value="航拍">航拍</Select.Option>
                        <Select.Option value="移动镜头">移动镜头</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="emotion" label="情感基调">
                      <Select placeholder="选择情感">
                        <Select.Option value="积极">积极</Select.Option>
                        <Select.Option value="专业">专业</Select.Option>
                        <Select.Option value="热情">热情</Select.Option>
                        <Select.Option value="平静">平静</Select.Option>
                        <Select.Option value="紧张">紧张</Select.Option>
                        <Select.Option value="轻松">轻松</Select.Option>
                        <Select.Option value="浪漫">浪漫</Select.Option>
                        <Select.Option value="神秘">神秘</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="ai_prompt" label="AI 生图提示词">
                  <Input.TextArea rows={2} placeholder="用于 AI 生成图片的英文提示词" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="transition" label="转场效果">
                      <Select>
                        <Select.Option value="none">无转场</Select.Option>
                        <Select.Option value="fade">淡入淡出</Select.Option>
                        <Select.Option value="wipe">滑动转场</Select.Option>
                        <Select.Option value="dissolve">溶解</Select.Option>
                        <Select.Option value="zoom">缩放转场</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="music_mood" label="配乐氛围">
                      <Select>
                        <Select.Option value="无">无背景音乐</Select.Option>
                        <Select.Option value="轻快">轻快</Select.Option>
                        <Select.Option value="舒缓">舒缓</Select.Option>
                        <Select.Option value="动感">动感</Select.Option>
                        <Select.Option value="紧张">紧张</Select.Option>
                        <Select.Option value="浪漫">浪漫</Select.Option>
                        <Select.Option value="史诗">史诗</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="subtitle" label="字幕文案">
                  <Input.TextArea rows={1} placeholder="可选的字幕显示内容" />
                </Form.Item>

                <Form.Item name="referenceImageUrl" label="参考图片URL">
                  <Input placeholder="分镜的参考图片URL（可选）" />
                </Form.Item>
                
                <Form.Item name="referenceImageId" label="参考图片素材ID">
                  <Input placeholder="素材库中的参考图片ID（可选）" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="firstFrameUrl" label="首帧图片URL">
                      <Input placeholder="AI视频首帧控制图片（可选）" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="lastFrameUrl" label="尾帧图片URL">
                      <Input placeholder="AI视频尾帧控制图片（可选）" />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item name="sourceVideoUrl" label="源视频素材URL">
                  <Input placeholder="已有视频素材链接（可选）" />
                </Form.Item>
                
                <Form.Item name="imageUrl" label="AI生成图片URL">
                  <Input placeholder="AI生成的图片URL（只读）" disabled />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="audioUrl" label="配音音频URL">
                      <Input placeholder="TTS生成的配音URL（只读）" disabled />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="ttsEstDuration" label="TTS预计时长(秒)">
                      <Input type="number" placeholder="配音预计时长" disabled />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="videoUrl" label="生成视频URL">
                  <Input placeholder="AI生成的视频URL（只读）" disabled />
                </Form.Item>

                <Form.Item name="errorMessage" label="错误信息">
                  <Input.TextArea rows={2} placeholder="生成失败时显示的错误信息（只读）" disabled />
                </Form.Item>

                <Form.Item name="status" label="分镜状态">
                  <Select disabled>
                    <Select.Option value="idle">待生成</Select.Option>
                    <Select.Option value="generating">生成中</Select.Option>
                    <Select.Option value="completed">已完成</Select.Option>
                    <Select.Option value="failed">失败</Select.Option>
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

  const vpX = -viewport.x / viewport.scale - minX + padding;
  const vpY = -viewport.y / viewport.scale - minY + padding;

  return (
    <div className="mini-map" style={{ position: 'absolute', bottom: 20, right: 20, background: 'white', border: '1px solid #ccc' }}>
      <svg width={miniWidth} height={miniHeight}>
        {nodes.map(node => (
          <rect key={node.id} x={toMiniX(node.position.x)} y={toMiniY(node.position.y)} width={(node.size?.width || 200) * scale} height={(node.size?.height || 150) * scale} fill="#d9d9d9" />
        ))}
        <rect x={vpX * scale} y={vpY * scale} width={800 * scale / viewport.scale} height={600 * scale / viewport.scale} fill="rgba(24, 144, 255, 0.1)" stroke="#1890ff" />
      </svg>
    </div>
  );
};

export default InfiniteCanvas;
