import { useState, useRef, useCallback, useEffect } from 'react'
import { Layout, Card, Steps, Button, Upload, Input, Form, message, Progress, Spin, Alert, Radio, Collapse, Timeline, Badge, Tag, Tooltip, Switch } from 'antd'
import { UploadOutlined, FileTextOutlined, VideoCameraOutlined, DownloadOutlined, ReloadOutlined, SoundOutlined, PlayCircleOutlined, PauseCircleOutlined, EditOutlined, AppstoreOutlined, MergeCellsOutlined } from '@ant-design/icons'
import axios from 'axios'
import './App.css'

// API 基础地址 - 在 Trae 预览环境中使用绝对路径
const API_BASE = window.location.hostname.includes('trae.cn') 
  ? 'http://localhost:3001' 
  : ''

const { Header, Content } = Layout
const { TextArea } = Input
const { Panel } = Collapse

type TaskStatus = 'idle' | 'uploading' | 'generating_script' | 'generating_video' | 'composing' | 'completed' | 'error'
type GenerationMode = 'single' | 'batch'  // 单分镜生成 vs 批量生成

interface Scene {
  id: number
  description: string
  duration: number
  voiceover: string
  shot: string
  emotion?: string
  transition?: string
  videoUrl?: string  // 生成分镜视频后填充
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

function App() {
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
  
  // P1/P2 新功能状态
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

  // 清理轮询
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

  // 素材上传
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

  // 生成剧本
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
      
      // 计算轨道信息
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

  // 计算轨道分组
  const calculateTracks = async (scenes: Scene[]) => {
    try {
      const response = await axios.post(`${API_BASE}/api/storyboard/tracks`, { scenes })
      setTracks(response.data.tracks)
    } catch (error) {
      console.error('计算轨道失败:', error)
    }
  }

  // 测试 TTS
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

  // 批量生成视频（P1/P2 核心功能）
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

      // 轮询批量任务状态
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

    } catch (error: any) {
      const msg = error.response?.data?.error || '批量生成启动失败'
      setErrorMsg(msg)
      setTaskStatus('error')
      setStatusText('')
    }
  }

  // 单分镜生成（原有功能）
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

      // 开始轮询任务状态
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

  // 生成视频入口
  const generateVideo = () => {
    if (generationMode === 'batch') {
      batchGenerateVideo()
    } else {
      generateSingleVideo()
    }
  }

  // 重新开始
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
        <Card title="上传商品素材">
          <Upload.Dragger
            beforeUpload={handleUpload}
            showUploadList={false}
            accept="image/*,video/*"
            multiple
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持图片和视频格式，可上传多个素材</p>
          </Upload.Dragger>
          {uploadedFiles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>已上传素材 ({uploadedFiles.length})：</h4>
              {uploadedFiles.map((url, index) => (
                <div key={index} style={{ marginBottom: 8, display: 'inline-block', marginRight: 12 }}>
                  {url.endsWith('.mp4') || url.endsWith('.mov') ? (
                    <video src={url} style={{ width: 160, borderRadius: 8 }} controls />
                  ) : (
                    <img src={url} style={{ width: 160, borderRadius: 8 }} alt={`素材${index + 1}`} />
                  )}
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <Button type="primary" onClick={() => setCurrentStep(1)}>下一步：生成剧本</Button>
              </div>
            </div>
          )}
        </Card>
      )
    },
    {
      title: '剧本生成',
      icon: <FileTextOutlined />,
      content: (
        <Card title="输入商品信息，AI 自动生成剧本">
          <Form layout="vertical">
            <Form.Item label="商品标题" required>
              <Input
                placeholder="例如：2024新款轻薄羽绒服"
                value={productInfo.title}
                onChange={e => setProductInfo({ ...productInfo, title: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="卖点描述">
              <TextArea
                rows={3}
                placeholder="每行一个卖点，例如：&#10;90%白鹅绒填充&#10;轻至200g&#10;防风防水面料"
                value={productInfo.sellingPoints}
                onChange={e => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="目标人群">
              <Input
                placeholder="例如：18-35岁都市女性"
                value={productInfo.targetAudience}
                onChange={e => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
              />
            </Form.Item>
            <Button
              type="primary"
              onClick={generateScript}
              loading={taskStatus === 'generating_script'}
              block
              size="large"
            >
              {taskStatus === 'generating_script' ? '🤖 AI Agent 正在生成剧本...' : '🎬 AI 生成剧本'}
            </Button>
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

              <Button
                type="primary"
                onClick={() => setCurrentStep(2)}
                block
                size="large"
                style={{ marginTop: 16 }}
              >
                下一步：视频创作
              </Button>
            </div>
          )}
        </Card>
      )
    },
    {
      title: '视频创作',
      icon: <VideoCameraOutlined />,
      content: (
        <Card title="视频生成（火山引擎 Seedance）">
          {generatedScript && (
            <>
              {/* P1/P2 高级选项 */}
              <Collapse style={{ marginBottom: 16 }}>
                <Panel header="⚙️ 高级选项（分辨率、配音、转场）" key="1">
                  <Form layout="vertical">
                    <Form.Item label="生成模式">
                      <Radio.Group value={generationMode} onChange={e => setGenerationMode(e.target.value)}>
                        <Radio.Button value="batch"><MergeCellsOutlined /> 批量生成（多分镜拼接）</Radio.Button>
                        <Radio.Button value="single"><PlayCircleOutlined /> 单分镜生成</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    
                    <Form.Item label="分辨率">
                      <Radio.Group value={resolution} onChange={e => setResolution(e.target.value)}>
                        <Radio.Button value="480p">480p</Radio.Button>
                        <Radio.Button value="720p">720p</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    
                    <Form.Item label="画幅比例">
                      <Radio.Group value={ratio} onChange={e => setRatio(e.target.value)}>
                        <Radio.Button value="9:16">9:16 (竖屏)</Radio.Button>
                        <Radio.Button value="16:9">16:9 (横屏)</Radio.Button>
                        <Radio.Button value="1:1">1:1 (方形)</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    
                    {generationMode === 'batch' && (
                      <>
                        <Form.Item label="转场效果">
                          <Radio.Group value={transition} onChange={e => setTransition(e.target.value)}>
                            <Radio.Button value="cut">直接切换</Radio.Button>
                            <Radio.Button value="fade">淡入淡出</Radio.Button>
                            <Radio.Button value="dissolve">溶解</Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                        
                        <Form.Item label="启用 TTS 配音">
                          <Switch checked={enableTTS} onChange={setEnableTTS} />
                          <span style={{ marginLeft: 8, color: '#666' }}>
                            {enableTTS ? '将为视频添加 AI 配音和字幕' : '仅生成背景音乐'}
                          </span>
                        </Form.Item>
                        
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
                
                {/* 分镜轨道预览 */}
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
                            {track.scenes.map((scene, idx) => (
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

              <Button
                type="primary"
                onClick={generateVideo}
                loading={taskStatus === 'generating_video'}
                block
                size="large"
                icon={generationMode === 'batch' ? <MergeCellsOutlined /> : <PlayCircleOutlined />}
              >
                {taskStatus === 'generating_video' 
                  ? `正在${generationMode === 'batch' ? '批量生成' : '生成视频'}...` 
                  : generationMode === 'batch' ? '🎬 一键生成完整视频' : '▶️ 生成单分镜视频'}
              </Button>
            </>
          )}

          {taskStatus === 'generating_video' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, fontSize: 16 }}>{statusText}</p>
              <Progress percent={progress} status="active" style={{ maxWidth: 400, margin: '0 auto' }} />
              
              {batchTask && (
                <div style={{ marginTop: 16, textAlign: 'left', maxWidth: 400, margin: '16px auto' }}>
                  <Badge 
                    status={batchTask.status === 'processing' ? 'processing' : batchTask.status === 'completed' ? 'success' : 'error'} 
                    text={`任务状态: ${batchTask.status === 'processing' ? '进行中' : batchTask.status === 'completed' ? '已完成' : '失败'}`}
                  />
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
        </Card>
      )
    },
    {
      title: '预览导出',
      icon: <DownloadOutlined />,
      content: (
        <Card title="视频预览与导出">
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
              
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  href={videoUrl}
                  download
                  target="_blank"
                  style={{ marginRight: 8 }}
                >
                  下载视频
                </Button>
                <Button onClick={resetAll}>
                  创建新视频
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无视频可预览
            </div>
          )}
        </Card>
      )
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>🎬 AIGC 带货视频生成系统</h1>
          <div>
            <Tag color="blue">P0 基础功能</Tag>
            <Tag color="green">P1 高级功能</Tag>
            <Tag color="purple">P2 Agent编排</Tag>
          </div>
        </div>
      </Header>
      <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <Steps
          current={currentStep}
          items={steps.map(step => ({ title: step.title, icon: step.icon }))}
          style={{ marginBottom: 32 }}
        />
        {steps[currentStep].content}
      </Content>
    </Layout>
  )
}

export default App
