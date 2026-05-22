import { useState, useRef, useCallback } from 'react'
import { Layout, Card, Steps, Button, Upload, Input, Form, message, Progress, Alert, Radio, Collapse, Timeline, Tag, Tooltip, Switch } from 'antd'
import { UploadOutlined, FileTextOutlined, VideoCameraOutlined, DownloadOutlined, ReloadOutlined, SoundOutlined, PlayCircleOutlined, MergeCellsOutlined } from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname.includes('trae.cn') 
  ? 'http://localhost:3001' 
  : ''

const { Content } = Layout
const { TextArea } = Input
const { Panel } = Collapse

type TaskStatus = 'idle' | 'uploading' | 'generating_script' | 'generating_video' | 'composing' | 'completed' | 'error'
type GenerationMode = 'single' | 'batch'

interface Scene {
  id: number
  description: string
  duration: number
  voiceover: string
  shot: string
  emotion?: string
  transition?: string
  videoUrl?: string
}

interface Script {
  title: string
  scenes: Scene[]
  totalDuration: number
}

interface Track {
  id: number
  scenes: Scene[]
  totalDuration: number
}

interface BatchTask {
  batchId: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  videoUrl?: string
  message?: string
}

const VideoCreationPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [productInfo, setProductInfo] = useState({
    title: '',
    sellingPoints: '',
    targetAudience: ''
  })
  const [generatedScript, setGeneratedScript] = useState<Script | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')
  
  const [generationMode, setGenerationMode] = useState<GenerationMode>('batch')
  const [tracks, setTracks] = useState<Track[]>([])
  const [batchTask, setBatchTask] = useState<BatchTask | null>(null)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>('')
  const [resolution, setResolution] = useState('720p')
  const [ratio, setRatio] = useState('9:16')
  const [enableTTS, setEnableTTS] = useState(true)
  const [transition, setTransition] = useState('fade')
  
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (batchPollRef.current) {
      clearInterval(batchPollRef.current)
      batchPollRef.current = null
    }
  }, [])

  const handleUpload = async (file: File) => {
    setTaskStatus('uploading')
    setErrorMsg('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadedFiles(prev => [...prev, response.data.url])
      message.success('素材上传成功')
      setCurrentStep(1)
      setTaskStatus('idle')
    } catch (error) {
      message.error('上传失败')
      setTaskStatus('error')
    }
    return false
  }

  const generateScript = async () => {
    if (!productInfo.title) {
      message.warning('请输入商品标题')
      return
    }

    setTaskStatus('generating_script')
    setProgress(30)
    setErrorMsg('')
    setStatusText('🤖 AI Agent 正在生成剧本...')

    try {
      const response = await axios.post(`${API_BASE}/api/script/generate`, {
        productInfo,
        materials: uploadedFiles
      })

      const script = response.data.script
      setGeneratedScript(script)
      await calculateTracks(script.scenes)
      
      message.success('✅ 剧本生成成功！')
      setCurrentStep(2)
      setTaskStatus('idle')
      setProgress(0)
      setStatusText('')
    } catch (error: any) {
      const msg = error.response?.data?.error || '剧本生成失败'
      setErrorMsg(msg)
      message.error(msg)
      setTaskStatus('error')
    }
  }

  const calculateTracks = async (scenes: Scene[]) => {
    try {
      const response = await axios.post(`${API_BASE}/api/storyboard/tracks`, { scenes })
      setTracks(response.data.tracks)
    } catch (error) {
      console.error('计算轨道失败:', error)
    }
  }

  const testTTS = async () => {
    if (!generatedScript) return
    
    const testText = generatedScript.scenes[0]?.voiceover || '欢迎使用AIGC带货视频生成系统'
    setStatusText('🎙️ 正在生成测试配音...')
    
    try {
      const response = await axios.post(`${API_BASE}/api/tts/generate`, {
        text: testText,
        options: { voice: 'zh-CN-XiaoxiaoNeural' }
      })
      
      setTtsAudioUrl(response.data.audioUrl)
      message.success('配音生成成功！')
    } catch (error: any) {
      message.error('TTS 生成失败: ' + error.message)
    } finally {
      setStatusText('')
    }
  }

  const batchGenerateVideo = async () => {
    if (!generatedScript) return

    setTaskStatus('generating_video')
    setProgress(10)
    setErrorMsg('')
    setStatusText('🚀 启动批量生成任务...')

    try {
      const response = await axios.post(`${API_BASE}/api/video/batch-generate`, {
        script: generatedScript,
        materials: uploadedFiles,
        options: {
          resolution,
          ratio,
          transition,
          enableTTS
        }
      })

      const batchId = response.data.batchId
      setBatchTask({ batchId, status: 'processing', progress: 0 })
      setStatusText('🎬 正在批量生成视频分镜...')

      const eventSource = new EventSource(`${API_BASE}/api/tasks/${batchId}/stream`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          setProgress(data.progress || 0)
          setBatchTask(prev => prev ? { ...prev, ...data } : null)
          if (data.message) setStatusText(data.message)

          if (data.status === 'completed' && data.videoUrl) {
            eventSource.close()
            setVideoUrl(data.videoUrl)
            setProgress(100)
            setStatusText('')
            setTaskStatus('completed')
            message.success('🎉 视频生成成功！')
            setCurrentStep(3)
          } else if (data.status === 'failed') {
            eventSource.close()
            setErrorMsg(data.error || '批量生成失败')
            setTaskStatus('error')
            setStatusText('')
          }
        } catch (e) {
          console.error('SSE 解析错误:', e)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE 连接错误:', error)
        eventSource.close()
        fallbackToPolling(batchId)
      }

    } catch (error: any) {
      const msg = error.response?.data?.error || '批量生成启动失败'
      setErrorMsg(msg)
      setTaskStatus('error')
      setStatusText('')
    }
  }

  const fallbackToPolling = (batchId: string) => {
    batchPollRef.current = setInterval(async () => {
      try {
        const statusRes = await axios.get(`${API_BASE}/api/video/batch-status/${batchId}`)
        const { status, progress: taskProgress, videoUrl: taskVideoUrl, error: taskError, message } = statusRes.data

        setProgress(taskProgress)
        setBatchTask(prev => prev ? { ...prev, status, progress: taskProgress, message } : null)
        if (message) setStatusText(message)

        if (status === 'completed' && taskVideoUrl) {
          clearPoll()
          setVideoUrl(taskVideoUrl)
          setProgress(100)
          setStatusText('')
          setTaskStatus('completed')
          message.success('🎉 视频生成成功！')
          setCurrentStep(3)
        } else if (status === 'failed') {
          clearPoll()
          setErrorMsg(taskError || '批量生成失败')
          setTaskStatus('error')
          setStatusText('')
        }
      } catch (pollError) {
        console.error('轮询错误:', pollError)
      }
    }, 3000)
  }

  const generateSingleVideo = async () => {
    if (!generatedScript) return

    setTaskStatus('generating_video')
    setProgress(10)
    setErrorMsg('')
    setStatusText('正在提交视频生成任务...')

    try {
      const response = await axios.post(`${API_BASE}/api/video/generate`, {
        script: generatedScript,
        materials: uploadedFiles,
        options: { resolution, ratio }
      })

      const taskId = response.data.taskId
      setStatusText('视频生成中，预计需要1-3分钟...')

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE}/api/video/status/${taskId}`)
          const { status, progress: taskProgress, videoUrl: taskVideoUrl, error: taskError } = statusRes.data

          setProgress(taskProgress)

          if (status === 'succeeded' && taskVideoUrl) {
            clearPoll()
            setVideoUrl(taskVideoUrl)
            setProgress(100)
            setTaskStatus('completed')
            message.success('视频生成成功！')
            setCurrentStep(3)
          } else if (status === 'failed') {
            clearPoll()
            setErrorMsg(taskError || '视频生成失败')
            setTaskStatus('error')
            setStatusText('')
          }
        } catch (pollError) {
          console.error('轮询错误:', pollError)
        }
      }, 5000)

    } catch (error: any) {
      const msg = error.response?.data?.error || '视频生成失败'
      setErrorMsg(msg)
      setTaskStatus('error')
      setStatusText('')
    }
  }

  const generateVideo = () => {
    if (generationMode === 'batch') {
      batchGenerateVideo()
    } else {
      generateSingleVideo()
    }
  }

  const resetAll = () => {
    clearPoll()
    setCurrentStep(0)
    setTaskStatus('idle')
    setUploadedFiles([])
    setGeneratedScript(null)
    setVideoUrl('')
    setBatchTask(null)
    setTtsAudioUrl('')
    setTracks([])
    setProductInfo({ title: '', sellingPoints: '', targetAudience: '' })
    setProgress(0)
    setStatusText('')
    setErrorMsg('')
  }

  const steps = [
    {
      title: '素材上传',
      icon: <UploadOutlined />,
      content: (
        <div className="step-card">
          <div className="step-card__header">
            <div className="step-card__icon">
              <UploadOutlined />
            </div>
            <div className="step-card__title">上传商品素材</div>
          </div>
          <div className="step-card__content">
            <Upload.Dragger
              beforeUpload={handleUpload}
              showUploadList={false}
              accept="image/*,video/*"
              multiple
            >
              <div className="upload-area">
                <div className="upload-area__icon"><UploadOutlined /></div>
                <div className="upload-area__text">点击或拖拽文件到此区域上传</div>
                <div className="upload-area__hint">支持图片和视频格式，可上传多个素材</div>
              </div>
            </Upload.Dragger>
            {uploadedFiles.length > 0 && (
              <div className="media-preview">
                {uploadedFiles.map((url, index) => (
                  <div key={index} className="media-item">
                    {url.endsWith('.mp4') || url.endsWith('.mov') ? (
                      <video src={url} controls />
                    ) : (
                      <img src={url} alt={`素材${index + 1}`} />
                    )}
                  </div>
                ))}
              </div>
            )}
            {uploadedFiles.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <button 
                  className="button-primary"
                  onClick={() => setCurrentStep(1)}
                >
                  下一步：生成剧本 →
                </button>
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: '剧本生成',
      icon: <FileTextOutlined />,
      content: (
        <div className="step-card">
          <div className="step-card__header">
            <div className="step-card__icon">
              <FileTextOutlined />
            </div>
            <div className="step-card__title">输入商品信息，AI 自动生成剧本</div>
          </div>
          <div className="step-card__content">
            <Form layout="vertical">
              <div className="form-section">
                <label className="form-section__label">商品标题 <span style={{ color: '#ff4d4f' }}>*</span></label>
                <Input
                  placeholder="例如：2024新款轻薄羽绒服"
                  value={productInfo.title}
                  onChange={e => setProductInfo({ ...productInfo, title: e.target.value })}
                  size="large"
                />
              </div>
              <div className="form-section">
                <label className="form-section__label">卖点描述</label>
                <TextArea
                  rows={3}
                  placeholder="每行一个卖点，例如：&#10;90%白鹅绒填充&#10;轻至200g&#10;防风防水面料"
                  value={productInfo.sellingPoints}
                  onChange={e => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
                />
              </div>
              <div className="form-section">
                <label className="form-section__label">目标人群</label>
                <Input
                  placeholder="例如：18-35岁都市女性"
                  value={productInfo.targetAudience}
                  onChange={e => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
                />
              </div>
              <button
                className="button-primary"
                onClick={generateScript}
                disabled={taskStatus === 'generating_script'}
              >
                {taskStatus === 'generating_script' ? '🤖 AI Agent 正在生成剧本...' : '🎬 AI 生成剧本'}
              </button>
            </Form>

            {errorMsg && <Alert message={errorMsg} type="error" style={{ marginTop: 16 }} showIcon closable />}

            {generatedScript && (
              <div style={{ marginTop: 24 }}>
                <Alert
                  message="🎉 剧本生成成功！"
                  description={`《${generatedScript.title}》共 ${generatedScript.scenes.length} 个分镜，总时长 ${generatedScript.totalDuration} 秒`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Collapse defaultActiveKey={['1']}>
                  <Panel header="📋 查看完整剧本" key="1">
                    <Timeline>
                      {generatedScript.scenes.map((scene, index) => (
                        <Timeline.Item key={scene.id}>
                          <Card size="small" style={{ borderLeft: '3px solid #1890ff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>分镜 {index + 1}</strong>
                              <Tag color="blue">{scene.duration}秒</Tag>
                            </div>
                            <p style={{ marginTop: 8, marginBottom: 4 }}><strong>镜头:</strong> {scene.shot}</p>
                            <p style={{ marginBottom: 4, color: '#666', fontSize: 12 }}><strong>画面:</strong> {scene.description}</p>
                            <p style={{ color: '#1890ff' }}><SoundOutlined /> <strong>旁白:</strong> {scene.voiceover}</p>
                          </Card>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Panel>
                </Collapse>

                <button
                  className="button-primary"
                  onClick={() => setCurrentStep(2)}
                  style={{ marginTop: 16 }}
                >
                  下一步：视频创作 →
                </button>
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: '视频创作',
      icon: <VideoCameraOutlined />,
      content: (
        <div className="step-card">
          <div className="step-card__header">
            <div className="step-card__icon">
              <VideoCameraOutlined />
            </div>
            <div className="step-card__title">视频生成（火山引擎 Seedance）</div>
          </div>
          <div className="step-card__content">
            {generatedScript && (
              <>
                <Collapse style={{ marginBottom: 16 }}>
                  <Panel header="⚙️ 高级选项（分辨率、配音、转场）" key="1">
                    <Form layout="vertical">
                      <div className="form-section">
                        <label className="form-section__label">生成模式</label>
                        <Radio.Group value={generationMode} onChange={e => setGenerationMode(e.target.value)}>
                          <Radio.Button value="batch"><MergeCellsOutlined /> 批量生成（多分镜拼接）</Radio.Button>
                          <Radio.Button value="single"><PlayCircleOutlined /> 单分镜生成</Radio.Button>
                        </Radio.Group>
                      </div>
                      
                      <div className="form-section">
                        <label className="form-section__label">分辨率</label>
                        <Radio.Group value={resolution} onChange={e => setResolution(e.target.value)}>
                          <Radio.Button value="480p">480p</Radio.Button>
                          <Radio.Button value="720p">720p</Radio.Button>
                        </Radio.Group>
                      </div>
                      
                      <div className="form-section">
                        <label className="form-section__label">画幅比例</label>
                        <Radio.Group value={ratio} onChange={e => setRatio(e.target.value)}>
                          <Radio.Button value="9:16">9:16 (竖屏)</Radio.Button>
                          <Radio.Button value="16:9">16:9 (横屏)</Radio.Button>
                          <Radio.Button value="1:1">1:1 (方形)</Radio.Button>
                        </Radio.Group>
                      </div>
                      
                      {generationMode === 'batch' && (
                        <>
                          <div className="form-section">
                            <label className="form-section__label">转场效果</label>
                            <Radio.Group value={transition} onChange={e => setTransition(e.target.value)}>
                              <Radio.Button value="cut">直接切换</Radio.Button>
                              <Radio.Button value="fade">淡入淡出</Radio.Button>
                              <Radio.Button value="dissolve">溶解</Radio.Button>
                            </Radio.Group>
                          </div>
                          
                          <div className="form-section">
                            <label className="form-section__label">启用 TTS 配音</label>
                            <div>
                              <Switch checked={enableTTS} onChange={setEnableTTS} />
                              <span style={{ marginLeft: 8, color: '#666' }}>
                                {enableTTS ? '将为视频添加 AI 配音和字幕' : '仅生成背景音乐'}
                              </span>
                            </div>
                          </div>
                          
                          <Button 
                            icon={<SoundOutlined />} 
                            onClick={testTTS}
                            style={{ marginBottom: 16 }}
                          >
                            测试配音效果
                          </Button>
                          
                          {ttsAudioUrl && (
                            <audio src={ttsAudioUrl} controls style={{ width: '100%', marginBottom: 16 }} />
                          )}
                        </>
                      )}
                    </Form>
                  </Panel>
                  
                  <Panel header="🎞️ 分镜轨道预览（P1 功能）" key="2">
                    {tracks.length > 0 ? (
                      <div>
                        <p style={{ marginBottom: 12 }}>已按 15秒/轨道 自动分组：</p>
                        {tracks.map(track => (
                          <Card 
                            key={track.id} 
                            size="small" 
                            title={`轨道 ${track.id} (${track.totalDuration}秒)`}
                            style={{ marginBottom: 8 }}
                          >
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {track.scenes.map((scene) => (
                                <Tooltip key={scene.id} title={scene.voiceover}>
                                  <div style={{
                                    padding: '8px 12px',
                                    background: '#e6f7ff',
                                    border: '1px solid #91d5ff',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    minWidth: 80,
                                    textAlign: 'center'
                                  }}>
                                    <div>分镜{scene.id}</div>
                                    <div style={{ color: '#666' }}>{scene.duration}s</div>
                                  </div>
                                </Tooltip>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#999' }}>暂无轨道信息</p>
                    )}
                  </Panel>
                </Collapse>

                <button
                  className="button-primary"
                  onClick={generateVideo}
                  disabled={taskStatus === 'generating_video'}
                >
                  {taskStatus === 'generating_video' 
                    ? `正在${generationMode === 'batch' ? '批量生成' : '生成视频'}...` 
                    : generationMode === 'batch' ? '🎬 一键生成完整视频' : '▶️ 生成单分镜视频'}
                </button>
              </>
            )}

            {taskStatus === 'generating_video' && (
              <div className="progress-section">
                <div className="progress-section__header">
                  <div className="progress-section__title">{statusText}</div>
                  <div className="progress-section__percentage">{progress}%</div>
                </div>
                <Progress percent={progress} status="active" />
                
                {batchTask && (
                  <div style={{ marginTop: 16, textAlign: 'left' }}>
                    <Tag 
                      color={batchTask.status === 'processing' ? 'processing' : batchTask.status === 'completed' ? 'success' : 'error'}
                    >
                      {batchTask.status === 'processing' ? '进行中' : batchTask.status === 'completed' ? '已完成' : '失败'}
                    </Tag>
                    {batchTask.message && (
                      <p style={{ marginTop: 8, color: '#666', fontSize: 12 }}>{batchTask.message}</p>
                    )}
                  </div>
                )}
                
                <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                  {generationMode === 'batch' 
                    ? '批量生成包含：分镜视频生成 → TTS 配音 → 视频拼接，预计需要 3-5 分钟' 
                    : '视频生成通常需要 1-3 分钟，请耐心等待'}
                </p>
              </div>
            )}

            {taskStatus === 'error' && errorMsg && (
              <Alert
                message="生成失败"
                description={errorMsg}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
                action={<Button size="small" onClick={generateVideo}><ReloadOutlined /> 重试</Button>}
              />
            )}

            {taskStatus === 'idle' && !generatedScript && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                请先完成剧本生成
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: '预览导出',
      icon: <DownloadOutlined />,
      content: (
        <div className="step-card">
          <div className="step-card__header">
            <div className="step-card__icon">
              <DownloadOutlined />
            </div>
            <div className="step-card__title">视频预览与导出</div>
          </div>
          <div className="step-card__content">
            {videoUrl ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 16 }}>
                  <Tag color="success">{resolution}</Tag>
                  <Tag color="processing">{ratio}</Tag>
                  {generationMode === 'batch' && <Tag color="blue">多分镜拼接</Tag>}
                  {enableTTS && generationMode === 'batch' && <Tag color="purple">AI 配音</Tag>}
                </div>
                
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', maxWidth: ratio === '9:16' ? 360 : 640, borderRadius: 12, marginBottom: 16 }}
                />
                
                <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button className="button-primary" style={{ maxWidth: 200 }}>
                    <DownloadOutlined /> 下载视频
                  </button>
                  <button 
                    className="button-secondary"
                    onClick={resetAll}
                    style={{ padding: '12px 24px' }}
                  >
                    创建新视频
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无视频可预览
              </div>
            )}
          </div>
        </div>
      )
    }
  ]

  return (
    <>
      <div className="topbar">
        <div className="topbar__title">🎬 AIGC 带货视频生成系统</div>
        <div className="topbar__actions">
          <Tag color="blue">P0 基础</Tag>
          <Tag color="green">P1 高级</Tag>
          <Tag color="purple">P2 Agent</Tag>
        </div>
      </div>
      <Content className="content-area">
        <div className="page-title">视频创作工作台</div>
        <div className="page-subtitle">基于 AI 技术的一站式带货视频生成解决方案</div>
        
        <Steps
          current={currentStep}
          items={steps.map(step => ({ title: step.title, icon: step.icon }))}
          style={{ marginBottom: 32 }}
        />
        {steps[currentStep].content}
      </Content>
    </>
  )
}

export default VideoCreationPage
