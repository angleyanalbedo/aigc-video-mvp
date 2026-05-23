import { useState, useRef, useCallback, useEffect } from 'react'
import { Layout, Card, Steps, Button, Upload, Input, Form, message, Progress, Alert, Radio, Collapse, Timeline, Tag, Tooltip, Switch, Modal, List, Select, Empty, Space } from 'antd'
import { UploadOutlined, FileTextOutlined, VideoCameraOutlined, DownloadOutlined, ReloadOutlined, SoundOutlined, PlayCircleOutlined, MergeCellsOutlined, FolderOutlined, PictureOutlined } from '@ant-design/icons'
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
  currentPhase?: string // 当前阶段
  completedScenes?: number // 已完成分镜数
  totalScenes?: number // 总分镜数
  currentScene?: number // 当前处理分镜
  estimatedTimeRemaining?: number // 预估剩余时间(秒)
  errors?: Array<{sceneIndex: number, message: string}> // 错误详情
}

const VideoCreationPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [materialsFromLibrary, setMaterialsFromLibrary] = useState<any[]>([])
  const [selectedFromLibrary, setSelectedFromLibrary] = useState<string[]>([])
  const [libraryModalVisible, setLibraryModalVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchTags, setSearchTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
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

  const loadMaterials = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/materials`)
      const data = await response.json()
      if (data.success) {
        const list = data.data || data.materials || []
        setMaterialsFromLibrary(list)
        const tags = new Set<string>()
        list.forEach((m: any) => {
          if (m.tags && Array.isArray(m.tags)) {
            m.tags.forEach((t: string) => tags.add(t))
          }
        })
        setAllTags([...tags])
      }
    } catch (error) {
      console.error('加载素材库失败:', error)
    }
  }

  const searchMaterials = async () => {
    if (!searchKeyword && searchTags.length === 0) {
      loadMaterials()
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/materials/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchKeyword, tags: searchTags, topK: 50 }),
      })
      const data = await response.json()
      if (data.success) {
        setMaterialsFromLibrary(data.results || data.data || [])
      }
    } catch (error) {
      console.error('搜索失败:', error)
    }
  }

  const openLibraryModal = () => {
    loadMaterials()
    setLibraryModalVisible(true)
  }

  const selectFromLibrary = (material: any) => {
    if (!selectedFromLibrary.includes(material.url)) {
      setSelectedFromLibrary(prev => [...prev, material.url])
      // 同时添加到 uploadedFiles
      if (!uploadedFiles.includes(material.url)) {
        setUploadedFiles(prev => [...prev, material.url])
      }
    }
  }

  const removeSelected = (url: string) => {
    setSelectedFromLibrary(prev => prev.filter(u => u !== url))
    setUploadedFiles(prev => prev.filter(u => u !== url))
  }

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
      setBatchTask({ 
        batchId, 
        status: 'processing', 
        progress: 0, 
        totalScenes: generatedScript.scenes.length,
        completedScenes: 0,
        currentPhase: '初始化中',
        currentScene: 0
      })
      setStatusText('🎬 正在启动分镜生成任务...')

      const eventSource = new EventSource(`${API_BASE}/api/tasks/${batchId}/stream`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          setProgress(data.progress || 0)
          
          // 智能更新状态文本
          if (data.currentPhase) {
            const phaseTexts: Record<string, string> = {
              'initializing': '🎬 正在初始化任务...',
              'generating_images': '🖼️ 正在生成分镜图片...',
              'generating_videos': '🎥 正在生成视频片段...',
              'generating_tts': '🎙️ 正在生成配音...',
              'composing': '🎞️ 正在拼接完整视频...',
              'finalizing': '✨ 正在完成最终处理...'
            }
            setStatusText(data.message || phaseTexts[data.currentPhase] || '正在处理...')
          } else if (data.message) {
            setStatusText(data.message)
          }
          
          setBatchTask(prev => prev ? { 
            ...prev, 
            ...data,
            totalScenes: prev.totalScenes,
            completedScenes: data.completedScenes ?? prev.completedScenes,
            currentScene: data.currentScene ?? prev.currentScene
          } : null)

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
            <div className="step-card__title">选择或上传商品素材</div>
          </div>
          <div className="step-card__content">
            <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
              <Button 
                type="primary" 
                icon={<FolderOutlined />}
                size="large"
                onClick={openLibraryModal}
                style={{ width: '100%' }}
              >
                从素材库选择
              </Button>
              <div style={{ textAlign: 'center', color: '#999' }}>或</div>
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
            </Space>
            
            {uploadedFiles.length > 0 && (
              <div className="media-preview">
                {uploadedFiles.map((url, index) => (
                  <div key={index} className="media-item" style={{ position: 'relative' }}>
                    {url.endsWith('.mp4') || url.endsWith('.mov') ? (
                      <video src={url} controls />
                    ) : (
                      <img src={url} alt={`素材${index + 1}`} />
                    )}
                    <Button
                      type="text"
                      danger
                      size="small"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)', borderRadius: 4 }}
                      onClick={() => removeSelected(url)}
                    >
                      ×
                    </Button>
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
                  <Panel header="📋 查看与精细修改完整剧本 (可直接在输入框中改字)" key="1">
                    <Timeline>
                      {generatedScript.scenes.map((scene, index) => (
                        <Timeline.Item key={scene.id}>
                          <Card size="small" style={{ borderLeft: '3px solid #1890ff', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <strong>分镜 {index + 1}</strong>
                              <Space>
                                <span style={{ fontSize: 11, color: '#888' }}>时长:</span>
                                <Input
                                  type="number"
                                  value={scene.duration}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 3;
                                    const newScenes = [...generatedScript.scenes];
                                    newScenes[index] = { ...newScenes[index], duration: val };
                                    const total = newScenes.reduce((sum, s) => sum + (s.duration || 3), 0);
                                    setGeneratedScript({ ...generatedScript, scenes: newScenes, totalDuration: total });
                                    calculateTracks(newScenes);
                                  }}
                                  style={{ width: 60, height: 22, fontSize: 11, padding: '2px 4px' }}
                                />
                                <span style={{ fontSize: 11, color: '#888' }}>秒</span>
                                <Tag color="blue">{scene.shot}</Tag>
                              </Space>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}><strong>画面视觉设计：</strong></div>
                              <TextArea
                                value={scene.description}
                                rows={2}
                                onChange={(e) => {
                                  const newScenes = [...generatedScript.scenes];
                                  newScenes[index] = { ...newScenes[index], description: e.target.value };
                                  setGeneratedScript({ ...generatedScript, scenes: newScenes });
                                  calculateTracks(newScenes);
                                }}
                                style={{ fontSize: 12, background: '#fafafa' }}
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#1890ff', marginBottom: 2 }}><SoundOutlined /> <strong>旁白配音：</strong></div>
                              <Input
                                value={scene.voiceover}
                                onChange={(e) => {
                                  const newScenes = [...generatedScript.scenes];
                                  newScenes[index] = { ...newScenes[index], voiceover: e.target.value };
                                  setGeneratedScript({ ...generatedScript, scenes: newScenes });
                                }}
                                style={{ fontSize: 12, color: '#1890ff', background: '#fafafa' }}
                              />
                            </div>
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
              <div className="progress-section" style={{ background: '#f8f9fa', borderRadius: 12, padding: 24 }}>
                <div className="progress-section__header" style={{ marginBottom: 20 }}>
                  <div className="progress-section__title" style={{ fontSize: 16, fontWeight: 600 }}>{statusText}</div>
                  <div className="progress-section__percentage" style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>{progress}%</div>
                </div>
                
                <Progress 
                  percent={progress} 
                  status="active" 
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                  style={{ marginBottom: 20 }}
                />
                
                {batchTask && (
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      <Tag 
                        color={batchTask.status === 'processing' ? 'processing' : batchTask.status === 'completed' ? 'success' : 'error'}
                        style={{ fontSize: 12 }}
                      >
                        {batchTask.status === 'processing' ? '⏳ 进行中' : batchTask.status === 'completed' ? '✅ 已完成' : '❌ 失败'}
                      </Tag>
                      
                      {batchTask.currentPhase && (
                        <Tag color="blue" style={{ fontSize: 12 }}>
                          🎬 阶段: {batchTask.currentPhase}
                        </Tag>
                      )}
                      
                      {batchTask.totalScenes && (
                        <Tag color="purple" style={{ fontSize: 12 }}>
                          📹 进度: {batchTask.completedScenes || 0}/{batchTask.totalScenes} 分镜
                        </Tag>
                      )}
                      
                      {batchTask.estimatedTimeRemaining !== undefined && (
                        <Tag color="cyan" style={{ fontSize: 12 }}>
                          ⏱️ 预估剩余: {Math.round(batchTask.estimatedTimeRemaining)}秒
                        </Tag>
                      )}
                    </div>
                    
                    {/* 详细进度时间线 */}
                    {batchTask.totalScenes && batchTask.completedScenes !== undefined && (
                      <div style={{ marginBottom: 16, padding: 12, background: '#fff', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                          <strong>分镜生成进度：</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Array.from({ length: batchTask.totalScenes }, (_, i) => (
                            <div 
                              key={i}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 600,
                                background: i < batchTask.completedScenes 
                                  ? '#52c41a' 
                                  : batchTask.currentScene === i 
                                    ? '#1890ff' 
                                    : '#e8e8e8',
                                color: i < batchTask.completedScenes || batchTask.currentScene === i 
                                  ? '#fff' 
                                  : '#999',
                                boxShadow: batchTask.currentScene === i ? '0 0 0 2px rgba(24,144,255,0.3)' : 'none'
                              }}
                            >
                              {i < batchTask.completedScenes ? '✓' : i + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {batchTask.message && (
                      <div style={{ marginTop: 8, padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
                        <p style={{ margin: 0, color: '#1890ff', fontSize: 12 }}>
                          💡 {batchTask.message}
                        </p>
                      </div>
                    )}
                    
                    {/* 错误详情 */}
                    {batchTask.errors && batchTask.errors.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#fff1f0', borderRadius: 8, border: '1px solid #ffccc7' }}>
                        <div style={{ fontSize: 12, color: '#f5222d', fontWeight: 600, marginBottom: 8 }}>
                          ⚠️ 生成过程中的问题：
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {batchTask.errors.map((err, idx) => (
                            <li key={idx} style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                              分镜 {err.sceneIndex + 1}: {err.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ marginTop: 20, padding: 16, background: '#fff', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
                  <p style={{ margin: 0, color: '#666', fontSize: 12, lineHeight: '1.6' }}>
                    <strong>💡 小提示：</strong>
                    {generationMode === 'batch' 
                      ? '批量生成包含：分镜视频生成 → TTS 配音 → 视频拼接，预计需要 3-5 分钟。您可以切换到其他页面或在分镜渲染页面继续编辑，进度会自动同步。' 
                      : '视频生成通常需要 1-3 分钟，请耐心等待。如果遇到错误，可以点击重试按钮重新生成。'}
                  </p>
                </div>
                
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    danger 
                    type="dashed" 
                    onClick={() => { clearPoll(); setTaskStatus('idle'); setStatusText(''); }}
                    disabled={taskStatus !== 'generating_video'}
                  >
                    ⏹️ 取消生成
                  </Button>
                </div>
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
          onChange={(newStep) => {
            // Allow going backward freely
            if (newStep < currentStep) {
              setCurrentStep(newStep);
              return;
            }
            // Allow going forward only if current stage requirements are satisfied
            if (newStep === 1 && uploadedFiles.length > 0) {
              setCurrentStep(1);
            } else if (newStep === 2 && generatedScript) {
              setCurrentStep(2);
            } else if (newStep === 3 && videoUrl) {
              setCurrentStep(3);
            } else {
              message.warning('请先完成当前步骤的前置操作');
            }
          }}
          items={steps.map(step => ({ title: step.title, icon: step.icon }))}
          style={{ marginBottom: 32 }}
        />
        {steps[currentStep].content}
      </Content>

      <Modal
        title="📂 从素材库选择"
        open={libraryModalVisible}
        onCancel={() => setLibraryModalVisible(false)}
        onOk={() => setLibraryModalVisible(false)}
        width={900}
        okText="确认选择"
        cancelText="取消"
      >
        <Card title="🔍 搜索" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.Search
              placeholder="按关键词搜索"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={searchMaterials}
              style={{ marginBottom: 8 }}
            />
            <Select
              mode="multiple"
              placeholder="按标签筛选"
              style={{ width: '100%', marginBottom: 8 }}
              value={searchTags}
              onChange={setSearchTags}
            >
              {allTags.map(tag => (
                <Select.Option key={tag} value={tag}>{tag}</Select.Option>
              ))}
            </Select>
            <Space>
              <Button type="primary" onClick={searchMaterials} size="small">搜索</Button>
              <Button onClick={() => { setSearchKeyword(''); setSearchTags([]); loadMaterials() }} size="small">重置</Button>
            </Space>
          </Space>
        </Card>

        {materialsFromLibrary.length === 0 ? (
          <Empty description="暂无素材，请先在素材管理页面上传" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 2, sm: 3, md: 4, lg: 4, xl: 4 }}
            dataSource={materialsFromLibrary}
            renderItem={(item) => (
              <List.Item>
                <Card
                  hoverable
                  size="small"
                  style={{ 
                    height: '100%', 
                    border: selectedFromLibrary.includes(item.url) ? '2px solid #1890ff' : undefined,
                    background: selectedFromLibrary.includes(item.url) ? '#e6f7ff' : undefined
                  }}
                  cover={
                    item.type && item.type.startsWith('image') ? (
                      <img alt={item.filename} src={item.url} style={{ height: 120, objectFit: 'cover' }} />
                    ) : item.type && item.type.startsWith('video') ? (
                      <div style={{ height: 120, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <VideoCameraOutlined style={{ fontSize: 32, color: '#fff' }} />
                      </div>
                    ) : (
                      <img alt={item.filename} src={item.url} style={{ height: 120, objectFit: 'cover' }} />
                    )
                  }
                  onClick={() => selectFromLibrary(item)}
                >
                  <Card.Meta
                    title={item.filename?.slice(0, 20) + '...'}
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Space wrap size="small">
                          {item.tags?.slice(0, 2).map((tag: string) => (
                            <Tag key={tag} color="blue" style={{ fontSize: 10, padding: '1px 6px' }}>{tag}</Tag>
                          ))}
                        </Space>
                        {selectedFromLibrary.includes(item.url) && (
                          <Tag color="success" style={{ fontSize: 10, padding: '1px 6px' }}>已选择</Tag>
                        )}
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}

        {selectedFromLibrary.length > 0 && (
          <Alert
            message={`已选择 ${selectedFromLibrary.length} 个素材`}
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    </>
  )
}

export default VideoCreationPage
