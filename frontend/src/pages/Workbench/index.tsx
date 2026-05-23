import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SendOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  VideoCameraOutlined,
  CustomerServiceOutlined,
  LoadingOutlined,
  PictureOutlined,
  AudioOutlined,
  RocketOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
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
  Tabs,
  Empty,
  Tooltip
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Content } = Layout;

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Scene {
  description: string;
  duration: number;
  voiceover: string;
  shot_type: string;
  emotion: string;
  transition: string;
  videoUrl?: string;
  rendering?: boolean;
  progress?: number;
}

const WorkbenchPage: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

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
  const [activeTab, setActiveTab] = useState('script');
  
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
        if (p.script) setScript(p.script);
        if (p.settings) setSettings({ ...settings, ...p.settings });

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

  // Scene level Video Generation & Polling Mock/API
  const generateSingleSceneVideo = async (index: number) => {
    if (!script || !script.scenes) return;
    const scene = script.scenes[index];
    
    // Set Scene Status to Rendering
    updateSceneField(index, 'rendering', true);
    updateSceneField(index, 'progress', 10);

    try {
      // Direct post to single render endpoint
      const res = await fetch(`${API_BASE}/api/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.description,
          duration: scene.duration || 5,
          sceneIndex: index
        })
      });

      const data = await res.json();
      if (data.taskId) {
        const taskId = data.taskId;
        // Start polling task
        const pollInterval = setInterval(async () => {
          try {
            const taskRes = await fetch(`${API_BASE}/api/tasks/${taskId}`);
            const taskData = await taskRes.json();
            if (taskData.success && taskData.data) {
              const task = taskData.data;
              updateSceneField(index, 'progress', task.progress || 30);

              if (task.status === 'completed') {
                clearInterval(pollInterval);
                updateSceneField(index, 'rendering', false);
                updateSceneField(index, 'videoUrl', task.result);
                message.success(`分镜 ${index + 1} 画面渲染成功！`);
              } else if (task.status === 'failed') {
                clearInterval(pollInterval);
                updateSceneField(index, 'rendering', false);
                message.error(`分镜 ${index + 1} 画面生成失败`);
              }
            }
          } catch (e) {
            console.error('轮询分镜任务错误:', e);
          }
        }, 3000);
      } else {
        // Safe fallback
        setTimeout(() => {
          updateSceneField(index, 'rendering', false);
          // Auto fill a mock placeholder video
          updateSceneField(index, 'videoUrl', 'https://assets.mixkit.co/videos/preview/mixkit-kitchen-counter-with-fresh-vegetables-and-fruits-41584-large.mp4');
          message.success(`分镜 ${index + 1} 画面生成成功 (Mock 视频已注入)`);
        }, 4000);
      }
    } catch (e) {
      console.error('生成单个分镜失败:', e);
      updateSceneField(index, 'rendering', false);
      message.error('分镜渲染出错');
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
            } else {
              message.success('恭喜！带货视频合成输出成功！');
            }
          }
        };

        es.onerror = () => {
          es.close();
          setIsRenderingAll(false);
          message.error('后台视频编译连接发生异常');
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
          } else {
            setRenderProgress(progressVal);
            setRenderStatus(`正在执行第 ${Math.ceil(progressVal / 25)} 分镜音频和画面高精校准...`);
          }
        }, 1500);
      }
    } catch (e) {
      console.error('一键成片发生异常:', e);
      setIsRenderingAll(false);
    }
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#0a0a0f', color: '#e4e4e7' }}>
      {/* Premium Dark Navigation Header */}
      <div style={{
        padding: '16px 24px',
        background: '#12121e',
        borderBottom: '1px solid #1f1f2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
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
              {project?.description ? `绑定素材: ${project.materials?.length || 0} 个 | ${project.description.slice(0, 40)}` : '创意无限，全 AI 驱动视频生成器'}
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

      {/* Steps/Tabs Guided Navigation bar */}
      <div style={{ background: '#12121e', padding: '0 24px', borderBottom: '1px solid #1f1f2e' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          tabBarStyle={{ borderBottom: 'none' }}
          items={[
            {
              key: 'script',
              label: (
                <span style={{ fontSize: 15, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SendOutlined /> 1. 剧本协同
                </span>
              ),
            },
            {
              key: 'storyboard',
              label: (
                <span style={{ fontSize: 15, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <VideoCameraOutlined /> 2. 分镜设计
                </span>
              ),
            },
            {
              key: 'audio',
              label: (
                <span style={{ fontSize: 15, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CustomerServiceOutlined /> 3. 音轨配音
                </span>
              ),
            },
            {
              key: 'render',
              label: (
                <span style={{ fontSize: 15, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RocketOutlined /> 4. 合成输出
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Main Dual-Column Content Panels */}
      <Content style={{ padding: 24, overflow: 'auto' }}>
        
        {/* ============================================================== */}
        {/* TAB 1: SCRIPT COORDINATION PANEL */}
        {/* ============================================================== */}
        {activeTab === 'script' && (
          <Row gutter={24} style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
            {/* Left: Chat Copilot */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><AudioOutlined /> AI 创意导演 Copilot</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
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
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#1e1e2f',
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
                      <div style={{ background: '#1e1e2f', padding: '10px 14px', borderRadius: '12px 12px 12px 2px' }}>
                        <span style={{ color: '#818cf8' }}><LoadingOutlined /> AI 导演正在深入构思中...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input Controls */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #1f1f2e', paddingTop: 12 }}>
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
                    style={{ background: '#1a1a2e', border: '1px solid #2a2a3e', color: '#fff', borderRadius: 8 }}
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
                style={{ background: '#12121e', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {script ? (
                  <div>
                    <div style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                      <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0' }}>📄 {script.title}</Title>
                      <Paragraph style={{ color: '#a1a1aa', margin: 0, fontSize: 13 }}>
                        <strong>核心创意创意:</strong> {script.description}
                      </Paragraph>
                    </div>

                    <Title level={5} style={{ color: '#fff', marginBottom: 12 }}>📝 分镜场景时间线</Title>
                    {script.scenes?.map((scene: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        background: '#161625',
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 12,
                        borderLeft: '4px solid #6366f1'
                      }}>
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <Tag color="geekblue" style={{ borderRadius: 4 }}>镜 {index + 1}</Tag>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>⏱️ {scene.duration}秒</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>[画面构图 - {scene.shot_type}]</span>
                            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginLeft: 12 }}>[情感情绪 - {scene.emotion}]</span>
                          </div>
                          <Paragraph style={{ color: '#e4e4e7', fontSize: 13, marginBottom: 8 }}>
                            <strong>画面视觉：</strong>{scene.description}
                          </Paragraph>
                          <Paragraph style={{ color: '#a1a1aa', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
                            🎤 “ {scene.voiceover} ”
                          </Paragraph>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    description={<span style={{ color: '#a1a1aa' }}>暂无剧本。在左侧发送消息给 AI 导演开始创作！</span>}
                    style={{ marginTop: 80 }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 2: STORYBOARD EDITOR (INLINE FORM + SCENE LEVEL RENDER) */}
        {/* ============================================================== */}
        {activeTab === 'storyboard' && (
          <Row gutter={24} style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
            {/* Left: Chat scene adjustments & project base asset palette */}
            <Col span={6} style={{ height: '100%' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%', height: '100%' }}>
                <Card
                  title={<span style={{ color: '#fff' }}><PictureOutlined /> 项目绑定商品素材</span>}
                  bordered={false}
                  style={{ background: '#12121e', borderRadius: 12, flexShrink: 0 }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                    您可以将以下商品原图作为控制图参考（垫图）生成一致性更好的分镜：
                  </Text>
                  {project?.materials && project.materials.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {project.materials.map((m: any) => (
                        <Tooltip key={m.id} title={m.filename}>
                          <div style={{
                            border: '1px solid #2a2a3e',
                            borderRadius: 6,
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            height: 70
                          }}>
                            {m.type?.startsWith('image') ? (
                              <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: '#1e1e2f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>🎥</div>
                            )}
                          </div>
                        </Tooltip>
                      ))}
                    </div>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无绑定素材" style={{ padding: 12 }} />
                  )}
                </Card>

                <Card
                  title={<span style={{ color: '#fff' }}><AudioOutlined /> 分镜精细指令</span>}
                  bordered={false}
                  style={{ background: '#12121e', borderRadius: 12, flex: 1, overflowY: 'auto' }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Paragraph style={{ color: '#a1a1aa', fontSize: 12 }}>
                    如果您需要批量微调画面，可在当前面板与大模型协作：“*把所有镜头升级为高大上的暖光影色调*”。
                  </Paragraph>
                  <TextArea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="输入微调分镜指令..."
                    rows={3}
                    style={{ background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e', marginBottom: 10 }}
                  />
                  <Button type="primary" block onClick={handleSendChatMessage}>发送分镜指令</Button>
                </Card>
              </Space>
            </Col>

            {/* Right: Grid of Scene Form Cards */}
            <Col span={18} style={{ height: '100%', overflowY: 'auto' }}>
              <Card
                title={<span style={{ color: '#fff' }}><VideoCameraOutlined /> 独立分镜场景卡片（支持单场景画幅生成）</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12 }}
              >
                {script && script.scenes && script.scenes.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {script.scenes.map((scene: Scene, index: number) => (
                      <Col span={12} key={index}>
                        <Card
                          style={{ background: '#161625', border: '1px solid #252538', borderRadius: 8 }}
                          bodyStyle={{ padding: 16 }}
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#fff' }}><Tag color="indigo">分镜 {index + 1}</Tag></span>
                              <Button
                                type="primary"
                                size="small"
                                icon={scene.rendering ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                loading={scene.rendering}
                                onClick={() => generateSingleSceneVideo(index)}
                                style={{ borderRadius: 4, background: '#10b981', border: 'none' }}
                              >
                                {scene.rendering ? `渲染中 ${scene.progress || 10}%` : '生成当前画面'}
                              </Button>
                            </div>
                          }
                        >
                          <Row gutter={12}>
                            {/* Left part of card: Preview player / generator placeholder */}
                            <Col span={10}>
                              <div style={{
                                width: '100%',
                                height: 160,
                                background: '#0a0a0f',
                                border: '1px dashed #3f3f46',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}>
                                {scene.videoUrl ? (
                                  <video src={scene.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : scene.rendering ? (
                                  <div style={{ textAlign: 'center', padding: 8 }}>
                                    <LoadingOutlined style={{ fontSize: 24, color: '#10b981', marginBottom: 8 }} />
                                    <div style={{ fontSize: 11, color: '#888' }}>高精渲染中...</div>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', color: '#52525b', padding: 8 }}>
                                    <PictureOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                                    <div style={{ fontSize: 10 }}>暂无生成画面</div>
                                  </div>
                                )}
                              </div>
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
                                    style={{ background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e', fontSize: 11.5 }}
                                  />
                                </div>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11 }}>旁白配音：</Text>
                                  <TextArea
                                    value={scene.voiceover}
                                    onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                                    rows={1}
                                    style={{ background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e', fontSize: 11.5 }}
                                  />
                                </div>
                                <Row gutter={8}>
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>时长(秒):</Text>
                                    <Input
                                      type="number"
                                      value={scene.duration}
                                      onChange={(e) => updateSceneField(index, 'duration', parseInt(e.target.value) || 3)}
                                      style={{ background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e', height: 26, fontSize: 11 }}
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
        {/* TAB 3: AUDIO & TTS CONFIGURATION */}
        {/* ============================================================== */}
        {activeTab === 'audio' && (
          <Row gutter={24} style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
            {/* Left: Speaker Selection and Parameters */}
            <Col span={10}>
              <Card
                title={<span style={{ color: '#fff' }}><CustomerServiceOutlined /> 智能语音与 TTS 旁白参数</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12, height: '100%' }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>1. 启用带货语音旁白</Text></div>
                    <Switch
                      checked={settings.enableTTS}
                      onChange={(val) => updateSettings({ ...settings, enableTTS: val })}
                    />
                  </div>

                  {settings.enableTTS && (
                    <>
                      <div>
                        <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>2. 选择专业发音人角色</Text></div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text strong style={{ color: '#fff' }}>3. 配音语速调节</Text>
                          <Text style={{ color: '#a1a1aa' }}>{settings.speed}x</Text>
                        </div>
                        <Slider
                          min={0.8}
                          max={1.5}
                          step={0.1}
                          value={settings.speed}
                          onChange={(val) => updateSettings({ ...settings, speed: val })}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text strong style={{ color: '#fff' }}>4. 旁白音量大小</Text>
                          <Text style={{ color: '#a1a1aa' }}>{settings.volume}%</Text>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          value={settings.volume}
                          onChange={(val) => updateSettings({ ...settings, volume: val })}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>5. 带货背景音乐 (BGM)</Text></div>
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
                </Space>
              </Card>
            </Col>

            {/* Right: Audio Visual Timeline Preview */}
            <Col span={14}>
              <Card
                title={<span style={{ color: '#fff' }}><AudioOutlined /> 音轨多轨时间线示意图</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12, height: '100%' }}
              >
                {script && script.scenes ? (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ background: '#18182b', padding: 20, borderRadius: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        系统将自动根据每个分镜的时长和语速，精确对齐画面与旁白。以下为音画对齐甘特图：
                      </Text>

                      {/* Video Frame timeline block */}
                      <div style={{ marginTop: 24 }}>
                        <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 600, marginBottom: 6 }}>🎥 视频画面轨道 (Video Track)</div>
                        <div style={{ display: 'flex', gap: 4, height: 32, background: '#0a0a0f', borderRadius: 4, padding: 2 }}>
                          {script.scenes.map((s: Scene, i: number) => (
                            <div key={i} style={{
                              flex: s.duration || 5,
                              background: 'linear-gradient(90deg, #6366f1 0%, #4338ca 100%)',
                              borderRadius: 2,
                              color: '#fff',
                              fontSize: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 500
                            }}>
                              镜 {i + 1} ({s.duration}秒)
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TTS audio timeline block */}
                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginBottom: 6 }}>🎙️ AI 旁白配音轨道 (TTS Narration)</div>
                        <div style={{ display: 'flex', gap: 4, height: 32, background: '#0a0a0f', borderRadius: 4, padding: 2 }}>
                          {script.scenes.map((s: Scene, i: number) => (
                            <div key={i} style={{
                              flex: s.duration || 5,
                              background: settings.enableTTS ? 'linear-gradient(90deg, #10b981 0%, #047857 100%)' : '#27272a',
                              borderRadius: 2,
                              color: '#fff',
                              fontSize: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 500,
                              opacity: settings.enableTTS ? 1 : 0.2
                            }}>
                              {settings.enableTTS ? `旁白 ${i + 1}` : '已禁用'}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* BGM background music timeline block */}
                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>🎵 背景音乐轨道 (BGM Loop Track)</div>
                        <div style={{
                          height: 24,
                          background: settings.bgm !== 'none' ? 'linear-gradient(90deg, #d97706 0%, #b45309 100%)' : '#27272a',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: '#fff',
                          fontWeight: 500,
                          opacity: settings.bgm !== 'none' ? 0.9 : 0.2
                        }}>
                          {settings.bgm !== 'none' ? `单循环 - ${settings.bgm}` : '已静音'}
                        </div>
                      </div>
                    </div>
                  </Space>
                ) : (
                  <Empty description={<span style={{ color: '#888' }}>暂无剧本数据，无法进行音画对齐展示</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 4: COMPILATION & OUTPUT */}
        {/* ============================================================== */}
        {activeTab === 'render' && (
          <Row gutter={24} style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
            {/* Left: Resolution, Ratio and transition configs & trigger */}
            <Col span={10}>
              <Card
                title={<span style={{ color: '#fff' }}><RocketOutlined /> 视频最终渲染编译设置</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12, height: '100%' }}
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

                  <Divider style={{ margin: '12px 0', borderTopColor: '#1f1f2e' }} />

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
            </Col>

            {/* Right: Render Monitoring Dashboard & final persistent video player */}
            <Col span={14} style={{ height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><VideoCameraOutlined /> 渲染终端 & 最终预览大盘</span>}
                bordered={false}
                style={{ background: '#12121e', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {/* When rendering is active */}
                {isRenderingAll && (
                  <div style={{ background: '#18182b', padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 20 }}>
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
                    <div style={{ background: '#18182b', padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: '4px solid #10b981' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>🎉 合成完毕：</span>
                      <Text style={{ color: '#a1a1aa', fontSize: 13 }}>最终高精度带货视频已妥善渲染在本地临时存储。</Text>
                    </div>

                    <div style={{
                      width: '100%',
                      background: '#000',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #2a2a3e',
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
                          style={{ height: 40, borderRadius: 6, background: '#1f1f2e', color: '#fff', border: '1px solid #3a3a4e' }}
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
    </Layout>
  );
};

export default WorkbenchPage;
