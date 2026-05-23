import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SendOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  VideoCameraOutlined,
  PlusOutlined,
  LoadingOutlined,
  PictureOutlined,
  AudioOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ScissorOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  RollbackOutlined,
  ExperimentOutlined,
  ApiOutlined,
  SkinOutlined,
  GlobalOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import AssetPanel from './AssetPanel';
import {
  Layout,
  Button,
  Input,
  Select,
  Switch,
  Card,
  Space,
  Progress,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Slider,
  message,
  Empty,
  Tooltip,
  Modal,
  Form,
  Popover,
  List,
  Radio,
  Collapse,
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Content } = Layout;
const { Panel } = Collapse;

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type SceneStatus = 'idle' | 'generating' | 'completed' | 'error' | 'image_completed';

interface Scene {
  id?: number;
  description: string;
  duration: number;
  voiceover: string;
  shot_type: string;
  emotion: string;
  transition: string;
  // 状态机
  status: SceneStatus;
  imageUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  ttsEstDuration?: number;
  generatedAt?: number;
  rendering?: boolean;
  progress?: number;
  // 商品参考图注入
  referenceImageId?: string | null;
  referenceImageUrl?: string | null;
  // 画布预留字段
  x?: number | null;
  y?: number | null;
  // 新增字段
  cameraAngle?: string;
  lighting?: string;
  colorTone?: string;
}

interface WorkflowNode {
  id: string;
  name: string;
  agent: string;
  layer: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
}

