import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Upload,
  message,
  Typography,
  Divider,
  Row,
  Col,
  Tag,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  UploadOutlined,
  LinkOutlined,
  LoadingOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  EditOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { OneClickService, OneClickStatus } from '../../services/oneClick';
import { VideoLibraryService, VideoLibraryItem } from '../../services/videoLibrary';
import { TemplateService, InspirationTemplate } from '../../services/template';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface ConsoleLogLine {
  timestamp: string;
  sender: 'SYSTEM' | 'AI_AGENT' | 'VIDEO_AGENT' | 'TTS_AGENT' | 'FFMPEG' | 'ERROR';
  content: string;
  id: string;
}

const OneClickPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  // Steps: 0 = Form, 1 = Generating, 2 = Completed, 3 = Failed
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<OneClickStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [templates, setTemplates] = useState<InspirationTemplate[]>([]);

  // Logs terminal state
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogLine[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const logCounterRef = useRef(0);

  // Auto-retry state for failure recovery
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const retryTimerRef = useRef<any>(null);
  const originalValuesRef = useRef<any>(null);

  const initialState = location.state as any;
  const mode = initialState?.templateId ? 'template' : initialState?.referenceVideoId ? 'copywriting' : 'auto';

  useEffect(() => {
    if (mode === 'copywriting') {
      form.setFieldsValue({ referenceVideoId: initialState?.referenceVideoId });
    } else if (mode === 'template') {
      form.setFieldsValue({ templateId: initialState?.templateId });
    }
    loadData();
    return () => {
      if (unsubscribe) unsubscribe();
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  const loadData = async () => {
    const videoResult = await VideoLibraryService.getAll({ limit: 10 });
    if (videoResult.success) setVideos(videoResult.data);

    const templateResult = await TemplateService.getAll({ limit: 10 });
    if (templateResult.success) setTemplates(templateResult.data);
  };

  // Helper to add a formatted line to our mock live terminal
  const addLog = (sender: ConsoleLogLine['sender'], content: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const logId = `log_${Date.now()}_${logCounterRef.current++}`;
    setConsoleLogs((prev) => [...prev, { timestamp: timeStr, sender, content, id: logId }]);
  };

  const handleStart = async (values: any) => {
    setLoading(true);
    setErrorState(null);
    originalValuesRef.current = values;
    setConsoleLogs([]);
    addLog('SYSTEM', '一键成片渲染引擎启动中...');
    addLog('SYSTEM', '正在建立与远程 AI 生产流水线的双向通道...');

    try {
      const result = await OneClickService.generate(values);
      if (!result.success) {
        throw new Error(result.error || '任务启动失败');
      }

      setStep(1);
      addLog('SYSTEM', `成功建立连接！任务ID: ${result.taskId}`);
      addLog('AI_AGENT', 'AI 脑暴决策中心已就绪，开始分析输入数据。');

      if (result.taskId) {
        const unsubscribeFn = await OneClickService.subscribe(
          result.taskId,
          (updatedStatus) => {
            setStatus(updatedStatus);
            handleStatusUpdate(updatedStatus);
          },
          (err) => {
            console.warn('Subscription encounter error:', err);
            addLog('SYSTEM', '检测到连接抖动，已自动切入高可用 HTTP 备用轮询信道，进度同步不受影响。');
          }
        );
        setUnsubscribe(() => unsubscribeFn);
      }
    } catch (err: any) {
      console.error(err);
      addLog('ERROR', `启动失败: ${err.message}`);
      message.error(err.message || '启动失败');
    } finally {
      setLoading(false);
    }
  };

  // React to status streams and print logs corresponding to backend pipeline steps
  const lastPhaseRef = useRef<string>('');
  const lastProgressRef = useRef<number>(-1);

  const handleStatusUpdate = (updatedStatus: OneClickStatus) => {
    const { phase, progress, message: statusMsg } = updatedStatus;

    // Detect progress change and output console log
    if (progress !== lastProgressRef.current) {
      lastProgressRef.current = progress;
    }

    // Map stages to corresponding log streams
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      
      switch (phase) {
        case 'initializing':
          addLog('SYSTEM', '初始化生成管线，配置渲染环境中...');
          break;
        case 'extracting':
          addLog('AI_AGENT', '正在读取商品配置，深度解析受众画像与亮点...');
          break;
        case 'searching_materials':
          addLog('SYSTEM', '连接 SQLite 向量库，正在检索最匹配的商品关联素材...');
          break;
        case 'generating_script':
          addLog('AI_AGENT', '分析完成！AI 剧本专家正在创作吸睛分镜，编排黄金三秒 Hook ...');
          break;
        case 'generating_videos':
          addLog('VIDEO_AGENT', '剧本已就绪！开始通过 Doubao-Seedance 渲染高清分镜视频...');
          addLog('SYSTEM', '视频接口并发启动。使用 Image-to-Video 融合素材作为首帧控制。');
          break;
        case 'generating_tts':
          addLog('TTS_AGENT', '分镜渲染完成，开始提取台词。调用高质感 TTS 录制带货音频轨...');
          break;
        case 'composing':
          addLog('FFMPEG', '音频配音已就绪。正在调度 FFMPEG 进行分镜视频拼接、转场溶解与音轨混音...');
          break;
        case 'completed':
          addLog('SYSTEM', 'FFMPEG 合成执行完毕，新视频打包输出成功！');
          addLog('SYSTEM', '一键成片任务圆满结束。视频已就绪，等待预览。');
          break;
        case 'failed':
          addLog('ERROR', `生成中断，原因: ${updatedStatus.error || '火山大模型请求过载'}`);
          break;
      }
    }

    // Log the message directly if it changes
    if (statusMsg) {
      addLog(
        phase === 'generating_videos' ? 'VIDEO_AGENT' : 
        phase === 'generating_tts' ? 'TTS_AGENT' : 
        phase === 'composing' ? 'FFMPEG' : 'SYSTEM', 
        statusMsg
      );
    }
  };

  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    if (status?.status === 'completed') {
      setStep(2);
      if (unsubscribe) unsubscribe();
    } else if (status?.status === 'failed') {
      setStep(3);
      setErrorState(status.error || '火山引擎接口请求超时或限流');
      if (unsubscribe) unsubscribe();
      // Start self-healing countdown
      startAutoRetryCountdown();
    }
  }, [status]);

  // Self-healing retry timer
  const startAutoRetryCountdown = () => {
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    setRetryCountdown(10);
    
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(retryTimerRef.current);
          handleRetry();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelRetry = () => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setRetryCountdown(null);
    addLog('SYSTEM', '用户手动取消了自动诊断重试流程。');
  };

  const handleRetry = () => {
    cancelRetry();
    if (originalValuesRef.current) {
      setStep(0);
      setStatus(null);
      setTimeout(() => {
        handleStart(originalValuesRef.current);
      }, 500);
    }
  };

  // Get responsive color for orbital circular spinner
  const getOrbitalColor = () => {
    if (step === 3) return '#f43f5e'; // Deep rose for failure
    if (step === 2) return '#10b981'; // Emerald for success
    if (!status) return '#8b5cf6'; // Indigo

    switch (status.phase) {
      case 'extracting':
      case 'searching_materials':
        return '#6366f1'; // Violet Indigo
      case 'generating_script':
        return '#8b5cf6'; // Purple
      case 'generating_videos':
        return '#ec4899'; // Vibrant Pink
      case 'generating_tts':
        return '#f59e0b'; // Dubbing Amber
      case 'composing':
        return '#06b6d4'; // Cyan Composing
      default:
        return '#8b5cf6';
    }
  };

  const getPhaseLabel = () => {
    if (step === 3) return '生产被迫中断';
    if (step === 2) return '渲染打包圆满完成';
    if (!status) return '准备分析';

    switch (status.phase) {
      case 'initializing': return '引擎正在初始化...';
      case 'extracting': return '正在提取商品核心特征';
      case 'searching_materials': return '正在召回匹配关联素材';
      case 'generating_script': return 'AI Agent 剧本脑暴中';
      case 'generating_videos': return '火山引擎多通道视频并行渲染中';
      case 'generating_tts': return '高保真配音主播录制中';
      case 'composing': return 'FFMPEG 多轨合流压制中';
      default: return status.message || '全力生成中...';
    }
  };

  const productInfoHelp = `以 JSON 结构指定更佳，亦可输入通俗句段：
例如：{"title": "磁吸充电宝", "sellingPoints": "超薄小巧、强劲吸附、大容量", "targetAudience": "出差白领、户外驴友"}`;

  return (
    <div style={{ 
      background: '#09090b', 
      minHeight: 'calc(100vh - 64px)', 
      color: '#e4e4e7',
      padding: '40px 24px',
      fontFamily: 'Outfit, Inter, system-ui, -apple-system, sans-serif'
    }}>
      
      {/* Premium Dark Navigation Title Block */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 54,
          height: 54,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
          marginBottom: 16,
          boxShadow: '0 8px 24px rgba(124,58,237,0.3)'
        }}>
          <ThunderboltOutlined style={{ color: '#fff', fontSize: 28 }} />
        </div>
        <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
          一键成片控制台
        </Title>
        <Text style={{ color: '#71717a', fontSize: 13, marginTop: 6, display: 'block' }}>
          零门槛端到端自动构建 · AI 导演自动起底卖点 · 多分镜并行极速渲染
        </Text>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        
        {/* ============================================================== */}
        {/* STEP 0: FORM FILLING (E-commerce Link / Info Upload) */}
        {/* ============================================================== */}
        {step === 0 && (
          <Card 
            bordered={false}
            style={{ 
              background: '#121214', 
              border: '1px solid #1f1f23', 
              borderRadius: 16,
              boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
              padding: '12px 12px'
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleStart}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="productLink"
                    label={<span style={{ color: '#a1a1aa', fontWeight: 600 }}>🔗 商品链接</span>}
                  >
                    <Input 
                      prefix={<LinkOutlined style={{ color: '#6b7280' }} />} 
                      placeholder="粘贴 TikTok Shop 或公开电商商品链接" 
                      style={{ background: '#1c1c1f', border: '1px solid #2e2e33', color: '#fff', borderRadius: 8, height: 42 }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="productImage"
                    label={<span style={{ color: '#a1a1aa', fontWeight: 600 }}>🖼️ 上传主图以做 Image-to-Video 渲染</span>}
                  >
                    <Upload maxCount={1} listType="picture" beforeUpload={() => false}>
                      <Button 
                        icon={<UploadOutlined />}
                        style={{ background: '#1c1c1f', border: '1px dashed #3f3f46', color: '#e4e4e7', borderRadius: 8, height: 42, width: '100%' }}
                      >
                        上传商品高清图 (自动作为首帧注入)
                      </Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="productInfo"
                label={<span style={{ color: '#a1a1aa', fontWeight: 600 }}>📝 商品属性策划 (必填)</span>}
                rules={[{ required: true, message: '请填写商品信息以方便 AI 生成剧本' }]}
                extra={<span style={{ fontSize: 11, color: '#52525b', marginTop: 4, display: 'block' }}>{productInfoHelp}</span>}
              >
                <TextArea
                  rows={4}
                  placeholder='例如：{"title": "真无线降噪耳机", "sellingPoints": "主动降噪、HiFi音质、40小时长续航", "targetAudience": "年轻通勤族"}'
                  style={{ background: '#1c1c1f', border: '1px solid #2e2e33', color: '#fff', borderRadius: 8 }}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="templateId"
                    label={<span style={{ color: '#a1a1aa', fontWeight: 600 }}>⚡ 绑定灵感模板 (方法论因子组合)</span>}
                  >
                    <Select 
                      placeholder="选择要匹配的创作策略，留空则由 AI 自动聚类匹配"
                      style={{ width: '100%' }}
                      dropdownStyle={{ background: '#18181b', border: '1px solid #2e2e33' }}
                      allowClear
                    >
                      {templates.map((t) => (
                        <Option key={t.id} value={t.id}>{t.name} ({t.category})</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="referenceVideoId"
                    label={<span style={{ color: '#a1a1aa', fontWeight: 600 }}>🔥 绑定爆款参考视频 (仿写模式)</span>}
                  >
                    <Select 
                      placeholder="挑选要模仿结构风格的爆款视频"
                      style={{ width: '100%' }}
                      dropdownStyle={{ background: '#18181b', border: '1px solid #2e2e33' }}
                      allowClear
                    >
                      {videos.map((v) => (
                        <Option key={v.id} value={v.id}>{v.title} ({v.platform})</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ borderColor: '#1f1f23', margin: '20px 0' }} />

              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={6}>
                  <Form.Item name={['options', 'sceneCount']} label={<span style={{ color: '#71717a', fontSize: 12 }}>分镜数量</span>} initialValue={0}>
                    <Select dropdownStyle={{ background: '#18181b' }}>
                      <Option value={0}>🤖 AI 智能决定</Option>
                      <Option value={3}>3 个分镜 (约12秒)</Option>
                      <Option value={4}>4 个分镜 (约16秒)</Option>
                      <Option value={5}>5 个分镜 (约20秒)</Option>
                      <Option value={6}>6 个分镜 (约24秒)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name={['options', 'resolution']} label={<span style={{ color: '#71717a', fontSize: 12 }}>清晰度</span>} initialValue="720p">
                    <Select dropdownStyle={{ background: '#18181b' }}>
                      <Option value="480p">480p 流畅</Option>
                      <Option value="720p">720p 高清</Option>
                      <Option value="1080p">1080p 超清</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name={['options', 'ratio']} label={<span style={{ color: '#71717a', fontSize: 12 }}>画幅</span>} initialValue="9:16">
                    <Select dropdownStyle={{ background: '#18181b' }}>
                      <Option value="9:16">🎬 9:16 抖音竖屏</Option>
                      <Option value="16:9">💻 16:9 横画幅</Option>
                      <Option value="1:1">📱 1:1 极简方屏</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name={['options', 'transition']} label={<span style={{ color: '#71717a', fontSize: 12 }}>拼接转场</span>} initialValue="fade">
                    <Select dropdownStyle={{ background: '#18181b' }}>
                      <Option value="fade">🎨 优雅淡入淡出</Option>
                      <Option value="dissolve">✨ 像素化溶解</Option>
                      <Option value="cut">⚡ 动感硬切</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ margin: 0 }}>
                <Button 
                  type="primary" 
                  size="large" 
                  htmlType="submit" 
                  loading={loading} 
                  block
                  style={{
                    height: 52,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 15,
                    boxShadow: '0 8px 30px rgba(124,58,237,0.4)',
                    letterSpacing: '1px'
                  }}
                >
                  🚀 唤醒 AI 导演，开始一键成片
                </Button>
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* ============================================================== */}
        {/* STEP 1 & 3: PRODUCTION RUNTIME & FAILURE RECOVERY */}
        {/* ============================================================== */}
        {(step === 1 || step === 3) && (
          <Row gutter={24} style={{ display: 'flex' }}>
            
            {/* Left Column: Orbital Neon Ring + Diagnostic Panel */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card
                bordered={false}
                style={{ 
                  background: '#121214', 
                  border: '1px solid #1f1f23', 
                  borderRadius: 16,
                  textAlign: 'center',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '30px 10px'
                }}
              >
                <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 24px' }}>
                  
                  {/* Glowing neon shadow circle */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    boxShadow: `0 0 40px ${getOrbitalColor()}33`,
                    pointerEvents: 'none',
                    transition: 'all 0.5s ease'
                  }} />

                  {/* SVG circular loading circle */}
                  <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', transition: 'all 0.5s' }}>
                    <circle 
                      cx="110" cy="110" r="92" 
                      stroke="#1c1c1f" strokeWidth="6" 
                      fill="transparent" 
                    />
                    <circle 
                      cx="110" cy="110" r="92" 
                      stroke={getOrbitalColor()} strokeWidth="8" 
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 92}
                      strokeDashoffset={2 * Math.PI * 92 * (1 - (status?.progress || 0) / 100)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s' }}
                    />
                  </svg>

                  {/* Inner text stats */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    {step === 3 ? (
                      <WarningOutlined style={{ fontSize: 44, color: '#f43f5e', marginBottom: 4 }} />
                    ) : (
                      <>
                        <span style={{ 
                          fontSize: 48, 
                          fontWeight: 800, 
                          color: '#fff', 
                          lineHeight: '1',
                          textShadow: `0 0 10px ${getOrbitalColor()}22`
                        }}>
                          {status?.progress || 0}%
                        </span>
                        <span style={{ fontSize: 11, color: '#71717a', marginTop: 4, letterSpacing: '0.5px' }}>
                          PIPE COMPILE
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0', fontWeight: 600 }}>
                  {getPhaseLabel()}
                </Title>
                <Paragraph style={{ color: '#a1a1aa', fontSize: 13, minHeight: 40, padding: '0 16px', margin: 0 }}>
                  {status?.message || '等待管道触发分配...'}
                </Paragraph>

                {/* Micro step tracker pins */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 8, 
                  marginTop: 24,
                  borderTop: '1px solid #1f1f23',
                  paddingTop: 20
                }}>
                  {[
                    { id: 'extracting', label: '属性分析' },
                    { id: 'generating_script', label: '剧本脑暴' },
                    { id: 'generating_videos', label: '视频渲染' },
                    { id: 'generating_tts', label: '高品配音' },
                    { id: 'composing', label: '封装合成' }
                  ].map((s) => {
                    const isDone = status && ['completed', 'failed'].includes(status.status) || 
                      (status && ['extracting', 'searching_materials', 'generating_script', 'generating_videos', 'generating_tts', 'composing'].indexOf(status.phase) > ['extracting', 'searching_materials', 'generating_script', 'generating_videos', 'generating_tts', 'composing'].indexOf(s.id));
                    const isActive = status?.phase === s.id || (s.id === 'extracting' && status?.phase === 'searching_materials');
                    
                    return (
                      <Tooltip title={s.label} key={s.id}>
                        <div style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: isDone ? '#10b981' : isActive ? getOrbitalColor() : '#27272a',
                          boxShadow: isActive ? `0 0 8px ${getOrbitalColor()}` : 'none',
                          transition: 'all 0.3s'
                        }} />
                      </Tooltip>
                    );
                  })}
                </div>
              </Card>

              {/* ============================================================== */}
              {/* SELF-HEALING DIAGNOSTICS CONTROL PANEL */}
              {/* ============================================================== */}
              {step === 3 && (
                <Card
                  bordered={false}
                  style={{
                    background: '#1c1917',
                    border: '1px solid #78716c33',
                    borderRadius: 16,
                    marginTop: 16,
                    padding: '8px 8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <WarningOutlined style={{ color: '#f43f5e', fontSize: 20, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#fca5a5', fontWeight: 600, fontSize: 13.5, display: 'block', marginBottom: 4 }}>
                        智能自愈诊断引擎已唤醒
                      </span>
                      <Paragraph style={{ color: '#d6d3d1', fontSize: 12, lineHeight: '1.6', margin: '0 0 12px 0' }}>
                        错误排查：{errorState || '无法建立与火山API的握手'}<br />
                        <span style={{ color: '#a8a29e' }}>
                          诊断建议：系统检测到网络握手异常，可能因火山端并发受限所致。为防止您的生成进度丢失，引擎即将发起原参一键重试。
                        </span>
                      </Paragraph>
                      
                      {retryCountdown !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: '#fca5a5' }}>
                            🔄 正在自愈... 将在 <strong style={{ fontSize: 14 }}>{retryCountdown}</strong> 秒内强制重试
                          </span>
                          <Button size="small" type="text" onClick={cancelRetry} style={{ color: '#a8a29e', fontSize: 11, padding: '0 8px' }}>
                            取消
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<ReloadOutlined />} 
                          onClick={handleRetry}
                          style={{ background: '#f43f5e', border: 'none', borderRadius: 6, fontSize: 12 }}
                        >
                          立即强制重试 (原参自愈)
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </Col>

            {/* Right Column: Live Terminal Console */}
            <Col span={14} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                      <CodeOutlined style={{ color: getOrbitalColor(), marginRight: 8, transition: 'color 0.5s' }} /> 
                      一键成片生产流监控终端 (LIVE STREAM TERMINAL)
                    </span>
                  </div>
                }
                bordered={false}
                style={{ 
                  background: '#121214', 
                  border: '1px solid #1f1f23', 
                  borderRadius: 16,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.4)'
                }}
                bodyStyle={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  overflow: 'hidden',
                  padding: 0
                }}
              >
                {/* Console text window */}
                <div style={{
                  flex: 1,
                  background: '#09090b',
                  borderRadius: '0 0 12px 12px',
                  padding: '16px 20px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 12.5,
                  overflowY: 'auto',
                  lineHeight: '1.7',
                  minHeight: 380,
                  maxHeight: 520,
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8)'
                }}>
                  {consoleLogs.map((log) => {
                    const isError = log.sender === 'ERROR';
                    const isSystem = log.sender === 'SYSTEM';
                    const isAI = log.sender === 'AI_AGENT';
                    const senderColor = 
                      isError ? '#f43f5e' : 
                      isSystem ? '#38bdf8' : 
                      isAI ? '#c084fc' : '#fbbf24';

                    return (
                      <div key={log.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#52525b', flexShrink: 0 }}>[{log.timestamp}]</span>
                        <span style={{ color: senderColor, fontWeight: 700, flexShrink: 0 }}>
                          [{log.sender}]
                        </span>
                        <span style={{ 
                          color: isError ? '#fca5a5' : '#f4f4f5', 
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {log.content}
                        </span>
                      </div>
                    );
                  })}
                  {step === 1 && (
                    <div style={{ color: getOrbitalColor(), display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <LoadingOutlined size={12} />
                      <span>等待管道指令追加流...</span>
                    </div>
                  )}
                  <div ref={consoleBottomRef} />
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* STEP 2: FINISHED - TELEMETRY PREVIEW & EXPORT (TikTok Smartphone Room) */}
        {/* ============================================================== */}
        {step === 2 && status && (
          <Row gutter={24} style={{ display: 'flex', alignItems: 'stretch' }}>
            
            {/* Left: Mobile Phone Simulation Room */}
            <Col span={10}>
              <Card
                bordered={false}
                style={{ 
                  background: '#121214', 
                  border: '1px solid #1f1f23', 
                  borderRadius: 16,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 10px',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
                  position: 'relative'
                }}
              >
                {/* 3D simulated smartphone frame wrapper */}
                <div style={{
                  position: 'relative',
                  width: 250,
                  height: 480,
                  background: '#09090b',
                  borderRadius: 36,
                  padding: 8,
                  border: '4px solid #3f3f46',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.1)',
                  overflow: 'hidden'
                }}>
                  {/* Camera notch / dynamic island */}
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 70,
                    height: 18,
                    background: '#000',
                    borderRadius: 12,
                    zIndex: 100
                  }} />

                  {/* Phone screen container */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 28,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#000'
                  }}>
                    {status.videoUrl ? (
                      <video
                        src={status.videoUrl}
                        controls={false}
                        autoPlay
                        loop
                        muted={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#52525b' }}>
                        无视频流
                      </div>
                    )}

                    {/* TikTok interface overlays */}
                    <div style={{
                      position: 'absolute',
                      right: 10,
                      bottom: 80,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      zIndex: 10,
                      alignItems: 'center'
                    }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        👤
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 20 }}>❤️</span>
                        <span style={{ fontSize: 9, color: '#fff', marginTop: 2 }}>8.4w</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 20 }}>💬</span>
                        <span style={{ fontSize: 9, color: '#fff', marginTop: 2 }}>2.1k</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 20 }}>↪️</span>
                        <span style={{ fontSize: 9, color: '#fff', marginTop: 2 }}>分享</span>
                      </div>
                    </div>

                    {/* Title overlay in TikTok */}
                    <div style={{
                      position: 'absolute',
                      left: 12,
                      bottom: 12,
                      right: 50,
                      zIndex: 10,
                      color: '#fff',
                      textAlign: 'left'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 2 }}>
                        @{status.productInfo?.title || '爆款优选'}
                      </span>
                      <span style={{ fontSize: 10, color: '#e4e4e7', display: 'block', lineHeight: 1.4 }}>
                        {status.script?.title || '带货视频推广'} #AIGC带货 #好物推荐
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    📱 TikTok Mockup (9:16 真机模拟投流预览)
                  </Text>
                </div>
              </Card>
            </Col>

            {/* Right: cinematic configuration and action portal */}
            <Col span={14}>
              <Card
                bordered={false}
                style={{ 
                  background: '#121214', 
                  border: '1px solid #1f1f23', 
                  borderRadius: 16,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.4)'
                }}
              >
                <div style={{ padding: '0 12px' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <CheckCircleFilled style={{ color: '#10b981', fontSize: 24 }} />
                    <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>一键生产圆满结束！</Title>
                  </div>
                  
                  <Paragraph style={{ color: '#a1a1aa', fontSize: 14, lineHeight: '1.7', marginBottom: 24 }}>
                    AI 导演与剪辑师已协同运作完毕。脚本、多语种 TTS 声道以及火山 Seedance 图像到视频的拼接转场已全自动缝合完毕。<br />
                    成品短视频完全符合 15s 以内站外短平快传播逻辑。
                  </Paragraph>

                  {/* Summary of what changed */}
                  <div style={{ 
                    background: '#1c1c1f', 
                    borderRadius: 10, 
                    border: '1px solid #27272a',
                    padding: '16px 20px', 
                    marginBottom: 28 
                  }}>
                    <Row gutter={16}>
                      <Col span={12} style={{ borderRight: '1px solid #27272a' }}>
                        <span style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>商品推广策划</span>
                        <span style={{ fontSize: 13.5, color: '#fff', fontWeight: 600 }}>{status.productInfo?.title}</span>
                      </Col>
                      <Col span={12} style={{ paddingLeft: 20 }}>
                        <span style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>最终成片长度</span>
                        <span style={{ fontSize: 13.5, color: '#10b981', fontWeight: 600 }}>{status.duration || 12} 秒</span>
                      </Col>
                    </Row>
                    <Divider style={{ borderColor: '#27272a', margin: '12px 0' }} />
                    <div>
                      <span style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6 }}>AI 智能多维度剧本设计</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Tag color="purple" style={{ borderRadius: 4 }}>{status.script?.scenes?.length || 4} 个核心分镜</Tag>
                        <Tag color="cyan" style={{ borderRadius: 4 }}>智能 cross-fade 转场</Tag>
                        <Tag color="volcano" style={{ borderRadius: 4 }}>高保真主播配音</Tag>
                      </div>
                    </div>
                  </div>

                  {/* Operational actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        if (status.videoUrl) window.open(status.videoUrl, '_blank');
                      }}
                      style={{
                        height: 50,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 14.5
                      }}
                    >
                      📥 高清原画成品下载 / 本地保存
                    </Button>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Button
                        icon={<EditOutlined />}
                        size="large"
                        onClick={() => {
                          navigate('/video-creation');
                        }}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 8,
                          background: '#27272a',
                          border: '1px solid #3f3f46',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 13.5
                        }}
                      >
                        进入创作工作台微调
                      </Button>
                      <Button
                        size="large"
                        onClick={() => {
                          setStep(0);
                          setStatus(null);
                          form.resetFields();
                        }}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 8,
                          background: 'transparent',
                          border: '1px solid #27272a',
                          color: '#a1a1aa',
                          fontSize: 13.5
                        }}
                      >
                        生产新商品视频
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}

      </div>
    </div>
  );
};

export default OneClickPage;

// Helper to render AntD's success check icon dynamically
const CheckCircleFilled = (props: any) => (
  <span style={{ color: '#10b981', fontSize: props.fontSize || 14 }}>
    <CheckCircleOutlined {...props} />
  </span>
);
