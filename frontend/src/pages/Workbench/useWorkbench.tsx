import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Form, message, Modal } from 'antd';

// API base address helper
export const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

// Shared Types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SceneStatus = 'idle' | 'generating' | 'completed' | 'error' | 'image_completed';

export interface Scene {
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
  errorMessage?: string;
  // 商品参考图注入
  referenceImageId?: string | null;
  referenceImageUrl?: string | null;
  referenceAudioUrl?: string | null;
  // 画布预留字段
  x?: number | null;
  y?: number | null;
  // 新增字段
  cameraAngle?: string;
  lighting?: string;
  colorTone?: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  agent: string;
  layer: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
}

export const useWorkbench = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'materials';
  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditSceneIndex, setCurrentEditSceneIndex] = useState<number | null>(null);

  // Agent相关状态
  const [selectedSceneForSuggestions, setSelectedSceneForSuggestions] = useState<number | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<Array<{ id: string, title: string, content: string, type: string, cost?: number }>>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

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
    { id: 'script', name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'pending' },
    { id: 'storyboard', name: '分镜编辑', agent: 'ImageAgent', layer: '执行层', status: 'pending' },
    { id: 'video', name: '分镜渲染', agent: 'VideoAgent', layer: '执行层', status: 'pending' },
    { id: 'clip', name: '剪辑合成', agent: 'ClipAgent', layer: '执行层', status: 'pending' },
  ]);
  const [workflowStarted, setWorkflowStarted] = useState(false);

  // 资产注入模式：正在等待用户点选目标分镜的素材
  const [injectingMaterial, setInjectingMaterial] = useState<{ id: string; url: string } | null>(null);

  // 项目素材列表（AssetPanel 数据源）
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);

  // 素材库相关状态
  const [libraryModalVisible, setLibraryModalVisible] = useState(false);
  const [libraryMaterials, setLibraryMaterials] = useState<any[]>([]);
  const [selectedLibraryMaterials, setSelectedLibraryMaterials] = useState<string[]>([]);
  const [librarySearchKeyword, setLibrarySearchKeyword] = useState('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Auto-save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');

  const [project, setProject] = useState<any>(null);
  const [script, setScript] = useState<any>(null);
  const [productInfo, setProductInfo] = useState<any>(null);

  // Sync refs to avoid stale closures in polling intervals and concurrent tasks
  const scriptRef = useRef<any>(null);
  const settingsRef = useRef<any>(settings);

  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chat Co-pilot State
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Strict check on mounting
  useEffect(() => {
    if (!projectId) {
      message.error('未指定项目 ID，正在返回项目列表');
      navigate('/projects');
    }
  }, [projectId, navigate]);

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
          // 修复分镜状态：确保渲染状态被正确初始化
          const normalizedScenes = p.script.scenes?.map((scene: any) => {
            // 确保状态字段存在且有效
            let status = scene.status || 'idle';
            // 如果视频已存在，确保状态是 completed
            if (scene.videoUrl) {
              status = 'completed';
            }
            // 如果图片已存在但视频不存在，状态应为 idle 或 image_completed
            else if (scene.imageUrl) {
              status = scene.status === 'completed' ? 'completed' : (scene.status || 'image_completed');
            }
            // 确保 rendering 状态被正确重置（后台不会保存渲染中状态）
            const rendering = false;

            return {
              ...scene,
              status,
              rendering,
              errorMessage: scene.errorMessage || null,
              progress: scene.progress || 0
            };
          });

          setScript({
            ...p.script,
            scenes: normalizedScenes
          });
          setWorkflowStarted(true);
          setWorkflowNodes([
            { id: 'materials', name: '素材分析', agent: 'AssetAgent', layer: '决策层', status: p.materials?.length > 0 ? 'completed' : 'pending' },
            { id: 'script', name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'completed' },
            { id: 'storyboard', name: '分镜编辑', agent: 'ImageAgent', layer: '执行层', status: normalizedScenes?.some((s: any) => s.imageUrl) ? 'completed' : 'pending' },
            { id: 'video', name: '分镜渲染', agent: 'VideoAgent', layer: '执行层', status: normalizedScenes?.some((s: any) => s.videoUrl) ? 'completed' : 'pending' },
            { id: 'clip', name: '剪辑合成', agent: 'ClipAgent', layer: '执行层', status: p.videoUrl ? 'completed' : 'pending' },
          ]);
        } else {
          setWorkflowStarted(true);
          setWorkflowNodes([
            { id: 'materials', name: '素材分析', agent: 'AssetAgent', layer: '决策层', status: p.materials?.length > 0 ? 'completed' : 'pending' },
            { id: 'script', name: '剧本策划', agent: 'ScriptAgent', layer: '决策层', status: 'pending' },
            { id: 'storyboard', name: '分镜编辑', agent: 'ImageAgent', layer: '执行层', status: 'pending' },
            { id: 'video', name: '分镜渲染', agent: 'VideoAgent', layer: '执行层', status: 'pending' },
            { id: 'clip', name: '剪辑合成', agent: 'ClipAgent', layer: '执行层', status: 'pending' },
          ]);
        }
        if (p.product_info) {
          setProductInfo(p.product_info);
        }
        if (p.settings) setSettings(prev => ({ ...prev, ...p.settings }));
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
  const handleSave = async (updatedScript = scriptRef.current || script, updatedSettings = settingsRef.current || settings) => {
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
  const updateScript = (newScriptOrFn: any, shouldSave = true) => {
    setScript((prevScript: any) => {
      const updated = typeof newScriptOrFn === 'function' ? newScriptOrFn(prevScript) : newScriptOrFn;
      if (shouldSave) {
        setSaveStatus('unsaved');
        handleSave(updated, settingsRef.current);
      }
      return updated;
    });
  };

  const updateSettings = (newSettingsOrFn: any, shouldSave = true) => {
    setSettings((prevSettings: any) => {
      const updated = typeof newSettingsOrFn === 'function' ? newSettingsOrFn(prevSettings) : newSettingsOrFn;
      if (shouldSave) {
        setSaveStatus('unsaved');
        handleSave(scriptRef.current, updated);
      }
      return updated;
    });
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
  const updateSceneField = (sceneIndex: number, field: keyof Scene, value: any, shouldSave = true) => {
    updateScript((prevScript: any) => {
      if (!prevScript || !prevScript.scenes) return prevScript;
      const newScenes = [...prevScript.scenes];
      newScenes[sceneIndex] = {
        ...newScenes[sceneIndex],
        [field]: value
      };
      return { ...prevScript, scenes: newScenes };
    }, shouldSave);
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

  // 强制重新渲染（取消卡住的渲染任务）
  const forceRerender = (index: number) => {
    if (!script || !script.scenes) return;

    const scene = script.scenes[index];
    const isTimeout = scene.status === 'error' && scene.errorMessage?.includes('超时');
    const isStuck = scene.rendering || scene.status === 'generating';

    Modal.confirm({
      title: isStuck ? '⚠️ 强制取消渲染任务' : '🔄 重新渲染分镜',
      content: (
        <div>
          <p>
            {isTimeout
              ? '该分镜渲染已超时（超过 3 分钟无响应）。是否强制取消并重新渲染？'
              : isStuck
                ? '该分镜可能正在卡住。是否强制取消当前任务并重新开始渲染？'
                : '是否重新渲染该分镜？'}
          </p>
          {scene.errorMessage && (
            <div style={{
              marginTop: 12,
              padding: 8,
              background: '#fff1f0',
              borderRadius: 4,
              fontSize: 12,
              color: '#cf1322'
            }}>
              <strong>错误详情：</strong>{scene.errorMessage}
            </div>
          )}
        </div>
      ),
      okText: isTimeout ? '强制重新渲染' : (isStuck ? '确认强制重新渲染' : '重新渲染'),
      cancelText: '取消',
      okButtonProps: { danger: isTimeout || isStuck },
      onOk: () => {
        message.loading('正在重置渲染状态...', 1);
        setTimeout(() => {
          const newScenes = [...script.scenes];
          // 保持首帧和配音数据，只重置渲染相关状态
          newScenes[index] = {
            ...newScenes[index],
            rendering: false,
            status: newScenes[index].imageUrl ? 'image_completed' : 'idle',
            progress: 0,
            videoUrl: null,
            errorMessage: null
          };
          updateScript({ ...script, scenes: newScenes });
          message.success('✅ 渲染状态已重置，现在可以重新开始渲染');
        }, 500);
      }
    });
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
        newScenes.forEach((scene: any, idx: number) => {
          if (idx > 0) {
            scene.emotion = newScenes[0].emotion;
            scene.colorTone = newScenes[0].colorTone;
          }
        });
        message.success('风格一致性优化完成！');
      } else if (type === 'duration') {
        // 调整时长
        const avgDuration = Math.round(newScenes.reduce((sum, s) => sum + s.duration, 0) / newScenes.length);
        newScenes.forEach((scene: any) => {
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

    switch (suggestion.type) {
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
      const newScenes = script.scenes.map((scene: any, idx: number) => {
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
    // Read from ref to avoid stale closures at start
    const latestScript = scriptRef.current || script;
    if (!latestScript || !latestScript.scenes) return;
    const scene = latestScript.scenes[index];

    // 如果正在渲染中，不允许再次点击
    if (scene.rendering || scene.status === 'generating') {
      message.warning('该分镜正在渲染中，请稍候...');
      return;
    }

    // 先清理所有卡住的后端任务
    try {
      const cleanupRes = await fetch(`${API_BASE}/api/video/cleanup`, { method: 'POST' });
      const cleanupData = await cleanupRes.json();
      if (cleanupData.cleanedCount > 0) {
        message.info(`🧹 已自动清理 ${cleanupData.cleanedCount} 个卡住的后端任务`);
      }
    } catch (err) {
      console.warn('清理卡住任务失败，继续渲染:', err);
    }

    // Atomic state update for starting video generation
    updateScript((prevScript: any) => {
      if (!prevScript || !prevScript.scenes) return prevScript;
      const startScenes = [...prevScript.scenes];
      startScenes[index] = {
        ...startScenes[index],
        status: 'generating',
        rendering: true,
        progress: 10,
        errorMessage: null,
        videoUrl: undefined // 重置视频 URL，以便重新渲染
      };
      return { ...prevScript, scenes: startScenes };
    }, true);

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
          updateScript((prevScript: any) => {
            if (!prevScript || !prevScript.scenes) return prevScript;
            const ttsScenes = [...prevScript.scenes];
            ttsScenes[index] = {
              ...ttsScenes[index],
              audioUrl: ttsData.audioUrl,
              ttsEstDuration: ttsData.duration
            };
            return { ...prevScript, scenes: ttsScenes };
          }, true);
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
      if (!data.success || !data.taskId) {
        throw new Error(data.error || '创建视频生成任务失败');
      }

      const taskId = data.taskId;
      let pollCount = 0;
      const maxPollCount = 60; // 最多轮询 60 次（3 分钟）

      // Start polling task
      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          const taskRes = await fetch(`${API_BASE}/api/video/status/${taskId}`);
          const taskData = await taskRes.json();

          if (taskData) {
            // 如果后端返回了有效进度，使用后端的进度；否则使用估算进度
            const displayProgress = taskData.progress || Math.min(10 + (pollCount * 5), 90);
            
            // 重要：进度轮询状态更新应传入 shouldSave = false 避免频繁写入数据库造成竞争
            updateSceneField(index, 'progress', displayProgress, false);

            if (taskData.status === 'succeeded') {
              clearInterval(pollInterval);
              // Atomic state update for successful video generation (shouldSave = true)
              updateScript((prevScript: any) => {
                if (!prevScript || !prevScript.scenes) return prevScript;
                const doneScenes = [...prevScript.scenes];
                doneScenes[index] = {
                  ...doneScenes[index],
                  rendering: false,
                  status: 'completed',
                  videoUrl: taskData.videoUrl,
                  progress: 100
                };
                return { ...prevScript, scenes: doneScenes };
              }, true);
              message.success(`分镜 ${index + 1} 画面渲染成功！`);

              setWorkflowNodes(prev => prev.map(n => {
                if (n.id === 'video') {
                  const currentScript = scriptRef.current;
                  const allDone = currentScript?.scenes?.every((s: any, idx: number) => idx === index ? true : (s.status === 'completed' || !!s.videoUrl));
                  return { ...n, status: allDone ? 'completed' : 'running' };
                }
                return n;
              }));
            } else if (taskData.status === 'failed') {
              clearInterval(pollInterval);
              // Atomic state update for failed video generation (shouldSave = true)
              updateScript((prevScript: any) => {
                if (!prevScript || !prevScript.scenes) return prevScript;
                const failScenes = [...prevScript.scenes];
                failScenes[index] = {
                  ...failScenes[index],
                  rendering: false,
                  status: 'error',
                  errorMessage: taskData.error || '视频生成失败，请重试'
                };
                return { ...prevScript, scenes: failScenes };
              }, true);
              message.error(`分镜 ${index + 1} 画面生成失败`);
              setWorkflowNodes(prev => prev.map(n => n.id === 'video' ? { ...n, status: 'failed' } : n));
            } else if (pollCount >= maxPollCount) {
              // 超时处理：达到最大轮询次数后自动停止
              clearInterval(pollInterval);
              // Atomic state update for timeout (shouldSave = true)
              updateScript((prevScript: any) => {
                if (!prevScript || !prevScript.scenes) return prevScript;
                const timeoutScenes = [...prevScript.scenes];
                timeoutScenes[index] = {
                  ...timeoutScenes[index],
                  rendering: false,
                  status: 'error',
                  errorMessage: `渲染超时（超过 ${Math.round(maxPollCount * 3 / 60)} 分钟）。可能是后端任务卡住，请尝试强制重置后重新渲染。`
                };
                return { ...prevScript, scenes: timeoutScenes };
              }, true);
              message.warning(`⚠️ 分镜 ${index + 1} 渲染超时，已自动停止轮询。请查看错误详情或点击"强制重置"后重新渲染。`);
              setWorkflowNodes(prev => prev.map(n => n.id === 'video' ? { ...n, status: 'failed' } : n));
            }
          }
        } catch (e) {
          console.error('轮询分镜任务错误:', e);
        }
      }, 3000);
    } catch (e) {
      console.error('生成单个分镜失败:', e);
      // Atomic state update for failed catch block (shouldSave = true)
      updateScript((prevScript: any) => {
        if (!prevScript || !prevScript.scenes) return prevScript;
        const catchScenes = [...prevScript.scenes];
        catchScenes[index] = {
          ...catchScenes[index],
          rendering: false,
          status: 'error',
          errorMessage: e instanceof Error ? e.message : '分镜渲染出错，请重试'
        };
        return { ...prevScript, scenes: catchScenes };
      }, true);
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

    // 先清理所有卡住的任务
    try {
      const cleanupRes = await fetch(`${API_BASE}/api/video/cleanup`, { method: 'POST' });
      const cleanupData = await cleanupRes.json();
      if (cleanupData.cleanedCount > 0) {
        message.info(`🧹 已自动清理 ${cleanupData.cleanedCount} 个卡住的后端任务`);
      }
    } catch (err) {
      console.error('清理卡住任务失败:', err);
    }

    // 统计需要渲染的分镜数量
    const scenesToRender = script.scenes.filter((s: any) => !s.rendering && s.status !== 'generating');

    if (scenesToRender.length === 0) {
      message.info('所有分镜都正在渲染中或已完成！');
      return;
    }

    setIsRenderingAllScenes(true);
    try {
      // 批量启动所有非渲染中的分镜渲染任务（包括已完成和错误的）
      script.scenes.forEach((s: any, idx: number) => {
        if (!s.rendering && s.status !== 'generating') {
          generateSingleSceneVideo(idx);
        }
      });
      message.success(`已成功一键启动 ${scenesToRender.length} 个分镜的渲染任务！`);
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
            bgm: settings.bgm,
            enableTTS: settings.enableTTS
          }
        })
      });
      const data = await res.json();
      if (!data.success || !data.batchId) {
        throw new Error(data.error || '视频批量生成请求失败');
      }

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
    } catch (e) {
      console.error('一键成片发生异常:', e);
      setIsRenderingAll(false);
      setWorkflowNodes(prev => prev.map(n => n.id === 'clip' ? { ...n, status: 'failed' } : n));
    }
  };

  return {
    // States
    projectId,
    navigate,
    activeTab,
    isModalOpen,
    setIsModalOpen,
    currentEditSceneIndex,
    setCurrentEditSceneIndex,
    selectedSceneForSuggestions,
    setSelectedSceneForSuggestions,
    agentSuggestions,
    setAgentSuggestions,
    isAgentLoading,
    setIsAgentLoading,
    showAgentPanel,
    setShowAgentPanel,
    quickActionsOpen,
    setQuickActionsOpen,
    settings,
    setSettings,
    isRenderingAll,
    setIsRenderingAll,
    renderProgress,
    setRenderProgress,
    renderStatus,
    setRenderStatus,
    finalVideoUrl,
    setFinalVideoUrl,
    isRenderingAllScenes,
    setIsRenderingAllScenes,
    workflowNodes,
    setWorkflowNodes,
    workflowStarted,
    setWorkflowStarted,
    injectingMaterial,
    setInjectingMaterial,
    projectMaterials,
    setProjectMaterials,
    libraryModalVisible,
    setLibraryModalVisible,
    libraryMaterials,
    setLibraryMaterials,
    selectedLibraryMaterials,
    setSelectedLibraryMaterials,
    librarySearchKeyword,
    setLibrarySearchKeyword,
    isLoadingLibrary,
    setIsLoadingLibrary,
    saveStatus,
    setSaveStatus,
    project,
    setProject,
    script,
    setScript,
    productInfo,
    setProductInfo,
    isAnalyzing,
    setIsAnalyzing,
    chatHistory,
    setChatHistory,
    chatInput,
    setChatInput,
    isChatting,
    setIsChatting,
    isPlanningClip,
    setIsPlanningClip,
    clipPlan,
    setClipPlan,

    // Refs & Form
    chatBottomRef,
    form,

    // Action Handlers
    loadProject,
    handleGenerateClipPlan,
    handleSave,
    updateScript,
    updateSettings,
    handleSendChatMessage,
    updateSceneField,
    handleInjectMode,
    handleSceneCardClick,
    cancelInjectMode,
    openEditModal,
    closeEditModal,
    saveSceneEdit,
    uploadFrameImage,
    clearSceneImage,
    forceRerender,
    getAgentSuggestions,
    batchOptimize,
    applyAgentSuggestion,
    optimizeAllScenes,
    generateSingleSceneImage,
    handleRenderAllImages,
    generateSingleSceneVideo,
    handleRenderAllScenes,
    handleCompileFinalVideo,
  };
};