const WorkbenchPage: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditSceneIndex, setCurrentEditSceneIndex] = useState<number | null>(null);
  
  // Agent相关状态
  const [selectedSceneForSuggestions, setSelectedSceneForSuggestions] = useState<number | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<Array<{id: string, title: string, content: string, type: string, cost: number}>>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Strict check on mounting
  useEffect(() => {
    if (!projectId) {
      message.error('未指定项目 ID，正在返回项目列表');
      navigate('/projects');
    }
  }, [projectId, navigate]);

  // Unified State
  const [project, setProject] = useState<any>(null);
  const [script, setScript] = useState<any>(null);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'materials';
  
  // Chat Co-pilot State
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Settings
  const [settings, setSettings] = useState({
    voice: 'zh_female_story',
    volume: 80,
    speed: 1.0,
    bgm: 'cheerful.mp3',
    resolution: '720p',
    ratio: '9:16',
    transition: 'fade',
    enableTTS: true
  });

  // Render Telemetry
  const [isRenderingAll, setIsRenderingAll] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [isRenderingAllScenes, setIsRenderingAllScenes] = useState(false);

  // Agent Workflow 节点状态（供 Header 步骤条消费）
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([
    { id: 'materials', name: '素材分析', agent: 'AssetAgent', layer: '决策层', status: 'pending' },
    { id: 'script',    name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'pending' },
    { id: 'storyboard',name: '分镜编辑', agent: 'ImageAgent',  layer: '执行层', status: 'pending' },
    { id: 'video',     name: '分镜渲染', agent: 'VideoAgent',  layer: '执行层', status: 'pending' },
    { id: 'clip',      name: '剪辑合成', agent: 'ClipAgent',   layer: '执行层', status: 'pending' },
  ]);
  const [workflowStarted, setWorkflowStarted] = useState(false);

  // 资产注入模式：正在等待用户点选目标分镜的素材
  const [injectingMaterial, setInjectingMaterial] = useState<{ id: string; url: string } | null>(null);

  // 项目素材列表（AssetPanel 数据源）
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);


  // Auto-save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');

  // Load project details on mount/change
  const loadProject = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setProject(p);
        if (p.script) {
          setScript(p.script);
          setWorkflowStarted(true);
          setWorkflowNodes([
            { id: 'materials', name: '素材分析', agent: 'AssetAgent', layer: '决策层', status: p.materials?.length > 0 ? 'completed' : 'pending' },
            { id: 'script',    name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'completed' },
            { id: 'storyboard',name: '分镜编辑', agent: 'ImageAgent',  layer: '执行层', status: p.script.scenes?.some((s: any) => s.imageUrl) ? 'completed' : 'pending' },
            { id: 'video',     name: '分镜渲染', agent: 'VideoAgent',  layer: '执行层', status: p.script.scenes?.some((s: any) => s.videoUrl) ? 'completed' : 'pending' },
            { id: 'clip',      name: '剪辑合成', agent: 'ClipAgent',   layer: '执行层', status: p.videoUrl ? 'completed' : 'pending' },
          ]);
        } else {
          setWorkflowStarted(true);
          setWorkflowNodes([
            { id: 'materials', name: '素材分析', agent: 'AssetAgent', layer: '决策层', status: p.materials?.length > 0 ? 'completed' : 'pending' },
            { id: 'script',    name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'pending' },
            { id: 'storyboard',name: '分镜编辑', agent: 'ImageAgent',  layer: '执行层', status: 'pending' },
            { id: 'video',     name: '分镜渲染', agent: 'VideoAgent',  layer: '执行层', status: 'pending' },
            { id: 'clip',      name: '剪辑合成', agent: 'ClipAgent',   layer: '执行层', status: 'pending' },
          ]);
        }
        if (p.product_info) {
          setProductInfo(p.product_info);
        }
        if (p.settings) setSettings({ ...settings, ...p.settings });
        // 初始化资产面板数据
        if (p.materials) setProjectMaterials(p.materials);

        // Initialize Chat Pilot Greeting once project is loaded
        const materialsSummary = p.materials && p.materials.length > 0
          ? `我已读取到您绑定的 ${p.materials.length} 个商品素材（${p.materials.map((m: any) => m.filename).join(', ')}），并在后台提炼了商品核心卖点。`
          : '当前项目暂未绑定商品素材，我会根据常规爆款策略为您策划剧本。';

        setChatHistory([
          {
            role: 'assistant',
            content: `你好！我是您的 AI 导演兼创作助理。${materialsSummary} 
现在你想为该商品生成什么风格的视频？你可以对我说：
“帮我生成一个科普风格的带货剧本” 或 “想给精致白领制作一份情景种草剧本”。`,
            timestamp: new Date()
          }
        ]);
      } else {
        throw new Error('Project not found');
      }
    } catch (e) {
      console.error('加载项目详情失败，尝试寻找可用备用项目...', e);
      try {
        const listRes = await fetch(`${API_BASE}/api/projects`);
        const listData = await listRes.json();
        if (listData.success && listData.data?.list && listData.data.list.length > 0) {
          const latestProjId = listData.data.list[0].id;
          message.warning('当前项目不存在，已自动为您开启最近创建的项目');
          navigate(`/workbench/${latestProjId}`);
        } else {
          message.error('检测到您暂无项目资产，正在引导您创建首个项目');
          navigate('/projects');
        }
      } catch (err) {
        console.error('备用路由跳转降级失败', err);
        message.error('加载工作台异常，已返回项目大厅');
        navigate('/projects');
      }
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  // Auto Scroll Chat Window
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // AI Video Editing Agent State
  const [isPlanningClip, setIsPlanningClip] = useState(false);
  const [clipPlan, setClipPlan] = useState<any>(null);

  const handleGenerateClipPlan = async () => {
    if (!script) {
      message.warning('请先生成分镜剧本才能规划剪辑方案！');
      return;
    }
    setIsPlanningClip(true);
    try {
      const response = await fetch(`${API_BASE}/api/agent/clip-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          materials: project?.materials || [],
          options: settings
        })
      });
      const data = await response.json();
      if (data.success && data.plan) {
        setClipPlan(data.plan);
        message.success('🎬 AI 剪辑师已为您制定最优剪辑方案！');
        
        // Automatically sync recommended audio settings if suggested
        if (data.plan.audio) {
          const planBGM = data.plan.audio.bgm;
          const planVolume = typeof data.plan.audio.volume === 'number'
            ? Math.round(data.plan.audio.volume * 100)
            : settings.volume;
          
          // Map AI recommended BGM names back to settings option keys
          let mappedBGM = settings.bgm;
          if (planBGM) {
            if (planBGM.includes('cheerful') || planBGM.includes('欢快')) mappedBGM = 'cheerful.mp3';
            else if (planBGM.includes('energetic') || planBGM.includes('动感') || planBGM.includes('Edm')) mappedBGM = 'energetic.mp3';
            else if (planBGM.includes('jazz') || planBGM.includes('温馨') || planBGM.includes('舒缓')) mappedBGM = 'smooth_jazz.mp3';
            else if (planBGM.includes('none') || planBGM.includes('不配') || planBGM === 'none') mappedBGM = 'none';
          }

          const updated = {
            ...settings,
            bgm: mappedBGM,
            volume: planVolume
          };
          updateSettings(updated);
          message.info(`🤖 已自动为您应用 AI 剪辑师推荐的背景音乐 (${mappedBGM === 'none' ? '无背景乐' : mappedBGM}) 与配音音量 (${planVolume}%)！`);
        }
      } else {
        throw new Error(data.error || 'Failed to generate plan');
      }
    } catch (err: any) {
      console.error('AI clip plan error:', err);
      message.error('AI 剪辑方案生成失败，使用默认最优剪辑方案');
      
      // Load local smart default plan
      const defaultPlan = {
        clips: (script?.scenes || []).map((s: any, idx: number) => ({
          sceneId: idx + 1,
          transition: settings.transition,
          duration: s.duration || 3,
          audioSync: 'sync'
        })),
        audio: {
          tts: true,
          bgm: 'cheerful.mp3',
          volume: 0.8
        }
      };
      setClipPlan(defaultPlan);
    } finally {
      setIsPlanningClip(false);
    }
  };

  // Persist Current Project State to SQLite
  const handleSave = async (updatedScript = script, updatedSettings = settings) => {
    if (!projectId) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project?.name,
          description: project?.description,
          script: updatedScript,
          settings: updatedSettings
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
    } catch (e) {
      console.error('保存项目失败:', e);
      setSaveStatus('unsaved');
    }
  };

  // Trigger Save on crucial state updates
  const updateScript = (newScript: any) => {
    setScript(newScript);
    setSaveStatus('unsaved');
    handleSave(newScript, settings);
  };

  const updateSettings = (newSettings: any) => {
    setSettings(newSettings);
    setSaveStatus('unsaved');
    handleSave(script, newSettings);
  };

  // Conversational Agent API Trigger
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setIsChatting(true);

    // Update workflow steps to show ScriptAgent is running
    setWorkflowStarted(true);
    setWorkflowNodes(prev => prev.map(n => n.id === 'script' ? { ...n, status: 'running' } : n));

    const updatedHistory: Message[] = [
      ...chatHistory,
      { role: 'user', content: userMsg, timestamp: new Date() }
    ];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch(`${API_BASE}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentScript: script,
          message: userMsg,
          projectId
        })
      });

      const data = await response.json();
      if (data.success) {
        setChatHistory([
          ...updatedHistory,
          { role: 'assistant', content: data.agentMessage, timestamp: new Date() }
        ]);
        if (data.script) {
          setScript(data.script);
          setSaveStatus('saved'); // Behind the scenes, the endpoint auto-saves
          // Script & Review done
          setWorkflowNodes(prev => prev.map(n => {
            if (n.id === 'script' || n.id === 'review') return { ...n, status: 'completed' };
            return n;
          }));
        } else {
          // If no script returned but chat succeeds, restore script to completed
          setWorkflowNodes(prev => prev.map(n => n.id === 'script' ? { ...n, status: 'completed' } : n));
        }
      } else {
        throw new Error(data.error || 'Chat processing error');
      }
    } catch (error: any) {
      console.error('AI chat failed:', error);
      message.error('AI 对话接口异常，请重试');
      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', content: '抱歉，我的思考模块受到一点干扰，请稍后再试。', timestamp: new Date() }
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  // Inline scene field editing
  const updateSceneField = (sceneIndex: number, field: keyof Scene, value: any) => {
    if (!script) return;
    const newScenes = [...script.scenes];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      [field]: value
    };
    updateScript({ ...script, scenes: newScenes });
  };

  // 资产面板：进入"选择注入目标"模式
  const handleInjectMode = (materialId: string, materialUrl: string) => {
    setInjectingMaterial({ id: materialId, url: materialUrl });
    message.info('请点击目标分镜卡片完成参考图注入', 2);
  };

  // 分镜卡片被点击时，若处于注入模式则执行注入
  const handleSceneCardClick = (sceneIndex: number) => {
    if (!injectingMaterial || !script) return;
    const newScenes = [...script.scenes];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      referenceImageId: injectingMaterial.id,
      referenceImageUrl: injectingMaterial.url,
    };
    updateScript({ ...script, scenes: newScenes });
    setInjectingMaterial(null);
    message.success(`✅ 参考图已注入分镜 ${sceneIndex + 1}`);
  };

  // 取消注入模式
  const cancelInjectMode = () => setInjectingMaterial(null);

  // 打开分镜编辑模态框
  const openEditModal = (index: number) => {
    if (!script || !script.scenes) return;
    const scene = script.scenes[index];
    form.setFieldsValue({
      description: scene.description,
      voiceover: scene.voiceover,
      duration: scene.duration,
      shot_type: scene.shot_type,
      emotion: scene.emotion,
      transition: scene.transition,
      cameraAngle: scene.cameraAngle || '',
      lighting: scene.lighting || '',
      colorTone: scene.colorTone || '',
    });
    setCurrentEditSceneIndex(index);
    setIsModalOpen(true);
  };

  // 关闭模态框
  const closeEditModal = () => {
    setIsModalOpen(false);
    setCurrentEditSceneIndex(null);
  };

  // 保存分镜编辑
  const saveSceneEdit = () => {
    if (currentEditSceneIndex === null || !script || !script.scenes) return;
    const values = form.getFieldsValue();
    const newScenes = [...script.scenes];
    newScenes[currentEditSceneIndex] = {
      ...newScenes[currentEditSceneIndex],
      ...values,
    };
    updateScript({ ...script, scenes: newScenes });
    setIsModalOpen(false);
    setCurrentEditSceneIndex(null);
    message.success('分镜编辑已保存！');
  };

  // 上传首帧或尾帧
  const uploadFrameImage = (index: number, frameType: 'first' | 'last' | 'main') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        message.loading(`正在上传图片...`, 0);
        try {
          const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
          });
          const uploadData = await res.json();
          message.destroy();
          if (uploadData.success && uploadData.url) {
            const field = frameType === 'first' ? 'firstFrameUrl' : frameType === 'last' ? 'lastFrameUrl' : 'imageUrl';
            updateSceneField(index, field, uploadData.url);
            if (frameType === 'main') {
              updateSceneField(index, 'status', 'image_completed');
            }
            message.success(`图片上传成功！`);
          } else {
            throw new Error(uploadData.error || '上传失败');
          }
        } catch (err: any) {
          message.error('上传失败: ' + err.message);
        }
      }
    };
    input.click();
  };

  // 清除分镜图片
  const clearSceneImage = (index: number, imageType: 'first' | 'last' | 'main') => {
    if (!script || !script.scenes) return;
    const field = imageType === 'first' ? 'firstFrameUrl' : imageType === 'last' ? 'lastFrameUrl' : 'imageUrl';
    console.log(`Clearing ${imageType} image at index ${index}, field: ${field}`);
    const newScenes = [...script.scenes];
    newScenes[index] = {
      ...newScenes[index],
      [field]: null
    };
    if (imageType === 'main') {
      newScenes[index].status = 'idle';
    }
    updateScript({ ...script, scenes: newScenes });
    message.success(`${imageType === 'first' ? '首帧' : imageType === 'last' ? '尾帧' : '主图'}已清除，可以重新生成`);
  };
  
  // Agent 功能：获取智能建议
  const getAgentSuggestions = async (sceneIndex: number) => {
    if (!script || !script.scenes[sceneIndex]) return;
    setIsAgentLoading(true);
    setSelectedSceneForSuggestions(sceneIndex);
    
    // 模拟 Agent 生成建议（实际项目中调用真实API）
    setTimeout(() => {
      const scene = script.scenes[sceneIndex];
      const suggestions = [
        {
          id: '1',
          title: '✨ 优化提示词',
          content: `为您的提示词添加更多细节：${scene.description} → 建议增加光影、角度和色彩描述`,
          type: 'optimization',
          cost: 5
        },
        {
          id: '2',
          title: '🎨 风格推荐',
          content: '根据产品特点，建议使用：商业摄影风格，明亮自然光',
          type: 'style',
          cost: 3
        },
        {
          id: '3',
          title: '🎙️ 配音优化',
          content: scene.voiceover ? `建议优化配音语气，当前建议：${scene.voiceover.length > 30 ? scene.voiceover.substring(0, 30) + '...' : scene.voiceover}` : '建议添加旁白配音，提升视频吸引力',
          type: 'voiceover',
          cost: 2
        },
        {
          id: '4',
          title: '🎬 镜头建议',
          content: scene.shot_type === '特写' ? '建议增加中景镜头丰富层次' : '建议使用特写突出产品细节',
          type: 'lens',
          cost: 2
        }
      ];
      setAgentSuggestions(suggestions);
      setIsAgentLoading(false);
    }, 1000);
  };
  
  // Agent 快速操作：批量优化
  const batchOptimize = (type: 'consistency' | 'duration' | 'voiceover') => {
    if (!script || !script.scenes) return;
    
    message.loading(`正在执行${type === 'consistency' ? '一致性优化' : type === 'duration' ? '时长调整' : '配音优化'}...`, 1);
    
    setTimeout(() => {
      const newScenes = [...script.scenes];
      
      if (type === 'consistency') {
        // 统一风格
        newScenes.forEach((scene, idx) => {
          if (idx > 0) {
            scene.emotion = newScenes[0].emotion;
            scene.colorTone = newScenes[0].colorTone;
          }
        });
        message.success('风格一致性优化完成！');
      } else if (type === 'duration') {
        // 调整时长
        const avgDuration = Math.round(newScenes.reduce((sum, s) => sum + s.duration, 0) / newScenes.length);
        newScenes.forEach(scene => {
          scene.duration = avgDuration;
        });
        message.success(`时长统一为 ${avgDuration} 秒完成！`);
      } else {
        // 配音优化（模拟）
        message.success('配音风格优化建议已生成！');
      }
      
      updateScript({ ...script, scenes: newScenes });
    }, 800);
  };
  
  // 应用 Agent 建议
  const applyAgentSuggestion = (suggestion: any, sceneIndex: number) => {
    if (!script || !script.scenes[sceneIndex]) return;
    const newScenes = [...script.scenes];
    const scene = { ...newScenes[sceneIndex] };
    
    switch(suggestion.type) {
      case 'optimization':
        scene.description = scene.description + '，专业商业摄影，自然光，清晰细节';
        break;
      case 'style':
        scene.colorTone = 'bright';
        scene.lighting = 'natural';
        break;
      case 'voiceover':
        // 可以添加更多配音逻辑
        break;
      case 'lens':
        scene.shot_type = scene.shot_type === '特写' ? '中景' : '特写';
        break;
    }
    
    newScenes[sceneIndex] = scene;
    updateScript({ ...script, scenes: newScenes });
    message.success(`已应用建议: ${suggestion.title}`);
  };
  
  // 一键优化所有分镜
  const optimizeAllScenes = async () => {
    if (!script || !script.scenes) return;
    message.loading('Agent 正在分析和优化所有分镜...', 0);
    
    setTimeout(() => {
      const newScenes = script.scenes.map((scene, idx) => {
        return {
          ...scene,
          lighting: 'natural',
          cameraAngle: idx % 2 === 0 ? '平视' : '微微俯视'
        };
      });
      updateScript({ ...script, scenes: newScenes });
      message.destroy();
      message.success('✨ 全部分镜优化完成！');
    }, 1500);
  };



  // Scene level Image Generation & Calling Agent API
  const generateSingleSceneImage = async (index: number) => {
    if (!script || !script.scenes) return;
    const scene = script.scenes[index];
    
    // Atomic state update for starting image generation
    const startScenes = [...script.scenes];
    startScenes[index] = {
      ...startScenes[index],
      status: 'generating',
      rendering: true
    };
    updateScript({ ...script, scenes: startScenes });

    setWorkflowStarted(true);
    setWorkflowNodes(prev => prev.map(n => n.id === 'image' ? { ...n, status: 'running' } : n));

    try {
      const res = await fetch(`${API_BASE}/api/image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.description,
          referenceImageUrl: scene.referenceImageUrl || null,
          sceneIndex: index,
          projectId
        })
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        // Atomic state update for successful image generation
        const doneScenes = [...script.scenes];
        doneScenes[index] = {
          ...doneScenes[index],
          rendering: false,
          imageUrl: data.imageUrl,
          status: 'image_completed'
        };
        updateScript({ ...script, scenes: doneScenes });
        message.success(`分镜 ${index + 1} 视觉生图成功！`);
        
        setWorkflowNodes(prev => prev.map(n => {
          if (n.id === 'image') {
            const allDone = script.scenes.every((s: any, idx: number) => idx === index ? true : (s.imageUrl || s.status === 'image_completed' || s.status === 'completed' || s.videoUrl));
            return { ...n, status: allDone ? 'completed' : 'running' };
          }
          return n;
        }));
      } else {
        throw new Error(data.error || '生图失败');
      }
    } catch (e) {
      console.error(e);
      // Atomic state update for failed image generation
      const failScenes = [...script.scenes];
      failScenes[index] = {
        ...failScenes[index],
        rendering: false,
        status: 'error'
      };
      updateScript({ ...script, scenes: failScenes });
      message.error(`分镜 ${index + 1} 图片生成失败`);
      setWorkflowNodes(prev => prev.map(n => n.id === 'image' ? { ...n, status: 'failed' } : n));
    }
  };

  // 一键生成所有图片
  const handleRenderAllImages = async () => {
    if (!script || !script.scenes || script.scenes.length === 0) {
      message.warning('暂无分镜场景数据！');
      return;
    }
    message.loading('正在批量发起所有分镜的图片生成任务...', 2);
    try {
      script.scenes.forEach((s: any, idx: number) => {
        if (!s.imageUrl && !s.rendering) {
          generateSingleSceneImage(idx);
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Scene level Video Generation & Polling Mock/API
  const generateSingleSceneVideo = async (index: number) => {
    if (!script || !script.scenes) return;
    const scene = script.scenes[index];
    
    // Atomic state update for starting video generation
    const startScenes = [...script.scenes];
    startScenes[index] = {
      ...startScenes[index],
      status: 'generating',
      rendering: true,
      progress: 10
    };
    updateScript({ ...script, scenes: startScenes });

    setWorkflowStarted(true);
    setWorkflowNodes(prev => prev.map(n => n.id === 'video' ? { ...n, status: 'running' } : n));

    // Parallel high-quality voiceover generation if TTS is enabled and voiceover is present
    if (settings.enableTTS && scene.voiceover) {
      try {
        console.log(`🎙️ 正在为分镜 ${index + 1} 并发生成配音...`);
        const ttsRes = await fetch(`${API_BASE}/api/tts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: scene.voiceover,
            options: {
              voice: settings.voice,
              speed: settings.speed,
              volume: settings.volume
            }
          })
        });
        const ttsData = await ttsRes.json();
        if (ttsData.success) {
          // Atomic state update for successful TTS generation
          const ttsScenes = [...script.scenes];
          ttsScenes[index] = {
            ...ttsScenes[index],
            audioUrl: ttsData.audioUrl,
            ttsEstDuration: ttsData.duration
          };
          updateScript({ ...script, scenes: ttsScenes });
          console.log(`✅ 分镜 ${index + 1} 配音生成成功:`, ttsData.audioUrl);
        }
      } catch (err) {
        console.error(`❌ 分镜 ${index + 1} 配音生成失败:`, err);
      }
    }

    try {
      // Direct post to single render endpoint (passing the visual image URL for Image-to-Video synthesis)
      const res = await fetch(`${API_BASE}/api/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.description,
          imageUrl: scene.imageUrl || scene.referenceImageUrl || null,
          duration: scene.duration || 5,
          sceneIndex: index,
          options: { ...settings, projectId }
        })
      });

      const data = await res.json();
      if (data.taskId) {
        const taskId = data.taskId;
        // Start polling task
        const pollInterval = setInterval(async () => {
          try {
            const taskRes = await fetch(`${API_BASE}/api/video/status/${taskId}`);
            const taskData = await taskRes.json();
            if (taskData) {
              updateSceneField(index, 'progress', taskData.progress || 30);

              if (taskData.status === 'succeeded') {
                clearInterval(pollInterval);
                // Atomic state update for successful video generation
                const doneScenes = [...script.scenes];
                doneScenes[index] = {
                  ...doneScenes[index],
                  rendering: false,
                  status: 'completed',
                  videoUrl: taskData.videoUrl
                };
                updateScript({ ...script, scenes: doneScenes });
                message.success(`分镜 ${index + 1} 画面渲染成功！`);
                
                setWorkflowNodes(prev => prev.map(n => {
                  if (n.id === 'video') {
                    const allDone = script?.scenes?.every((s: any, idx: number) => idx === index ? true : (s.status === 'completed' || !!s.videoUrl));
                    return { ...n, status: allDone ? 'completed' : 'running' };
                  }
                  return n;
                }));
              } else if (taskData.status === 'failed') {
                clearInterval(pollInterval);
                // Atomic state update for failed video generation
                const failScenes = [...script.scenes];
                failScenes[index] = {
                  ...failScenes[index],
                  rendering: false,
                  status: 'error'
                };
                updateScript({ ...script, scenes: failScenes });
                message.error(`分镜 ${index + 1} 画面生成失败`);
                setWorkflowNodes(prev => prev.map(n => n.id === 'video' ? { ...n, status: 'failed' } : n));
              }
            }
          } catch (e) {
            console.error('轮询分镜任务错误:', e);
          }
        }, 3000);
      } else {
        // Safe fallback
        setTimeout(() => {
          // Atomic state update for fallback video generation
          const fallbackScenes = [...script.scenes];
          fallbackScenes[index] = {
            ...fallbackScenes[index],
            rendering: false,
            status: 'completed',
            videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kitchen-counter-with-fresh-vegetables-and-fruits-41584-large.mp4'
          };
          updateScript({ ...script, scenes: fallbackScenes });
          message.success(`分镜 ${index + 1} 画面生成成功 (Mock 视频已注入)`);
          
          setWorkflowNodes(prev => prev.map(n => {
            if (n.id === 'video') {
              const allDone = script?.scenes?.every((s: any, idx: number) => idx === index ? true : (s.status === 'completed' || !!s.videoUrl));
              return { ...n, status: allDone ? 'completed' : 'running' };
            }
            return n;
          }));
        }, 4000);
      }
    } catch (e) {
      console.error('生成单个分镜失败:', e);
      // Atomic state update for failed catch block
      const catchScenes = [...script.scenes];
      catchScenes[index] = {
        ...catchScenes[index],
        rendering: false,
        status: 'error'
      };
      updateScript({ ...script, scenes: catchScenes });
      message.error('分镜渲染出错');
      setWorkflowNodes(prev => prev.map(n => n.id === 'video' ? { ...n, status: 'failed' } : n));
    }
  };

  // 一键渲染所有分镜
  const handleRenderAllScenes = async () => {
    if (!script || !script.scenes || script.scenes.length === 0) {
      message.warning('暂无分镜场景数据！');
      return;
    }
    setIsRenderingAllScenes(true);
    try {
      // 批量启动所有非 completed / 非渲染中 的分镜渲染任务
      script.scenes.forEach((s: any, idx: number) => {
        if (s.status !== 'completed' && !s.rendering) {
          generateSingleSceneVideo(idx);
        }
      });
      message.success('已成功一键启动所有未渲染分镜的生成任务！');
    } catch (e) {
      console.error(e);
      message.error('一键启动失败，请检查网络');
    } finally {
      setIsRenderingAllScenes(false);
    }
  };

  // Batch compilation and render trigger
  const handleCompileFinalVideo = async () => {
    if (!script) {
      message.warning('请先规划出剧本分镜');
      return;
    }

    setIsRenderingAll(true);
    setRenderProgress(0);
    setRenderStatus('正在拼装视音频资产并合成渲染...');
    setFinalVideoUrl(null);

    setWorkflowStarted(true);
    setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'running' } : n));

    try {
      const res = await fetch(`${API_BASE}/api/video/batch-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          options: {
            resolution: settings.resolution,
            ratio: settings.ratio,
            transition: settings.transition,
            voice: settings.voice,
            volume: settings.volume,
            speed: settings.speed,
            bgm: settings.bgm
          }
        })
      });
      const data = await res.json();
      
      if (data.batchId) {
        const taskId = data.batchId;
        const es = new EventSource(`${API_BASE}/api/tasks/${taskId}/stream`);
        
        es.onmessage = (event) => {
          const task = JSON.parse(event.data);
          setRenderProgress(task.progress || 0);
          if (task.message) setRenderStatus(task.message);
          
          if (task.videoUrl) {
            setFinalVideoUrl(task.videoUrl);
          }

          if (task.status === 'completed' || task.status === 'failed') {
            es.close();
            setIsRenderingAll(false);
            if (task.status === 'failed') {
              message.error(task.error || '视频渲染合成失败');
              setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'failed' } : n));
            } else {
              message.success('恭喜！带货视频合成输出成功！');
              setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'completed' } : n));
            }
          }
        };

        es.onerror = () => {
          es.close();
          setIsRenderingAll(false);
          message.error('后台视频编译连接发生异常');
          setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'failed' } : n));
        };
      } else {
        // Fallback synthetic compilation
        let progressVal = 10;
        const fallbackTimer = setInterval(() => {
          progressVal += 20;
          if (progressVal >= 100) {
            clearInterval(fallbackTimer);
            setRenderProgress(100);
            setIsRenderingAll(false);
            setFinalVideoUrl('https://assets.mixkit.co/videos/preview/mixkit-pouring-orange-juice-into-a-glass-41618-large.mp4');
            message.success('带货视频一键成片合成成功 (智能 Mock 备用包)');
            setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'completed' } : n));
          } else {
            setRenderProgress(progressVal);
            setRenderStatus(`正在执行第 ${Math.ceil(progressVal / 25)} 分镜音频和画面高精校准...`);
          }
        }, 1500);
      }
    } catch (e) {
      console.error('一键成片发生异常:', e);
      setIsRenderingAll(false);
      setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'failed' } : n));
    }
  };

  return (
    <Layout style={{ height: '100%', minHeight: '100%', background: '#09090b', color: '#e4e4e7' }}>
      {/* Premium Dark Navigation Header */}
      <div style={{
        background: '#121214',
        borderBottom: '1px solid #1f1f23',
        flexShrink: 0,
      }}>
        {/* Row 1: Project title + save controls */}
        <div style={{
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Space size="large">
            <Button
              type="text"
              icon={<ArrowLeftOutlined style={{ color: '#fff' }} />}
              onClick={() => navigate('/projects')}
            />
            <div>
              <Title level={4} style={{ margin: 0, color: '#fff' }}>🎬 {project?.name || '创意工作台'}</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {project?.description ? `绑定素材: ${projectMaterials.length} 个 | ${project.description.slice(0, 40)}` : '创意无限，全 AI 驱动视频生成器'}
              </Text>
            </div>
          </Space>

          <Space size="middle">
            {saveStatus === 'saved' && <Tag color="success"><CheckCircleOutlined /> 自动保存已同步</Tag>}
            {saveStatus === 'saving' && <Tag color="processing"><LoadingOutlined /> 自动保存中</Tag>}
            {saveStatus === 'unsaved' && <Tag color="warning">⚠️ 本地有待同步修改</Tag>}
            
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveStatus === 'saving'}
              onClick={() => handleSave()}
              style={{ borderRadius: 6, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}
            >
              强制保存
            </Button>
          </Space>
        </div>

        {/* Row 2: Agent Workflow 步骤条（仅触发过流程后显示） */}
        {workflowStarted && (
          <div style={{
            padding: '0 24px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            overflowX: 'auto',
          }}>
            {workflowNodes.map((node, idx) => {
              const tabMap: Record<string, string> = {
                materials: 'materials',
                script: 'script',
                storyboard: 'storyboard',
                video: 'video',
                clip: 'render'
              };
              const statusColor: Record<string, string> = {
                pending: '#3f3f46',
                running: '#6366f1',
                completed: '#10b981',
                failed: '#ef4444',
              };
              const statusIcon: Record<string, React.ReactNode> = {
                pending: <span style={{ fontSize: 10 }}>○</span>,
                running: <SyncOutlined spin style={{ fontSize: 10 }} />,
                completed: <CheckCircleOutlined style={{ fontSize: 10 }} />,
                failed: <CloseCircleOutlined style={{ fontSize: 10 }} />,
              };
              return (
                <React.Fragment key={node.id}>
                  <Tooltip title={`${node.agent} · ${node.layer}`} placement="bottom">
                    <div
                      onClick={() => navigate(`/workbench/${projectId}?tab=${tabMap[node.id] || 'script'}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: node.status === 'pending' ? 'transparent' : `${statusColor[node.status]}18`,
                        border: `1px solid ${statusColor[node.status]}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ color: statusColor[node.status] }}>
                        {statusIcon[node.status]}
                      </span>
                      <span style={{ fontSize: 11, color: node.status === 'pending' ? '#52525b' : '#e4e4e7', fontWeight: node.status !== 'pending' ? 600 : 400 }}>
                        {node.name}
                      </span>
                      {node.status === 'completed' && node.output?.score !== undefined && (
                        <span style={{ fontSize: 9, color: '#10b981' }}>{node.output.score}分</span>
                      )}
                      {node.status === 'completed' && node.output?.sceneCount !== undefined && (
                        <span style={{ fontSize: 9, color: '#10b981' }}>{node.output.sceneCount}镜</span>
                      )}
                    </div>
                  </Tooltip>
                  {idx < workflowNodes.length - 1 && (
                    <div style={{ width: 20, height: 1, background: '#27272a', flexShrink: 0 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>


      {/* Main Dual-Column Content Panels */}
      <Content style={{ padding: 24, flex: 1, overflow: 'hidden' }}>
        
        {/* ============================================================== */}
        {/* TAB 0: MATERIAL ANALYSIS PANEL */}
        {/* ============================================================== */}
        {activeTab === 'materials' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Materials List & Upload */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><PictureOutlined /> 商品参考素材库</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}
              >
                <div style={{ flexShrink: 0, marginBottom: 16 }}>
                  <Paragraph style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
                    请在此处上传该商品的图片素材（如：商品图、使用场景图、卖点说明图）。这些素材将作为大模型自动生成分镜、参考图的底蕴基础。
                  </Paragraph>
                </div>
                
                {/* Drag-Drop and Uploader Grid */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
                  <Row gutter={[12, 12]}>
                    <Col span={8}>
                      <div
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              message.loading(`正在上传 "${file.name}"...`, 0);
                              try {
                                const res = await fetch(`${API_BASE}/api/projects/${projectId}/materials`, {
                                  method: 'POST',
                                  body: formData
                                });
                                const uploadData = await res.json();
                                message.destroy();
                                if (uploadData.success && uploadData.data) {
                                  message.success('素材上传成功！');
                                  setProjectMaterials((prev: any[]) => [uploadData.data, ...prev]);
                                  setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                                } else {
                                  throw new Error(uploadData.error || '上传失败');
                                }
                              } catch (err: any) {
                                message.error('上传失败: ' + err.message);
                              }
                            }
                          };
                          input.click();
                        }}
                        style={{
                          height: 100,
                          background: 'rgba(99,102,241,0.08)',
                          border: '1.5px dashed #4f46e5',
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <PlusOutlined style={{ fontSize: 20, color: '#818cf8', marginBottom: 6 }} />
                        <span style={{ fontSize: 11, color: '#818cf8' }}>上传新素材</span>
                      </div>
                    </Col>
                    {projectMaterials.map((m: any) => (
                      <Col span={8} key={m.id}>
                        <div style={{
                          height: 100,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid #27272a',
                          position: 'relative'
                        }}>
                          <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            padding: '2px 6px',
                            fontSize: 10,
                            color: '#a1a1aa',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={m.filename}>
                            {m.filename}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  {projectMaterials.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#52525b', padding: '60px 0' }}>
                      <PictureOutlined style={{ fontSize: 36, display: 'block', margin: '0 auto 12px' }} />
                      暂无关联素材，您可以点击上方按钮开始上传商品图
                    </div>
                  )}
                </div>
              </Card>
            </Col>

            {/* Right: AI Asset Analysis Panel */}
            <Col span={14} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><RocketOutlined /> AI 核心卖点提炼与分析</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}
              >
                {!productInfo && !isAnalyzing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px' }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'rgba(99,102,241,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 24,
                      border: '1px solid rgba(99,102,241,0.2)'
                    }}>
                      <RocketOutlined style={{ fontSize: 36, color: '#818cf8' }} />
                    </div>
                    <Title level={4} style={{ color: '#fff', marginBottom: 12 }}>唤醒 AI 导演深度提炼商品核心数据</Title>
                    <Paragraph style={{ color: '#a1a1aa', fontSize: 13.5, lineHeight: 1.6, marginBottom: 24 }}>
                      您上传的产品素材是大模型策划脑暴的燃料。通过 AI 素材提取 Agent，系统将智能解析产品特点、自动提炼 3 个绝对吸睛的带货痛点，并锁受众群体与视频主调。
                    </Paragraph>
                    <Space size="middle">
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        size="large"
                        loading={isAnalyzing}
                        onClick={async () => {
                          setIsAnalyzing(true);
                          try {
                            const res = await fetch(`${API_BASE}/api/agent/analyze-materials`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ projectId })
                            });
                            const data = await res.json();
                            if (data.success && data.productInfo) {
                              setProductInfo(data.productInfo);
                              setProject((prev: any) => ({ ...prev, product_info: data.productInfo }));
                              setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                              message.success('🚀 AI 素材特征提炼成功！');
                            } else {
                              throw new Error(data.error || '分析失败');
                            }
                          } catch (err: any) {
                            message.error('智能提炼异常: ' + err.message);
                          } finally {
                            setIsAnalyzing(false);
                          }
                        }}
                        style={{
                          height: 48,
                          padding: '0 32px',
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 14,
                          boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.4)'
                        }}
                      >
                        💡 AI 智能分析商品素材
                      </Button>
                      <Button
                        type="default"
                        size="large"
                        onClick={() => {
                          const shell = {
                            title: project?.name || '爆款商品',
                            sellingPoints: '极致匠心做工，多功能集成，操作简便。',
                            targetAudience: '追求高品质生活方式的年轻消费群体。',
                            style: '时尚极简，温馨治愈。',
                            price: '面议/性价比优选'
                          };
                          setProductInfo(shell);
                          setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                          message.info('已跳过素材提取，已生成默认产品策划模版。');
                        }}
                        style={{ height: 48, borderRadius: 8, background: '#27272a', color: '#fff', border: '1px solid #3f3f46' }}
                      >
                        直接配置剧本 ➔
                      </Button>
                    </Space>
                  </div>
                ) : isAnalyzing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingOutlined style={{ fontSize: 40, color: '#818cf8', marginBottom: 20 }} />
                    <Title level={5} style={{ color: '#fff', marginBottom: 8 }}>AI 素材特征提取 Agent 正在读取解析中...</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>FFmpeg 与 Vision LLM 正在提取图片卖点、分析流行痛点，请稍候片刻...</Text>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
                      <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🛒 商品带货名称 / 策划标题</Text></div>
                          <Input
                            value={productInfo.title}
                            onChange={(e) => setProductInfo({ ...productInfo, title: e.target.value })}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>💎 商品核心卖点与亮点摘要 (80字内)</Text></div>
                          <TextArea
                            value={productInfo.sellingPoints}
                            onChange={(e) => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
                            rows={3}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6 }}
                          />
                        </div>
                        <Row gutter={16}>
                          <Col span={12}>
                            <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>👥 精准目标受众群体</Text></div>
                            <Input
                              value={productInfo.targetAudience}
                              onChange={(e) => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
                              style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                            />
                          </Col>
                          <Col span={12}>
                            <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🏷️ 售价参考区间</Text></div>
                            <Input
                              value={productInfo.price}
                              onChange={(e) => setProductInfo({ ...productInfo, price: e.target.value })}
                              style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                            />
                          </Col>
                        </Row>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🎨 建议短视频整体创意调性</Text></div>
                          <Input
                            value={productInfo.style}
                            onChange={(e) => setProductInfo({ ...productInfo, style: e.target.value })}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                          />
                        </div>
                      </Space>
                    </div>

                    <div style={{ flexShrink: 0, borderTop: '1px solid #27272a', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        type="dashed"
                        onClick={() => {
                          setProductInfo(null);
                        }}
                        style={{ background: 'transparent', color: '#a1a1aa', border: '1px dashed #3f3f46' }}
                      >
                        重新分析素材
                      </Button>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={async () => {
                          message.loading('正在同步商品特征至数据库...', 0);
                          try {
                            const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                productInfo
                              })
                            });
                            const data = await res.json();
                            message.destroy();
                            if (data.success) {
                              setProject((prev: any) => ({ ...prev, product_info: productInfo }));
                              setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                              message.success('✅ 商品分析特征已保存！');
                              navigate(`/workbench/${projectId}?tab=script`);
                            } else {
                              throw new Error(data.error || '保存特征失败');
                            }
                          } catch (err: any) {
                            message.error('同步失败: ' + err.message);
                          }
                        }}
                        style={{
                          height: 40,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          padding: '0 24px'
                        }}
                      >
                        🚀 保存分析，开始剧本策划
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 1: SCRIPT COORDINATION PANEL */}
        {/* ============================================================== */}
        {activeTab === 'script' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Chat Copilot */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><AudioOutlined /> AI 创意导演 Copilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}
              >
                {/* Chat Message Lists */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
                  {chatHistory.map((msg, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 16
                    }}>
                      <div style={{
                        maxWidth: '85%',
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#27272a',
                        color: '#fff',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        lineHeight: 1.5,
                        fontSize: 13.5
                      }}>
                        <Paragraph style={{ color: '#fff', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</Paragraph>
                        <div style={{
                          fontSize: 10,
                          opacity: 0.6,
                          textAlign: 'right',
                          marginTop: 4
                        }}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                      <div style={{ background: '#27272a', padding: '10px 14px', borderRadius: '12px 12px 12px 2px' }}>
                        <span style={{ color: '#818cf8' }}><LoadingOutlined /> AI 导演正在深入构思中...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input Controls */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #27272a', paddingTop: 12 }}>
                  <TextArea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder="输入剧本创作想法...例如：'帮我制作一个破壁机的带货剧本，突出超静音特色'"
                    autoSize={{ minRows: 2, maxRows: 3 }}
                    style={{ background: '#202023', border: '1px solid #2e2e33', color: '#fff', borderRadius: 8 }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={isChatting || !chatInput.trim()}
                    onClick={handleSendChatMessage}
                    style={{ height: 'auto', borderRadius: 8, background: '#4f46e5', border: 'none' }}
                  />
                </div>
              </Card>
            </Col>

            {/* Right: Script Interactive Canvas */}
            <Col span={14} style={{ height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><SaveOutlined /> 剧本画布预览</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {script ? (
                  <div>
                    <div style={{ background: '#202023', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                      <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0' }}>📄 {script.title}</Title>
                      <Paragraph style={{ color: '#a1a1aa', margin: 0, fontSize: 13 }}>
                        <strong>核心创意创意:</strong> {script.description}
                      </Paragraph>
                    </div>

                    <Title level={5} style={{ color: '#fff', marginBottom: 12 }}>📝 分镜场景时间线</Title>
                    {script.scenes?.map((scene: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        background: '#27272a',
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 12,
                        borderLeft: '4px solid #6366f1'
                      }}>
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <Tag color="geekblue" style={{ borderRadius: 4 }}>镜 {index + 1}</Tag>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Paragraph style={{ color: '#fff', fontSize: 13, margin: '0 0 4px 0' }}>{scene.description}</Paragraph>
                          <Text style={{ color: '#6366f1', fontSize: 11 }}>旁白: {scene.voiceover}</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description={<span style={{ color: '#52525b' }}>暂无剧本，请先与 AI 导演沟通生成</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 2: STORYBOARD CANVAS */}
        {/* ============================================================== */}
        {activeTab === 'storyboard' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Asset Panel & Controls */}
            <Col span={6} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
              <AssetPanel
                projectId={projectId!}
                materials={projectMaterials}
                injectingMaterialId={injectingMaterial?.id || null}
                onInjectMode={handleInjectMode}
                onMaterialUploaded={(newMaterial) => {
                  setProjectMaterials(prev => [newMaterial, ...prev]);
                }}
              />

              <Card
                title={<span style={{ color: '#fff' }}><AudioOutlined /> 分镜编辑 Co-pilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12 }}
              >
                {/* Chat Message Lists for Storyboard */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, paddingRight: 4 }}>
                  <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 12, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6 }}>
                    💬 <strong>分镜导演 Agent</strong>：我可以帮您批量重写分镜描述、修改转场、微调台词旁白或调整时长。可以直接和我说："把所有镜头的色彩改为冷色调"
                  </div>
                  {chatHistory.slice(1).map((msg, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 10
                    }}>
                      <div style={{
                        maxWidth: '90%',
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#27272a',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        fontSize: 12,
                        lineHeight: 1.4
                      }}>
                        <Paragraph style={{ color: '#fff', margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{msg.content}</Paragraph>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                      <div style={{ background: '#27272a', padding: '6px 10px', borderRadius: '10px 10px 10px 2px', fontSize: 12 }}>
                        <span style={{ color: '#818cf8' }}><LoadingOutlined /> 导演正在修改分镜配置...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #27272a', paddingTop: 8, flexShrink: 0 }}>
                  <TextArea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder="输入修改指令..."
                    autoSize={{ minRows: 2, maxRows: 2 }}
                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 12 }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={isChatting || !chatInput.trim()}
                    onClick={handleSendChatMessage}
                    style={{ height: 'auto', background: '#4f46e5', border: 'none' }}
                  />
                </div>
              </Card>
            </Col>

            {/* Right: Grid of Scene Form Cards */}
            <Col span={18} style={{ height: '100%', overflowY: 'auto' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#fff' }}><VideoCameraOutlined /> 🎬 分镜视觉首帧编辑面板 (支持 AI 生图及手动上传图片)</span>
                    <Space size="middle">
                      {injectingMaterial && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#818cf8' }}>点击分镜卡片注入参考图 →</span>
                          <Button size="small" onClick={cancelInjectMode} style={{ background: '#27272a', border: 'none', color: '#a1a1aa' }}>取消</Button>
                        </div>
                      )}
                      {/* Agent 批量操作 */}
                      <Popover
                        title="🤖 Agent 智能工具箱"
                        content={
                          <div style={{ minWidth: 220 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Button 
                                type="primary" 
                                icon={<ThunderboltOutlined />} 
                                block
                                onClick={optimizeAllScenes}
                              >
                                一键智能优化
                              </Button>
                              <Divider style={{ margin: '8px 0' }} />
                              <Text style={{ fontSize: 12, color: '#666' }}>批量操作：</Text>
                              <Button 
                                size="small" 
                                block 
                                onClick={() => batchOptimize('consistency')}
                              >
                                统一风格
                              </Button>
                              <Button 
                                size="small" 
                                block 
                                onClick={() => batchOptimize('duration')}
                              >
                                调整时长
                              </Button>
                              <Button 
                                size="small" 
                                block 
                                onClick={() => batchOptimize('voiceover')}
                              >
                                优化配音
                              </Button>
                            </Space>
                          </div>
                        }
                        trigger="click"
                      >
                        <Button
                          type="default"
                          icon={<ApiOutlined />}
                          style={{ background: '#1890ff', border: 'none', color: '#fff', borderRadius: 6 }}
                        >
                          Agent 工具箱
                        </Button>
                      </Popover>
                      
                      <Button
                        type="default"
                        icon={<PictureOutlined />}
                        onClick={handleRenderAllImages}
                        disabled={!script || !script.scenes || script.scenes.length === 0}
                        style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: 6 }}
                      >
                        一键生成所有图片
                      </Button>
                    </Space>
                  </div>
                }
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
              >
                {script && script.scenes && script.scenes.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {script.scenes.map((scene: Scene, index: number) => (
                      <Col span={12} key={index}>
                        <Card
                          hoverable={!!injectingMaterial}
                          onClick={() => {
                            if (injectingMaterial) {
                              handleSceneCardClick(index);
                            }
                          }}
                          style={{
                            background: '#18181c',
                            border: injectingMaterial ? '2px dashed #6366f1' : '1px solid #27272a',
                            borderRadius: 8,
                            cursor: injectingMaterial ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            boxShadow: injectingMaterial ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
                          }}
                          bodyStyle={{ padding: 16 }}
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space>
                                <span style={{ color: '#fff', fontWeight: 600 }}>分镜 {index + 1}</span>
                                {!!scene.imageUrl ? (
                                  <Tag color="blue">首帧已就绪</Tag>
                                ) : (
                                  <Tag color="default">待生图/待上传</Tag>
                                )}
                                {(scene.rendering || scene.status === 'generating') && (
                                  <Tag color="processing" icon={<LoadingOutlined />}>生图中</Tag>
                                )}
                                {scene.status === 'error' && <Tag color="error">失败</Tag>}
                              </Space>
                              <Space>
                                {/* Agent 建议按钮 */}
                                <Popover
                                  title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>🤖 智能建议</span>
                                      <Button 
                                        type="link" 
                                        size="small" 
                                        onClick={() => getAgentSuggestions(index)}
                                        style={{ padding: 0, fontSize: 12 }}
                                      >
                                        刷新
                                      </Button>
                                    </div>
                                  }
                                  content={
                                    <div style={{ width: 320 }}>
                                      {isAgentLoading && selectedSceneForSuggestions === index ? (
                                        <div style={{ textAlign: 'center', padding: '20px' }}>
                                          <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Agent 正在分析中...</p>
                                        </div>
                                      ) : selectedSceneForSuggestions === index && agentSuggestions.length > 0 ? (
                                        <List
                                          dataSource={agentSuggestions}
                                          renderItem={(item) => (
                                            <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                              <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</span>
                                                  <Tag color="orange" style={{ fontSize: 10 }}>Cost: {item.cost} ⚡</Tag>
                                                </div>
                                                <p style={{ fontSize: 11, color: '#666', margin: 0, marginBottom: 6 }}>{item.content}</p>
                                                <Button 
                                                  type="primary" 
                                                  size="small" 
                                                  style={{ fontSize: 11, height: '24px' }}
                                                  onClick={() => applyAgentSuggestion(item, index)}
                                                >
                                                  应用
                                                </Button>
                                              </div>
                                            </List.Item>
                                          )}
                                        />
                                      ) : (
                                        <div style={{ textAlign: 'center', padding: '20px' }}>
                                          <BulbOutlined style={{ fontSize: 24, color: '#ffc107' }} />
                                          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>点击获取智能建议</p>
                                          <Button 
                                            type="primary" 
                                            size="small"
                                            onClick={() => getAgentSuggestions(index)}
                                          >
                                            获取建议
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  }
                                  trigger="click"
                                  placement="topRight"
                                  onVisibleChange={(visible) => {
                                    if (visible && selectedSceneForSuggestions !== index) {
                                      setSelectedSceneForSuggestions(index);
                                    }
                                  }}
                                >
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<BulbOutlined />}
                                    style={{ color: '#ffa940', padding: 0 }}
                                  >
                                    建议
                                  </Button>
                                </Popover>
                                
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(index);
                                  }}
                                  style={{ color: '#818cf8', padding: 0 }}
                                >
                                  编辑
                                </Button>
                              </Space>
                            </div>
                          }
                        >
                          <Row gutter={12}>
                            {/* Left part of card: Preview player / generator placeholder */}
                            <Col span={10}>
                              <div style={{
                                position: 'relative',
                                width: '100%',
                                height: 160,
                                background: '#09090b',
                                border: '1px dashed #27272a',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}>
                                {/* Reference image corner badge */}
                                {scene.referenceImageUrl && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 6,
                                    left: 6,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 4,
                                    border: '1.5px solid #6366f1',
                                    overflow: 'hidden',
                                    zIndex: 10,
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)'
                                  }} title="已关联商品参考图">
                                    <img src={scene.referenceImageUrl} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                )}

                                {(scene.rendering || scene.status === 'generating') ? (
                                  <div style={{ textAlign: 'center', padding: 8 }}>
                                    <LoadingOutlined style={{ fontSize: 24, color: '#6366f1', marginBottom: 8 }} />
                                    <div style={{ fontSize: 11, color: '#888' }}>正在生图...</div>
                                  </div>
                                ) : !!scene.imageUrl ? (
                                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img src={scene.imageUrl} alt="首帧图片" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        clearSceneImage(index, 'main');
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        opacity: 0.8,
                                        height: 24,
                                        minWidth: 24,
                                        padding: '0 4px',
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', color: '#52525b', padding: 8 }}>
                                    <PictureOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                                    <div style={{ fontSize: 10 }}>暂无首帧画面</div>
                                  </div>
                                )}
                              </div>

                              {/* CONDITIONAL PREVIEW ACTIONS BASED ON WORKFLOW STATE */}
                              {!scene.rendering && (
                                <div style={{ marginTop: 8 }}>
                                  {!scene.imageUrl ? (
                                    <>
                                      <Button
                                        type="primary"
                                        size="small"
                                        icon={<PictureOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          generateSingleSceneImage(index);
                                        }}
                                        style={{
                                          width: '100%',
                                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                          border: 'none',
                                          borderRadius: 4,
                                          fontSize: 12
                                        }}
                                      >
                                        🎨 AI生图
                                      </Button>
                                      <div style={{ marginTop: 6 }}>
                                        <Button
                                          size="small"
                                          icon={<PlusOutlined />}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = async (e: any) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                message.loading(`正在上传 "${file.name}"...`, 0);
                                                try {
                                                  const res = await fetch(`${API_BASE}/api/upload`, {
                                                    method: 'POST',
                                                    body: formData
                                                  });
                                                  const uploadData = await res.json();
                                                  message.destroy();
                                                  if (uploadData.success && uploadData.url) {
                                                    message.success('分镜首帧上传成功！');
                                                    updateSceneField(index, 'imageUrl', uploadData.url);
                                                    updateSceneField(index, 'status', 'image_completed');
                                                    // Sync completed status to steps
                                                    setWorkflowNodes(prev => prev.map(n => n.id === 'storyboard' ? { ...n, status: 'completed' } : n));
                                                  } else {
                                                    throw new Error(uploadData.error || '上传失败');
                                                  }
                                                } catch (err: any) {
                                                  message.error('上传失败: ' + err.message);
                                                }
                                              }
                                            };
                                            input.click();
                                          }}
                                          style={{
                                            width: '100%',
                                            background: '#27272a',
                                            border: '1px solid #3f3f46',
                                            color: '#fff',
                                            borderRadius: 4,
                                            fontSize: 12
                                          }}
                                        >
                                          📤 上传图片
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          generateSingleSceneImage(index);
                                        }}
                                        style={{ fontSize: 11, padding: 0, height: 'auto', color: '#a1a1aa' }}
                                      >
                                        🎨 重新生图
                                      </Button>
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.onchange = async (e: any) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const formData = new FormData();
                                              formData.append('file', file);
                                              message.loading(`正在上传 "${file.name}"...`, 0);
                                              try {
                                                const res = await fetch(`${API_BASE}/api/upload`, {
                                                  method: 'POST',
                                                  body: formData
                                                });
                                                const uploadData = await res.json();
                                                message.destroy();
                                                if (uploadData.success && uploadData.url) {
                                                  message.success('分镜图片替换成功！');
                                                  updateSceneField(index, 'imageUrl', uploadData.url);
                                                  updateSceneField(index, 'status', 'image_completed');
                                                } else {
                                                  throw new Error(uploadData.error || '上传失败');
                                                }
                                              } catch (err: any) {
                                                message.error('上传失败: ' + err.message);
                                              }
                                            }
                                          };
                                          input.click();
                                        }}
                                        style={{ fontSize: 11, padding: 0, height: 'auto', color: '#818cf8' }}
                                      >
                                        📤 重新上传
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* SLEEK TTS AUDIO PLAYBACK BAR */}
                              {scene.audioUrl && (
                                <div style={{ marginTop: 8, padding: '4px 8px', background: '#202023', borderRadius: 4, border: '1px solid #2e2e33' }}>
                                  <div style={{ fontSize: 10, color: '#34d399', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span>🎙️ 旁白配音就绪</span>
                                    {scene.ttsEstDuration && <span style={{ opacity: 0.6 }}>({scene.ttsEstDuration}s)</span>}
                                  </div>
                                  <audio src={scene.audioUrl} controls style={{ width: '100%', height: 18 }} />
                                </div>
                              )}
                            </Col>

                            {/* Right part of card: Editable input forms */}
                            <Col span={14}>
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11 }}>分镜视觉提示词：</Text>
                                  <TextArea
                                    value={scene.description}
                                    onChange={(e) => updateSceneField(index, 'description', e.target.value)}
                                    rows={2}
                                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 11.5 }}
                                  />
                                </div>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11 }}>旁白配音：</Text>
                                  <TextArea
                                    value={scene.voiceover}
                                    onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                                    rows={1}
                                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 11.5 }}
                                  />
                                </div>
                                
                                {/* 声音参考 */}
                                <div>
                                  <Row gutter={8} align="middle">
                                    <Col span={24}>
                                      <Text type="secondary" style={{ fontSize: 10, marginBottom: 4, display: 'block' }}>
                                        🎵 声音参考（可选）
                                      </Text>
                                    </Col>
                                  </Row>
                                  {scene.referenceAudioUrl ? (
                                    <div style={{
                                      background: '#202023',
                                      borderRadius: 4,
                                      padding: 8,
                                      border: '1px solid #818cf8',
                                    }}>
                                      <Row gutter={8} align="middle">
                                        <Col span={18}>
                                          <audio 
                                            src={scene.referenceAudioUrl} 
                                            controls 
                                            style={{ width: '100%', height: 24 }} 
                                          />
                                        </Col>
                                        <Col span={6}>
                                          <Button
                                            size="small"
                                            danger
                                            block
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updateSceneField(index, 'referenceAudioUrl', undefined);
                                              message.info('🗑️ 已清除声音参考');
                                            }}
                                            style={{ height: 24, fontSize: 10 }}
                                          >
                                            删除
                                          </Button>
                                        </Col>
                                      </Row>
                                    </div>
                                  ) : (
                                    <Button
                                      type="dashed"
                                      size="small"
                                      block
                                      icon={<AudioOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'audio/*';
                                        input.onchange = async (e: any) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            message.loading(`正在上传声音参考 "${file.name}"...`, 0);
                                            try {
                                              const res = await fetch(`${API_BASE}/api/upload`, {
                                                method: 'POST',
                                                body: formData
                                              });
                                              const uploadData = await res.json();
                                              message.destroy();
                                              if (uploadData.success && uploadData.url) {
                                                updateSceneField(index, 'referenceAudioUrl', uploadData.url);
                                                message.success('🎵 声音参考上传成功！');
                                              } else {
                                                throw new Error(uploadData.error || '上传失败');
                                              }
                                            } catch (err: any) {
                                              message.error('上传失败: ' + err.message);
                                            }
                                          }
                                        };
                                        input.click();
                                      }}
                                      style={{ 
                                        background: 'rgba(129, 140, 248, 0.1)', 
                                        border: '1px dashed #818cf8',
                                        color: '#818cf8',
                                        fontSize: 11,
                                        height: 28
                                      }}
                                    >
                                      📤 上传声音参考（配音语气/节奏参考）
                                    </Button>
                                  )}
                                </div>
                                <Row gutter={8}>
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>时长(秒):</Text>
                                    <Input
                                      type="number"
                                      value={scene.duration}
                                      onChange={(e) => updateSceneField(index, 'duration', parseInt(e.target.value) || 3)}
                                      style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', height: 26, fontSize: 11 }}
                                    />
                                  </Col>
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>镜头:</Text>
                                    <Select
                                      value={scene.shot_type}
                                      onChange={(val) => updateSceneField(index, 'shot_type', val)}
                                      style={{ width: '100%', height: 26 }}
                                      size="small"
                                    >
                                      <Option value="特写">特写</Option>
                                      <Option value="中景">中景</Option>
                                      <Option value="全景">全景</Option>
                                    </Select>
                                  </Col>
                                </Row>
                                <Divider style={{ margin: '8px 0', borderColor: '#27272a' }} />
                                <Row gutter={8}>
                                  {/* 首帧 */}
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>首帧</Text>
                                    <div style={{
                                      height: 60,
                                      background: '#09090b',
                                      border: '1px dashed #27272a',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      overflow: 'hidden',
                                      position: 'relative',
                                    }} onClick={(e) => {
                                      e.stopPropagation();
                                      uploadFrameImage(index, 'first');
                                    }}>
                                      {!!scene.firstFrameUrl ? (
                                        <>
                                          <img src={scene.firstFrameUrl} alt="首帧" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              clearSceneImage(index, 'first');
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: 2,
                                              right: 2,
                                              opacity: 0.8,
                                              height: 18,
                                              minWidth: 18,
                                              padding: '0 2px',
                                              fontSize: 10,
                                            }}
                                          />
                                        </>
                                      ) : (
                                        <span style={{ fontSize: 9, color: '#52525b' }}>点击上传</span>
                                      )}
                                    </div>
                                  </Col>
                                  {/* 尾帧 */}
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>尾帧</Text>
                                    <div style={{
                                      height: 60,
                                      background: '#09090b',
                                      border: '1px dashed #27272a',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      overflow: 'hidden',
                                      position: 'relative',
                                    }} onClick={(e) => {
                                      e.stopPropagation();
                                      uploadFrameImage(index, 'last');
                                    }}>
                                      {!!scene.lastFrameUrl ? (
                                        <>
                                          <img src={scene.lastFrameUrl} alt="尾帧" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              clearSceneImage(index, 'last');
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: 2,
                                              right: 2,
                                              opacity: 0.8,
                                              height: 18,
                                              minWidth: 18,
                                              padding: '0 2px',
                                              fontSize: 10,
                                            }}
                                          />
                                        </>
                                      ) : (
                                        <span style={{ fontSize: 9, color: '#52525b' }}>点击上传</span>
                                      )}
                                    </div>
                                  </Col>
                                </Row>
                              </Space>
                            </Col>
                          </Row>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description={<span style={{ color: '#888' }}>暂无分镜场景数据，请先生成剧本</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 3: VIDEO RENDERING DASHBOARD */}
        {/* ============================================================== */}
        {activeTab === 'video' && (
          <Row gutter={24} style={{ height: '100%' }}>
            <Col span={24} style={{ height: '100%', overflowY: 'auto' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#fff' }}><PlayCircleOutlined /> 🎬 分镜视频渲染仪表盘</span>
                    <Space size="large">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#a1a1aa' }}>同时生成并同步旁白配音:</span>
                        <Switch
                          checked={settings.enableTTS}
                          onChange={(val) => updateSettings({ ...settings, enableTTS: val })}
                          checkedChildren="开启"
                          unCheckedChildren="关闭"
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        loading={isRenderingAllScenes}
                        onClick={handleRenderAllScenes}
                        disabled={!script || !script.scenes || script.scenes.length === 0}
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 6, height: 38 }}
                      >
                        ⚡ 一键渲染所有分镜
                      </Button>
                    </Space>
                  </div>
                }
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
              >
                {script && script.scenes && script.scenes.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {script.scenes.map((scene: Scene, index: number) => (
                      <Col span={8} key={index}>
                        <Card
                          style={{
                            background: '#202023',
                            border: '1px solid #2e2e33',
                            borderRadius: 8
                          }}
                          bodyStyle={{ padding: 12 }}
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>分镜 {index + 1} ({scene.duration}秒)</span>
                              <Space>
                                {scene.videoUrl ? (
                                  <Tag color="success">视频就绪</Tag>
                                ) : (scene.rendering || scene.status === 'generating') ? (
                                  <Tag color="processing" icon={<LoadingOutlined />}>正在生成</Tag>
                                ) : (
                                  <Tag color="default">等待渲染</Tag>
                                )}
                                {scene.audioUrl && <Tag color="cyan">配音同步</Tag>}
                              </Space>
                            </div>
                          }
                        >
                          {/* Visual Player Center */}
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            height: 180,
                            background: '#09090b',
                            borderRadius: 6,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #27272a',
                            marginBottom: 12
                          }}>
                            {scene.videoUrl ? (
                              <video src={scene.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (scene.rendering || scene.status === 'generating') ? (
                              <div style={{ textAlign: 'center', padding: 8 }}>
                                <LoadingOutlined style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }} />
                                <div style={{ fontSize: 12, color: '#a1a1aa' }}>后台渲染中 ({scene.progress || 10}%)</div>
                              </div>
                            ) : scene.imageUrl ? (
                              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                <img src={scene.imageUrl} alt="首帧" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                <div style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(0,0,0,0.4)'
                                }}>
                                  <span style={{ color: '#fff', fontSize: 11, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4 }}>
                                    首帧就绪，待生成视频
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', color: '#52525b' }}>
                                <PictureOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                <div style={{ fontSize: 11 }}>请先在分镜编辑中准备首帧</div>
                              </div>
                            )}
                          </div>

                          {/* Scene Script Reference Details */}
                          <div style={{ background: '#18181b', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 2 }}>分镜视觉 Prompt:</div>
                            <div style={{ fontSize: 11, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4, height: 30, marginBottom: 6 }}>
                              {scene.description}
                            </div>
                            <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 2 }}>旁白台词:</div>
                            <div style={{ fontSize: 11, color: '#818cf8', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                              {scene.voiceover || '无'}
                            </div>
                          </div>

                          {/* Narration Player Wave */}
                          {scene.audioUrl && (
                            <div style={{ padding: '6px 10px', background: '#18181b', borderRadius: 6, border: '1px solid #2e2e33', marginBottom: 10 }}>
                              <div style={{ fontSize: 10, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>🎙️ 旁白配音预听</span>
                                {scene.ttsEstDuration && <span style={{ opacity: 0.6 }}>({scene.ttsEstDuration}s)</span>}
                              </div>
                              <audio src={scene.audioUrl} controls style={{ width: '100%', height: 20 }} />
                            </div>
                          )}

                          {/* Render Actions */}
                          {!scene.rendering && (
                            <div>
                              {!scene.videoUrl ? (
                                <Button
                                  type="primary"
                                  block
                                  icon={<PlayCircleOutlined />}
                                  onClick={() => generateSingleSceneVideo(index)}
                                  disabled={!scene.imageUrl}
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: 6,
                                    height: 32
                                  }}
                                >
                                  🎥 渲染分镜视频
                                </Button>
                              ) : (
                                <Button
                                  type="default"
                                  block
                                  onClick={() => generateSingleSceneVideo(index)}
                                  style={{
                                    background: 'transparent',
                                    border: '1px dashed #3f3f46',
                                    color: '#a1a1aa',
                                    borderRadius: 6,
                                    height: 32
                                  }}
                                >
                                  🔄 重新渲染分镜
                                </Button>
                              )}
                            </div>
                          )}
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description={<span style={{ color: '#888' }}>暂无分镜场景数据，请先生成剧本分镜</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 3.5: AUDIO & VOICEOVER TRACKS */}
        {/* ============================================================== */}
        {activeTab === 'audio' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Global Audio Settings & Agent Panel */}
            <Col span={8} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
              <Card
                title={<span style={{ color: '#fff' }}><CustomerServiceOutlined /> 全局音频设置</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>1. 发音人选择</Text></div>
                    <Select
                      value={settings.voice}
                      onChange={(val) => updateSettings({ ...settings, voice: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="zh_female_story">👩 知性温柔带货主播</Option>
                      <Option value="zh_male_narrator">👨 激情热烈好物解说员</Option>
                      <Option value="zh_male_technology">🧑‍💻 专业科技电子产品专家</Option>
                      <Option value="zh_female_chitchat">👧 轻快甜美生活好物推介</Option>
                    </Select>
                  </div>
                  
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>2. 配音语速</Text></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#a1a1aa', fontSize: 12 }}>慢速</span>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>{settings.speed}x</span>
                      <span style={{ color: '#a1a1aa', fontSize: 12 }}>快速</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={settings.speed}
                      onChange={(val) => updateSettings({ ...settings, speed: val })}
                    />
                  </div>
                  
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>3. 背景音乐选择</Text></div>
                    <Select
                      value={settings.bgm}
                      onChange={(val) => updateSettings({ ...settings, bgm: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="cheerful.mp3">🎵 轻快乐活好物推介</Option>
                      <Option value="energetic.mp3">🔥 激情劲爆带货抢购</Option>
                      <Option value="smooth_jazz.mp3">🎷 优雅高级精致小资</Option>
                      <Option value="none">❌ 不配背景音乐</Option>
                    </Select>
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#fff' }}>4. 背景音乐音量</Text>
                      <Text style={{ color: '#a1a1aa' }}>{settings.volume}%</Text>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      value={settings.volume}
                      onChange={(val) => updateSettings({ ...settings, volume: val })}
                    />
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text strong style={{ color: '#fff' }}>5. 启用 AI 配音</Text>
                      <Switch checked={settings.enableTTS} onChange={(val) => updateSettings({ ...settings, enableTTS: val })} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {settings.enableTTS ? '✅ 所有分镜将自动生成 AI 配音' : '❌ 仅使用背景音乐，无配音旁白'}
                    </Text>
                  </div>
                </Space>
              </Card>
              
              <Card
                title={<span style={{ color: '#fff' }}><ApiOutlined /> 音频 AI 助手</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 智能优化您的配音文案
                  </Text>
                  
                  <Button
                    type="default"
                    icon={<SkinOutlined />}
                    block
                    onClick={() => {
                      message.info('🎨 优化中：让所有配音更有感染力...');
                    }}
                    style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316' }}
                  >
                    ✨ 优化所有配音文案（让配音更有感染力）
                  </Button>
                  
                  <Button
                    type="default"
                    icon={<GlobalOutlined />}
                    block
                    onClick={() => {
                      message.info('🌐 检查文案一致性中...');
                    }}
                  >
                    🔗 统一全部分镜的配音风格
                  </Button>
                  
                  <Button
                    type="default"
                    icon={<ExperimentOutlined />}
                    block
                    onClick={() => {
                      message.info('📝 分析配音长度中...');
                    }}
                  >
                    ⏱️ 智能调整文案长度以匹配画面时长
                  </Button>
                  
                  <Divider style={{ margin: '8px 0', borderColor: '#27272a' }} />
                  
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    🔧 快速操作
                  </Text>
                  
                  <Button
                    type="primary"
                    block
                    onClick={() => {
                      if (!script?.scenes) return;
                      const newScenes = script.scenes.map((scene: any) => ({
                        ...scene,
                        voiceover: scene.voiceover || ''
                      }));
                      updateScript({ ...script, scenes: newScenes });
                      message.success('✅ 已统一初始化所有配音文案');
                    }}
                    style={{ background: '#10b981', border: 'none' }}
                  >
                    🎯 批量初始化配音
                  </Button>
                  
                  <Button
                    type="default"
                    danger
                    block
                    onClick={() => {
                      if (!script?.scenes) return;
                      const newScenes = script.scenes.map((scene: any) => ({
                        ...scene,
                        voiceover: '',
                        audioUrl: undefined,
                        ttsEstDuration: undefined
                      }));
                      updateScript({ ...script, scenes: newScenes });
                      message.warning('⚠️ 已清空所有配音数据');
                    }}
                  >
                    🗑️ 清空所有配音
                  </Button>
                </Space>
              </Card>
            </Col>
            
            {/* Right: Detailed Voiceover Track Editor */}
            <Col span={16} style={{ height: '100%', overflowY: 'auto' }}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff' }}><AudioOutlined /> 分镜配音轨道编辑器</span>
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => {
                          if (!script?.scenes) return;
                          const hasMissing = script.scenes.some((scene: any) => !scene.voiceover);
                          if (hasMissing) {
                            message.warning('⚠️ 部分分镜还没有配音文案');
                          } else {
                            message.success('✅ 开始批量生成配音...');
                          }
                        }}
                      >
                        🎙️ 批量生成所有配音
                      </Button>
                    </Space>
                  </div>
                }
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%' }}
              >
                {script?.scenes?.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {script.scenes.map((scene: any, index: number) => (
                      <Card
                        key={index}
                        size="small"
                        style={{
                          background: '#202023',
                          border: scene.audioUrl ? '1px solid #10b981' : '1px solid #27272a',
                          borderRadius: 8
                        }}
                      >
                        <Row gutter={16}>
                          <Col span={4}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                              <Tag color={scene.audioUrl ? 'success' : 'default'} style={{ fontSize: 12 }}>
                                {scene.audioUrl ? '✅ 已配音' : '⏳ 待配音'}
                              </Tag>
                              <Text style={{ color: '#888', fontSize: 11 }}>
                                分镜 {index + 1}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                ⏱️ {scene.duration}s
                              </Text>
                            </div>
                          </Col>
                          
                          <Col span={14}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <TextArea
                                value={scene.voiceover}
                                onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                                placeholder="输入该分镜的旁白配音文案..."
                                rows={3}
                                style={{ 
                                  background: '#09090b', 
                                  color: '#fff', 
                                  border: '1px solid #27272a',
                                  fontSize: 12
                                }}
                              />
                              
                              {scene.audioUrl && (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
                                    🎧 已生成配音
                                    {scene.ttsEstDuration && <span style={{ marginLeft: 8 }}>时长: {scene.ttsEstDuration}s</span>}
                                  </Text>
                                  <audio 
                                    src={scene.audioUrl} 
                                    controls 
                                    style={{ width: '100%', height: 28 }} 
                                  />
                                </div>
                              )}
                              
                              {/* 声音参考 */}
                              <div>
                                <Text type="secondary" style={{ fontSize: 10, marginBottom: 4, display: 'block' }}>
                                  🎵 声音参考（可选）
                                </Text>
                                {scene.referenceAudioUrl ? (
                                  <div style={{
                                    background: '#202023',
                                    borderRadius: 4,
                                    padding: 6,
                                    border: '1px solid #818cf8',
                                  }}>
                                    <Row gutter={4} align="middle">
                                      <Col span={18}>
                                        <audio 
                                          src={scene.referenceAudioUrl} 
                                          controls 
                                          style={{ width: '100%', height: 24 }} 
                                        />
                                      </Col>
                                      <Col span={6}>
                                        <Button
                                          size="small"
                                          danger
                                          block
                                          onClick={(e) => {
                                            updateSceneField(index, 'referenceAudioUrl', undefined);
                                            message.info('🗑️ 已清除声音参考');
                                          }}
                                          style={{ height: 24, fontSize: 9, padding: '0 4px' }}
                                        >
                                          删除
                                        </Button>
                                      </Col>
                                    </Row>
                                  </div>
                                ) : (
                                  <Button
                                    type="dashed"
                                    size="small"
                                    block
                                    icon={<AudioOutlined />}
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'audio/*';
                                      input.onchange = async (e: any) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const formData = new FormData();
                                          formData.append('file', file);
                                          message.loading(`正在上传声音参考 "${file.name}"...`, 0);
                                          try {
                                            const res = await fetch(`${API_BASE}/api/upload`, {
                                              method: 'POST',
                                              body: formData
                                            });
                                            const uploadData = await res.json();
                                            message.destroy();
                                            if (uploadData.success && uploadData.url) {
                                              updateSceneField(index, 'referenceAudioUrl', uploadData.url);
                                              message.success('🎵 声音参考上传成功！');
                                            } else {
                                              throw new Error(uploadData.error || '上传失败');
                                            }
                                          } catch (err: any) {
                                            message.error('上传失败: ' + err.message);
                                          }
                                        }
                                      };
                                      input.click();
                                    }}
                                    style={{ 
                                      background: 'rgba(129, 140, 248, 0.08)', 
                                      border: '1px dashed #818cf8',
                                      color: '#818cf8',
                                      fontSize: 10,
                                      height: 26
                                    }}
                                  >
                                    📤 上传声音参考
                                  </Button>
                                )}
                              </div>
                            </Space>
                          </Col>
                          
                          <Col span={6}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Button
                                type="primary"
                                size="small"
                                block
                                icon={<AudioOutlined />}
                                disabled={!scene.voiceover}
                                onClick={() => {
                                  message.loading(`🎙️ 正在生成分镜 ${index + 1} 的配音...`, 1);
                                  setTimeout(() => {
                                    updateSceneField(index, 'audioUrl', 'https://example.com/demo-audio.mp3');
                                    updateSceneField(index, 'ttsEstDuration', scene.duration);
                                    message.success(`✅ 分镜 ${index + 1} 配音生成成功！`);
                                  }, 1500);
                                }}
                              >
                                {scene.audioUrl ? '🔄 重新生成' : '🎙️ 生成配音'}
                              </Button>
                              
                              {scene.audioUrl && (
                                <Button
                                  size="small"
                                  block
                                  onClick={() => {
                                    updateSceneField(index, 'audioUrl', undefined);
                                    updateSceneField(index, 'ttsEstDuration', undefined);
                                    message.info(`🗑️ 已清除分镜 ${index + 1} 的配音`);
                                  }}
                                >
                                  🗑️ 清除配音
                                </Button>
                              )}
                              
                              <Divider style={{ margin: '4px 0', borderColor: '#27272a' }} />
                              
                              <Button
                                type="default"
                                size="small"
                                block
                                icon={<BulbOutlined />}
                                style={{ fontSize: 11 }}
                                onClick={() => {
                                  const suggestions = [
                                    '增加一点激情！',
                                    '使用更亲切的语气',
                                    '强调产品优势'
                                  ];
                                  const random = suggestions[Math.floor(Math.random() * suggestions.length)];
                                  updateSceneField(index, 'voiceover', (scene.voiceover || '') + ' ' + random);
                                  message.success(`💡 已应用优化建议: ${random}`);
                                }}
                              >
                                💡 AI 优化
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Empty description={<span style={{ color: '#888' }}>暂无分镜数据，请先在「剧本策划」中创建剧本</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 4: COMPILATION & OUTPUT */}
        {/* ============================================================== */}
        {activeTab === 'render' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Resolution, Ratio, transition configs & AI Clip Agent planner */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
              <Card
                title={<span style={{ color: '#fff' }}><RocketOutlined /> 视频最终渲染编译设置</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flexShrink: 0 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>1. 分辨率选择 (Resolution)</Text></div>
                    <Select
                      value={settings.resolution}
                      onChange={(val) => updateSettings({ ...settings, resolution: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="480p">480p (流畅导出 - 渲染极快)</Option>
                      <Option value="720p">720p (标清带货 - 推荐画质)</Option>
                      <Option value="1080p">1080p (高清精美 - 适合高配机型)</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>2. 画面幅面比 (Aspect Ratio)</Text></div>
                    <Select
                      value={settings.ratio}
                      onChange={(val) => updateSettings({ ...settings, ratio: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="9:16">📱 9:16 (竖屏 - 适合抖音/快手短视频)</Option>
                      <Option value="16:9">🖥️ 16:9 (横屏 - 适合哔哩哔哩/常规PC播放)</Option>
                      <Option value="1:1">⬛ 1:1 (正方形 - 适合社交平台展示)</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>3. 分镜转场效果 (Transitions)</Text></div>
                    <Select
                      value={settings.transition}
                      onChange={(val) => updateSettings({ ...settings, transition: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="fade">🌀 渐显淡入淡出转场 (Cross Fade)</Option>
                      <Option value="cut">⚡ 极速硬切镜头转场 (Direct Cut)</Option>
                      <Option value="flash">✨ 闪白转场效果 (White Flash)</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>4. 配音发音人角色 (Speaker Role)</Text></div>
                    <Select
                      value={settings.voice}
                      onChange={(val) => updateSettings({ ...settings, voice: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="zh_female_story">知性温柔带货主播（推荐）</Option>
                      <Option value="zh_male_narrator">激情热烈好物解说员</Option>
                      <Option value="zh_male_technology">专业科技电子产品专家</Option>
                      <Option value="zh_female_chitchat">轻快甜美生活好物推介</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>5. 带货背景音乐 (BGM Soundtrack)</Text></div>
                    <Select
                      value={settings.bgm}
                      onChange={(val) => updateSettings({ ...settings, bgm: val })}
                      style={{ width: '100%' }}
                    >
                      <Option value="cheerful.mp3">轻快乐活好物推介 (Cheerful BGM)</Option>
                      <Option value="energetic.mp3">激情劲爆带货抢购 (Energetic EDM)</Option>
                      <Option value="smooth_jazz.mp3">优雅高级精致小资 (Smooth Jazz)</Option>
                      <Option value="none">不配背景乐 (None)</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#fff' }}>6. 背景音乐音量混音比例</Text>
                      <Text style={{ color: '#a1a1aa' }}>{settings.volume}%</Text>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      value={settings.volume}
                      onChange={(val) => updateSettings({ ...settings, volume: val })}
                    />
                  </div>

                  <Divider style={{ margin: '12px 0', borderTopColor: '#27272a' }} />

                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!script}
                    loading={isRenderingAll}
                    onClick={handleCompileFinalVideo}
                    icon={<PlayCircleOutlined />}
                    style={{
                      height: 52,
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {isRenderingAll ? '正在执行高精编译成片...' : '🎬 一键合成发布带货视频'}
                  </Button>
                </Space>
              </Card>

              {/* AI Video Editor Agent (ClipAgent) */}
              <Card
                title={<span style={{ color: '#fff' }}><ScissorOutlined /> AI 剪辑师 Copilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flexShrink: 0 }}
                bodyStyle={{ padding: 16 }}
              >
                {!clipPlan ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <Paragraph style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 16 }}>
                      AI 剪辑师可以智能分析分镜剧本节奏，编排最佳转场，并精确配平旁白配音与背景乐（BGM）比例！
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<ScissorOutlined />}
                      loading={isPlanningClip}
                      onClick={handleGenerateClipPlan}
                      style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: 6, height: 40 }}
                    >
                      {isPlanningClip ? 'AI 剪辑师正在深度分析中...' : '🧠 召唤 AI 剪辑师制定智能剪辑方案'}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div style={{ background: '#202023', padding: 12, borderRadius: 8, marginBottom: 12, borderLeft: '4px solid #6366f1' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 13.5, marginBottom: 4 }}>🎉 智能剪辑编排方案已应用：</div>
                      <div style={{ color: '#34d399', fontSize: 12, marginBottom: 4 }}>
                        🎵 推荐背景乐: <strong>{clipPlan.audio?.bgm || '欢快乐活'}</strong> | 音量: <strong>{Math.round((clipPlan.audio?.volume || 0.2) * 100)}%</strong>
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: 11.5 }}>
                        AI 建议: 配音音量设为 80% (当前为 {settings.volume}%)，与 BGM 保持完美听觉平衡，防止背景音嘈杂。
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>🎬 分镜智能剪切轨道 (AI Storyboard Transitions):</Text>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {clipPlan.clips?.slice(0, 6).map((clip: any, idx: number) => (
                          <Tag key={idx} color="purple" style={{ borderRadius: 4, margin: 0, padding: '2px 8px', fontSize: 11 }}>
                            镜 {clip.sceneId || idx + 1} ➔ {clip.transition === 'fade' ? '🌀 渐变' : clip.transition === 'flash' ? '✨ 闪白' : '⚡ 硬切'}
                          </Tag>
                        ))}
                        {clipPlan.clips?.length > 6 && <Tag color="default" style={{ borderRadius: 4, margin: 0, padding: '2px 8px', fontSize: 11 }}>+ {clipPlan.clips.length - 6} 个分镜</Tag>}
                      </div>
                    </div>

                    <Button
                      type="dashed"
                      block
                      onClick={handleGenerateClipPlan}
                      loading={isPlanningClip}
                      style={{ color: '#818cf8', borderColor: '#4f46e5', background: 'transparent', height: 32, borderRadius: 6 }}
                    >
                      🔄 重新评估剪辑方案
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            {/* Right: Render Monitoring Dashboard & final persistent video player */}
            <Col span={14} style={{ height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><VideoCameraOutlined /> 渲染终端 & 最终预览大盘</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {/* When rendering is active */}
                {isRenderingAll && (
                  <div style={{ background: '#202023', padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 20 }}>
                    <Progress type="circle" percent={renderProgress} strokeColor={{ '0%': '#10b981', '100%': '#6366f1' }} width={120} />
                    <div style={{ marginTop: 20, fontWeight: 500, color: '#fff' }}>{renderStatus}</div>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                      后台 FFmpeg 与大声轨合成器正在飞速运作，请稍候片刻...
                    </Text>
                  </div>
                )}

                {/* Final Rendered Video Player */}
                {finalVideoUrl ? (
                  <div>
                    <div style={{ background: '#202023', padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: '4px solid #10b981' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>🎉 合成完毕：</span>
                      <Text style={{ color: '#a1a1aa', fontSize: 13 }}>最终高精度带货视频已妥善渲染在本地临时存储。</Text>
                    </div>

                    <div style={{
                      width: '100%',
                      background: '#000',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #27272a',
                      boxShadow: '0 12px 24px -8px rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 0'
                    }}>
                      <video src={finalVideoUrl} controls style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 4 }} />
                    </div>

                    <Row gutter={16} style={{ marginTop: 20 }}>
                      <Col span={12}>
                        <Button
                          type="primary"
                          block
                          onClick={() => window.open(finalVideoUrl, '_blank')}
                          style={{ background: '#4f46e5', border: 'none', height: 40, borderRadius: 6 }}
                        >
                          📥 立即下载 MP4 高清带货视频
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          block
                          onClick={() => message.success('已模拟提交至短视频排期发布队列！')}
                          style={{ height: 40, borderRadius: 6, background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                        >
                          🚀 一键分发至社交媒体
                        </Button>
                      </Col>
                    </Row>
                  </div>
                ) : !isRenderingAll ? (
                  <Empty
                    description={<span style={{ color: '#888' }}>视频暂未开始合成。在左侧选择参数后，点击“一键合成”开启智能渲染！</span>}
                    style={{ marginTop: 100 }}
                  />
                ) : null}
              </Card>
            </Col>
          </Row>
        )}

      </Content>

      {/* 分镜编辑模态框 */}
      <Modal
        title={
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
            编辑分镜 {currentEditSceneIndex !== null ? currentEditSceneIndex + 1 : ''}
          </div>
        }
        open={isModalOpen}
        onCancel={closeEditModal}
        onOk={saveSceneEdit}
        okText="保存"
        cancelText="取消"
        maskClosable={false}
        styles={{
          content: { background: '#18181b', border: '1px solid #27272a' },
          header: { borderBottom: '1px solid #27272a', background: '#18181b' },
          footer: { borderTop: '1px solid #27272a', background: '#18181b' }
        }}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            emotion: '',
            transition: 'fade',
            cameraAngle: '',
            lighting: '',
            colorTone: ''
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="description"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>分镜视觉提示词</span>}
              >
                <TextArea
                  rows={3}
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="voiceover"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>旁白配音</span>}
              >
                <TextArea
                  rows={2}
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="duration"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>时长（秒）</span>}
              >
                <Input
                  type="number"
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="shot_type"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>镜头类型</span>}
              >
                <Select style={{ background: '#202023', color: '#fff' }}>
                  <Option value="特写">特写</Option>
                  <Option value="中景">中景</Option>
                  <Option value="全景">全景</Option>
                  <Option value="近景">近景</Option>
                  <Option value="远景">远景</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="transition"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>转场</span>}
              >
                <Select style={{ background: '#202023', color: '#fff' }}>
                  <Option value="fade">渐入渐出</Option>
                  <Option value="cut">硬切</Option>
                  <Option value="flash">闪白</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ borderColor: '#27272a', margin: '16px 0' }} />

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="cameraAngle"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>拍摄角度</span>}
              >
                <Select placeholder="选择角度" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="平视">平视</Option>
                  <Option value="俯视">俯视</Option>
                  <Option value="仰视">仰视</Option>
                  <Option value="侧拍">侧拍</Option>
                  <Option value="斜拍">斜拍</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="lighting"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>光线类型</span>}
              >
                <Select placeholder="选择光线" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="自然光">自然光</Option>
                  <Option value="暖光">暖光</Option>
                  <Option value="冷光">冷光</Option>
                  <Option value="柔光">柔光</Option>
                  <Option value="硬光">硬光</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="colorTone"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>色调</span>}
              >
                <Select placeholder="选择色调" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="冷色调">冷色调</Option>
                  <Option value="暖色调">暖色调</Option>
                  <Option value="黑白">黑白</Option>
                  <Option value="复古">复古</Option>
                  <Option value="鲜艳">鲜艳</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {currentEditSceneIndex !== null && script && script.scenes[currentEditSceneIndex] && (
            <>
              <Divider style={{ borderColor: '#27272a', margin: '16px 0' }} />
              <Text style={{ color: '#a1a1aa', fontSize: 12, display: 'block', marginBottom: 12 }}>
                首尾帧预览（点击图片可重新上传）
              </Text>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{
                    height: 100,
                    background: '#09090b',
                    border: '1px dashed #27272a',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                  }} onClick={() => uploadFrameImage(currentEditSceneIndex, 'first')}>
                    {!!script.scenes[currentEditSceneIndex].firstFrameUrl ? (
                      <>
                        <img
                          src={script.scenes[currentEditSceneIndex].firstFrameUrl}
                          alt="首帧"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSceneImage(currentEditSceneIndex, 'first');
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            opacity: 0.8,
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#52525b' }}>点击上传首帧</span>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    height: 100,
                    background: '#09090b',
                    border: '1px dashed #27272a',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                  }} onClick={() => uploadFrameImage(currentEditSceneIndex, 'last')}>
                    {!!script.scenes[currentEditSceneIndex].lastFrameUrl ? (
                      <>
                        <img
                          src={script.scenes[currentEditSceneIndex].lastFrameUrl}
                          alt="尾帧"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSceneImage(currentEditSceneIndex, 'last');
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            opacity: 0.8,
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#52525b' }}>点击上传尾帧</span>
                    )}
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>
    </Layout>
  );
};

export default WorkbenchPage;
