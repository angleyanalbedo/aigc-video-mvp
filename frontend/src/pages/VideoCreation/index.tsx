import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, Input, Button, Tag, Progress, Alert, Radio, Switch, Modal,
  message, Tooltip, Select, Divider
} from 'antd'
import {
  UploadOutlined, FileTextOutlined, VideoCameraOutlined,
  PictureOutlined, SoundOutlined, ThunderboltOutlined,
  EditOutlined, SwapOutlined, PlayCircleOutlined,
  CheckCircleFilled, ClockCircleFilled, MinusCircleFilled,
  DeleteOutlined, PlusOutlined, ReloadOutlined,
  AppstoreOutlined, ScissorOutlined, BulbOutlined,
  CaretRightOutlined, PauseOutlined, ArrowUpOutlined, ArrowDownOutlined,
  LoadingOutlined, DownloadOutlined
} from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname.includes('trae.cn')
  ? 'http://localhost:3001'
  : ''

const { TextArea } = Input

type ModuleKey = 'material' | 'script' | 'creation'
type TaskStatus = 'idle' | 'loading' | 'generating' | 'completed' | 'error'

const VOICE_OPTIONS = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (温柔女声)' },
  { value: 'zh-CN-YunxiNeural', label: '云希 (活力男声)' },
  { value: 'zh-CN-YunjianNeural', label: '云健 (运动男声)' },
  { value: 'en-US-GuyNeural', label: 'Guy (英文男声)' },
  { value: 'en-US-JennyNeural', label: 'Jenny (英文女声)' }
]

interface Scene {
  id: number
  description: string
  duration: number
  voiceover: string
  shot: string
  emotion?: string
  transition?: string
  videoUrl?: string
  voice?: string
}

interface Script {
  title: string
  scenes: Scene[]
  totalDuration: number
}

interface MaterialItem {
  id?: string
  url: string
  filename?: string
  type?: string
  tags?: string[]
  analysis?: any
}

const MODULE_CONFIG: Record<ModuleKey, {
  key: ModuleKey
  label: string
  icon: React.ReactNode
  color: string
  gradient: string
  description: string
}> = {
  material: {
    key: 'material',
    label: '素材模块',
    icon: <PictureOutlined />,
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    description: '上传素材 · AI分析 · 标签提取'
  },
  script: {
    key: 'script',
    label: '剧本模块',
    icon: <FileTextOutlined />,
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    description: '生成剧本 · 模板创作 · 精细干预'
  },
  creation: {
    key: 'creation',
    label: '创作模块',
    icon: <VideoCameraOutlined />,
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
    description: '视频生成 · 批量渲染 · 一键成片'
  }
}

const VideoCreationPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>('material')

  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [libraryVisible, setLibraryVisible] = useState(false)
  const [libraryItems, setLibraryItems] = useState<MaterialItem[]>([])
  const [librarySearch, setLibrarySearch] = useState('')

  const [productInfo, setProductInfo] = useState({
    title: '',
    sellingPoints: '',
    targetAudience: ''
  })
  const [script, setScript] = useState<Script | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)

  const [videoStatus, setVideoStatus] = useState<TaskStatus>('idle')
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [generationMode, setGenerationMode] = useState<'batch' | 'single'>('batch')
  const [resolution, setResolution] = useState('720p')
  const [ratio, setRatio] = useState('9:16')
  const [enableTTS, setEnableTTS] = useState(true)
  const [transition, setTransition] = useState('fade')
  const [statusText, setStatusText] = useState('')

  // Local Voice Audition & Single Scene Rendering States
  const [playingSceneId, setPlayingSceneId] = useState<number | null>(null)
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null)
  const [renderingScenes, setRenderingScenes] = useState<Record<number, { progress: number; status: 'generating' | 'completed' | 'error'; error?: string }>>({})

  // Cleanup for audio & local SpeechSynthesis
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.pause()
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [audioPlayer])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (batchPollRef.current) { clearInterval(batchPollRef.current); batchPollRef.current = null }
  }, [])

  const getModuleStatus = (key: ModuleKey): 'empty' | 'ready' | 'done' => {
    if (key === 'material') return materials.length > 0 ? 'done' : 'empty'
    if (key === 'script') return script ? 'done' : materials.length > 0 ? 'ready' : 'empty'
    if (key === 'creation') return videoUrl ? 'done' : script ? 'ready' : 'empty'
    return 'empty'
  }

  const statusIcon = (status: 'empty' | 'ready' | 'done') => {
    if (status === 'done') return <CheckCircleFilled style={{ color: '#10b981', fontSize: 14 }} />
    if (status === 'ready') return <ClockCircleFilled style={{ color: '#f59e0b', fontSize: 14 }} />
    return <MinusCircleFilled style={{ color: '#cbd5e1', fontSize: 14 }} />
  }

  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMaterials(prev => [...prev, { url: res.data.url, filename: file.name, type: file.type }])
      message.success('素材上传成功')
    } catch {
      message.error('上传失败')
    }
    return false
  }

  const analyzeMaterial = async (materialUrl: string) => {
    try {
      const listRes = await axios.get(`${API_BASE}/api/materials`)
      const list = listRes.data.data || listRes.data.materials || []
      const found = list.find((m: any) => m.url === materialUrl)
      if (!found?.id) { message.warning('未找到素材记录'); return }

      const res = await axios.post(`${API_BASE}/api/material-analysis/${found.id}/analyze`)
      setAnalysisResult(res.data)
      message.success('素材分析完成')
    } catch (err: any) {
      message.error('分析失败: ' + (err.response?.data?.error || err.message))
    }
  }

  const removeMaterial = (url: string) => {
    setMaterials(prev => prev.filter(m => m.url !== url))
  }

  const openLibrary = async () => {
    setLibraryVisible(true)
    try {
      const res = await axios.get(`${API_BASE}/api/materials`)
      setLibraryItems(res.data.data || res.data.materials || [])
    } catch { message.error('加载素材库失败') }
  }

  const selectFromLibrary = (item: any) => {
    if (!materials.find(m => m.url === item.url)) {
      setMaterials(prev => [...prev, { url: item.url, filename: item.filename, type: item.type, tags: item.tags }])
    }
  }

  const generateScript = async () => {
    if (!productInfo.title) { message.warning('请输入商品标题'); return }
    setScriptLoading(true)
    setErrorMsg('')
    try {
      const res = await axios.post(`${API_BASE}/api/script/generate`, {
        productInfo,
        materials: materials.map(m => m.url)
      })
      setScript(res.data.script)
      message.success('剧本生成成功')
    } catch (err: any) {
      const msg = err.response?.data?.error || '剧本生成失败'
      setErrorMsg(msg)
      message.error(msg)
    } finally {
      setScriptLoading(false)
    }
  }

  const refineScript = async () => {
    if (!script || !refinePrompt) return
    setRefineLoading(true)
    try {
      const tempProjectId = 'temp-' + Date.now()
      const res = await axios.post(`${API_BASE}/api/scripts/${tempProjectId}/refine`, {
        prompt: refinePrompt,
        currentScript: script
      })
      if (res.data.script) setScript(res.data.script)
      if (res.data.scenes) setScript(prev => prev ? { ...prev, scenes: res.data.scenes } : null)
      message.success('剧本精修完成')
      setRefinePrompt('')
    } catch (err: any) {
      message.error('精修失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setRefineLoading(false)
    }
  }

  const updateScene = (index: number, field: string, value: any) => {
    if (!script) return
    const newScenes = [...script.scenes]
    newScenes[index] = { ...newScenes[index], [field]: value }
    const total = newScenes.reduce((sum, s) => sum + (s.duration || 3), 0)
    setScript({ ...script, scenes: newScenes, totalDuration: total })
  }

  const deleteScene = (index: number) => {
    if (!script) return
    const newScenes = script.scenes.filter((_, i) => i !== index)
    const total = newScenes.reduce((sum, s) => sum + (s.duration || 3), 0)
    setScript({ ...script, scenes: newScenes, totalDuration: total })
  }

  const addScene = () => {
    if (!script) return
    const newScene: Scene = {
      id: script.scenes.length + 1,
      description: '新分镜描述',
      duration: 3,
      voiceover: '旁白文本',
      shot: '中景',
      emotion: '平静',
      transition: '淡入淡出'
    }
    const total = [...script.scenes, newScene].reduce((sum, s) => sum + (s.duration || 3), 0)
    setScript({ ...script, scenes: [...script.scenes, newScene], totalDuration: total })
  }

  const swapScenes = (indexA: number, indexB: number) => {
    if (!script) return
    if (indexA < 0 || indexA >= script.scenes.length || indexB < 0 || indexB >= script.scenes.length) return
    const newScenes = [...script.scenes]
    const temp = newScenes[indexA]
    newScenes[indexA] = newScenes[indexB]
    newScenes[indexB] = temp
    const total = newScenes.reduce((sum, s) => sum + (s.duration || 3), 0)
    setScript({ ...script, scenes: newScenes, totalDuration: total })
  }

  const fallbackSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => setPlayingSceneId(null)
      utterance.onerror = () => setPlayingSceneId(null)
      window.speechSynthesis.speak(utterance)
    } else {
      setPlayingSceneId(null)
      message.error('浏览器不支持语音合成播放')
    }
  }

  const handleAudition = async (sceneId: number, voiceoverText: string, voiceType: string) => {
    if (audioPlayer) {
      audioPlayer.pause()
      setAudioPlayer(null)
    }

    if (playingSceneId === sceneId) {
      setPlayingSceneId(null)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      return
    }

    setPlayingSceneId(sceneId)
    try {
      const res = await axios.post(`${API_BASE}/api/tts/generate`, {
        text: voiceoverText,
        options: { voice: voiceType }
      })
      if (res.data.success && res.data.audioUrl) {
        const audio = new Audio(res.data.audioUrl)
        audio.onended = () => setPlayingSceneId(null)
        audio.onerror = () => {
          message.warning('远程配音加载失败，自动升级为本地中国主播合成播放')
          fallbackSpeech(voiceoverText)
        }
        setAudioPlayer(audio)
        audio.play().catch(() => {
          fallbackSpeech(voiceoverText)
        })
      } else {
        throw new Error('TTS response invalid')
      }
    } catch (err) {
      console.warn('TTS request error, using fallback SpeechSynthesis:', err)
      fallbackSpeech(voiceoverText)
    }
  }

  const rerenderScene = async (index: number) => {
    if (!script) return
    const scene = script.scenes[index]
    const sceneId = scene.id

    setRenderingScenes(prev => ({
      ...prev,
      [sceneId]: { progress: 10, status: 'generating' }
    }))

    try {
      const firstImage = materials.find(m => typeof m.url === 'string' && !m.url.endsWith('.mp4'))?.url || ''

      const res = await axios.post(`${API_BASE}/api/video/generate`, {
        prompt: scene.description,
        imageUrl: firstImage,
        duration: scene.duration || 3,
        options: { resolution, ratio }
      })

      const taskId = res.data.taskId

      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE}/api/video/status/${taskId}`)
          const p = statusRes.data.progress || 0

          setRenderingScenes(prev => ({
            ...prev,
            [sceneId]: { progress: p, status: 'generating' }
          }))

          if (statusRes.data.status === 'succeeded' && statusRes.data.videoUrl) {
            clearInterval(interval)
            updateScene(index, 'videoUrl', statusRes.data.videoUrl)
            setRenderingScenes(prev => ({
              ...prev,
              [sceneId]: { progress: 100, status: 'completed' }
            }))
            message.success(`分镜 ${index + 1} 局部生成成功！`)
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval)
            setRenderingScenes(prev => ({
              ...prev,
              [sceneId]: { progress: 0, status: 'error', error: statusRes.data.error || '生成失败' }
            }))
            message.error(`分镜 ${index + 1} 渲染失败: ` + (statusRes.data.error || ''))
          }
        } catch (pollErr: any) {
          // ignore
        }
      }, 3000)
    } catch (err: any) {
      setRenderingScenes(prev => ({
        ...prev,
        [sceneId]: { progress: 0, status: 'error', error: err.response?.data?.error || err.message }
      }))
      message.error(`分镜 ${index + 1} 局部渲染启动失败: ` + (err.response?.data?.error || err.message))
    }
  }

  const generateVideo = async () => {
    if (!script) return
    setVideoStatus('generating')
    setVideoProgress(10)
    setErrorMsg('')
    setStatusText('正在启动视频生成...')

    try {
      if (generationMode === 'batch') {
        const res = await axios.post(`${API_BASE}/api/video/batch-generate`, {
          script, materials: materials.map(m => m.url),
          options: { resolution, ratio, transition, enableTTS }
        })
        const batchId = res.data.batchId
        setStatusText('批量生成任务已启动')

        try {
          const es = new EventSource(`${API_BASE}/api/tasks/${batchId}/stream`)
          es.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              setVideoProgress(data.progress || 0)
              if (data.message) setStatusText(data.message)
              if (data.status === 'completed' && data.videoUrl) {
                es.close(); setVideoUrl(data.videoUrl); setVideoProgress(100)
                setVideoStatus('completed'); setStatusText(''); message.success('视频生成成功！')
              } else if (data.status === 'failed') {
                es.close(); setErrorMsg(data.error || '生成失败'); setVideoStatus('error'); setStatusText('')
              }
            } catch { /* ignore parse errors */ }
          }
          es.onerror = () => { es.close(); pollBatchStatus(batchId) }
        } catch {
          pollBatchStatus(batchId)
        }
      } else {
        const res = await axios.post(`${API_BASE}/api/video/generate`, {
          script, materials: materials.map(m => m.url),
          options: { resolution, ratio }
        })
        const taskId = res.data.taskId
        setStatusText('视频生成中...')
        pollRef.current = setInterval(async () => {
          try {
            const sr = await axios.get(`${API_BASE}/api/video/status/${taskId}`)
            setVideoProgress(sr.data.progress || 0)
            if (sr.data.status === 'succeeded' && sr.data.videoUrl) {
              clearPoll(); setVideoUrl(sr.data.videoUrl); setVideoProgress(100)
              setVideoStatus('completed'); message.success('视频生成成功！')
            } else if (sr.data.status === 'failed') {
              clearPoll(); setErrorMsg(sr.data.error || '生成失败'); setVideoStatus('error'); setStatusText('')
            }
          } catch { /* ignore */ }
        }, 5000)
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || '视频生成失败')
      setVideoStatus('error'); setStatusText('')
    }
  }

  const pollBatchStatus = (batchId: string) => {
    batchPollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/video/batch-status/${batchId}`)
        setVideoProgress(res.data.progress || 0)
        if (res.data.message) setStatusText(res.data.message)
        if (res.data.status === 'completed' && res.data.videoUrl) {
          clearPoll(); setVideoUrl(res.data.videoUrl); setVideoProgress(100)
          setVideoStatus('completed'); setStatusText(''); message.success('视频生成成功！')
        } else if (res.data.status === 'failed') {
          clearPoll(); setErrorMsg(res.data.error || '生成失败'); setVideoStatus('error'); setStatusText('')
        }
      } catch { /* ignore */ }
    }, 3000)
  }

  const resetAll = () => {
    clearPoll()
    setMaterials([]); setAnalysisResult(null); setScript(null)
    setVideoUrl(''); setVideoStatus('idle'); setVideoProgress(0)
    setProductInfo({ title: '', sellingPoints: '', targetAudience: '' })
    setErrorMsg(''); setStatusText(''); setActiveModule('material')
  }

  const sendToScript = () => {
    if (materials.length > 0) setActiveModule('script')
  }

  const sendToCreation = () => {
    if (script) setActiveModule('creation')
  }

  const renderMaterialModule = () => (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: '#121214', borderRadius: 12, padding: 20,
          border: '1px solid #1f1f23', boxShadow: '0 4px 150px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <UploadOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>上传素材</span>
          </div>
          <div style={{
            border: '1px dashed #3f3f46',
            borderRadius: 8,
            background: '#18181b',
            overflow: 'hidden'
          }}>
            <Upload.Dragger
              beforeUpload={handleUpload}
              showUploadList={false}
              accept="image/*,video/*"
              multiple
              style={{ border: 'none', background: 'transparent' }}
            >
              <div style={{ padding: '20px 0' }}>
                <UploadOutlined style={{ fontSize: 32, color: '#6366f1', marginBottom: 8 }} />
                <div style={{ color: '#e4e4e7', fontSize: 14 }}>点击或拖拽上传素材</div>
                <div style={{ color: '#71717a', fontSize: 12, marginTop: 4 }}>支持图片和视频格式</div>
              </div>
            </Upload.Dragger>
          </div>
          <Button
            block
            icon={<AppstoreOutlined />}
            onClick={openLibrary}
            style={{ marginTop: 12, height: 40, borderRadius: 8, background: '#18181b', color: '#6366f1', border: '1px solid #3f3f46' }}
          >
            从素材库选择
          </Button>
        </div>

        {materials.length > 0 && (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 20,
            border: '1px solid #1f1f23', flex: 1, overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PictureOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>已选素材</span>
                <Tag color="blue" style={{ marginLeft: 4, background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8' }}>{materials.length}</Tag>
              </div>
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={sendToScript}
                style={{ borderRadius: 6, background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', border: 'none' }}
              >
                传入剧本模块 →
              </Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {materials.map((m, i) => (
                <div key={i} style={{
                  position: 'relative', borderRadius: 8, overflow: 'hidden',
                  border: '1px solid #27272a', background: '#18181b'
                }}>
                  {m.type?.startsWith('video') ? (
                    <div style={{
                      height: 100, background: '#09090b', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#818cf8' }} />
                    </div>
                  ) : (
                    <img src={m.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.filename || `素材${i + 1}`}
                  </div>
                  <Tooltip title="AI分析">
                    <Button
                      type="text" size="small"
                      icon={<BulbOutlined style={{ color: '#fbbf24' }} />}
                      onClick={() => analyzeMaterial(m.url)}
                      style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(24,24,27,0.85)', borderRadius: 4, minWidth: 24, width: 24, height: 24, padding: 0 }}
                    />
                  </Tooltip>
                  <Button
                    type="text" size="small" danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeMaterial(m.url)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(24,24,27,0.85)', borderRadius: 4, minWidth: 24, width: 24, height: 24, padding: 0 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        <div style={{
          background: '#121214', borderRadius: 12, padding: 20,
          border: '1px solid #1f1f23', flex: 1, overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BulbOutlined style={{ color: '#fbbf24', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>素材分析结果</span>
          </div>
          {analysisResult ? (
            <div style={{ fontSize: 13, lineHeight: 1.8, color: '#e4e4e7' }}>
              {analysisResult.productInfo && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: '#f4f4f5', marginBottom: 4 }}>商品信息</div>
                  <div style={{ color: '#a1a1aa', padding: 8, background: '#18181b', borderRadius: 6 }}>
                    <div>名称: {analysisResult.productInfo.title || '-'}</div>
                    <div style={{ marginTop: 4 }}>卖点: {analysisResult.productInfo.sellingPoints || '-'}</div>
                  </div>
                </div>
              )}
              {analysisResult.tags && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: '#f4f4f5', marginBottom: 6 }}>标签</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(Array.isArray(analysisResult.tags) ? analysisResult.tags : []).map((t: string, i: number) => (
                      <Tag key={i} color="purple" style={{ borderRadius: 4, background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc' }}>{t}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.slices && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: '#f4f4f5', marginBottom: 4 }}>切片</div>
                  <div style={{ color: '#818cf8', fontWeight: 600 }}>{analysisResult.slices.length} 个镜头切片已结构化</div>
                </div>
              )}
              <Button
                size="small" type="primary"
                style={{ marginTop: 12, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', border: 'none', width: '100%', height: 32 }}
                onClick={() => {
                  if (analysisResult.productInfo?.title) {
                    setProductInfo(prev => ({
                      ...prev,
                      title: analysisResult.productInfo.title || prev.title,
                      sellingPoints: analysisResult.productInfo.sellingPoints || prev.sellingPoints
                    }))
                    message.info('已将分析结果填入剧本模块')
                  }
                }}
              >
                填入剧本模块
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#71717a' }}>
              <BulbOutlined style={{ fontSize: 36, marginBottom: 12, color: '#3f3f46' }} />
              <div style={{ fontSize: 13 }}>点击素材上的灯泡图标<br />进行AI分析</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderScriptModule = () => (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        <div style={{
          background: '#121214', borderRadius: 12, padding: 20,
          border: '1px solid #1f1f23', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <EditOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>商品信息</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>
              商品标题 <span style={{ color: '#f43f5e' }}>*</span>
            </label>
            <Input
              placeholder="例如：2024新款轻薄羽绒服"
              value={productInfo.title}
              onChange={e => setProductInfo({ ...productInfo, title: e.target.value })}
              style={{ borderRadius: 8, background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>卖点描述</label>
            <TextArea
              rows={3}
              placeholder="每行一个卖点"
              value={productInfo.sellingPoints}
              onChange={e => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
              style={{ borderRadius: 8, background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>目标人群</label>
            <Input
              placeholder="例如：18-35岁都市女性"
              value={productInfo.targetAudience}
              onChange={e => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
              style={{ borderRadius: 8, background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a' }}
            />
          </div>

          {materials.length > 0 && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 8, fontSize: 12, color: '#818cf8' }}>
              已关联 {materials.length} 个素材
            </div>
          )}

          <Button
            block type="primary"
            icon={<ThunderboltOutlined />}
            onClick={generateScript}
            loading={scriptLoading}
            style={{ height: 44, borderRadius: 8, background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', border: 'none', fontWeight: 600, fontSize: 14 }}
          >
            AI 生成剧本
          </Button>
        </div>

        {script && (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 20,
            border: '1px solid #1f1f23', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <SwapOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
              <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>剧本干预</span>
            </div>
            <TextArea
              rows={3}
              placeholder="输入修改指令，如：让旁白更活泼、增加一个产品特写分镜..."
              value={refinePrompt}
              onChange={e => setRefinePrompt(e.target.value)}
              style={{ borderRadius: 8, marginBottom: 10, background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a' }}
            />
            <Button
              block size="small"
              type="primary"
              onClick={refineScript}
              loading={refineLoading}
              style={{ borderRadius: 6, background: '#8b5cf6', border: 'none' }}
            >
              精修剧本
            </Button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        {script ? (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 20,
            border: '1px solid #1f1f23', flex: 1, overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>《{script.title}》</span>
                <Tag color="purple" style={{ borderRadius: 4, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}>{script.scenes.length} 分镜</Tag>
                <Tag color="blue" style={{ borderRadius: 4, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}>{script.totalDuration}s</Tag>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" icon={<PlusOutlined />} onClick={addScene} style={{ borderRadius: 6, background: '#18181b', color: '#c084fc', border: '1px solid #3f3f46' }}>
                  添加分镜
                </Button>
                <Button
                  type="primary" size="small"
                  icon={<VideoCameraOutlined />}
                  onClick={sendToCreation}
                  style={{ borderRadius: 6, background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', border: 'none' }}
                >
                  传入创作模块 →
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              {script.scenes.map((scene, index) => {
                const renderState = renderingScenes[scene.id]
                const isRendering = renderState?.status === 'generating'
                const isPlaying = playingSceneId === scene.id

                return (
                  <div key={scene.id} style={{
                    background: '#18181b',
                    border: isRendering ? '1px solid #ec4899' : '1px solid #27272a',
                    borderRadius: 10, padding: 14,
                    transition: 'all 0.25s ease',
                    boxShadow: isRendering ? '0 0 15px rgba(236,72,153,0.15)' : 'none',
                    position: 'relative'
                  }}>
                    {/* Cinema sprocket top line decoration */}
                    <div style={{
                      height: 6,
                      borderRadius: '3px 3px 0 0',
                      marginBottom: 10,
                      background: 'repeating-linear-gradient(90deg, #27272a, #27272a 12px, transparent 12px, transparent 20px)'
                    }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 6, display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                          color: '#fff', fontSize: 12, fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(139,92,246,0.3)'
                        }}>{index + 1}</span>
                        <Tag style={{ borderRadius: 4, margin: 0, background: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7' }}>{scene.shot}</Tag>
                        {scene.emotion && <Tag color="volcano" style={{ borderRadius: 4, margin: 0, background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>{scene.emotion}</Tag>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Up and Down reordering controls */}
                        <Tooltip title="上移分镜">
                          <Button
                            type="text" size="small"
                            icon={<ArrowUpOutlined style={{ color: '#a1a1aa' }} />}
                            onClick={() => swapScenes(index, index - 1)}
                            disabled={index === 0}
                            style={{ minWidth: 24, width: 24, height: 24, padding: 0 }}
                          />
                        </Tooltip>
                        <Tooltip title="下移分镜">
                          <Button
                            type="text" size="small"
                            icon={<ArrowDownOutlined style={{ color: '#a1a1aa' }} />}
                            onClick={() => swapScenes(index, index + 1)}
                            disabled={index === script.scenes.length - 1}
                            style={{ minWidth: 24, width: 24, height: 24, padding: 0 }}
                          />
                        </Tooltip>

                        <Divider type="vertical" style={{ borderColor: '#3f3f46', margin: '0 4px' }} />

                        {/* Duration Input */}
                        <Input
                          type="number" value={scene.duration}
                          onChange={e => updateScene(index, 'duration', parseInt(e.target.value) || 3)}
                          style={{ width: 44, height: 24, fontSize: 12, borderRadius: 4, textAlign: 'center', background: '#09090b', color: '#f4f4f5', border: '1px solid #3f3f46', padding: '0 4px' }}
                        />
                        <span style={{ fontSize: 11, color: '#71717a' }}>秒</span>

                        <Divider type="vertical" style={{ borderColor: '#3f3f46', margin: '0 4px' }} />

                        {/* Delete Scene */}
                        <Tooltip title="删除分镜">
                          <Button
                            type="text" size="small" danger icon={<DeleteOutlined />}
                            onClick={() => deleteScene(index)}
                            style={{ minWidth: 24, width: 24, height: 24, padding: 0 }}
                          />
                        </Tooltip>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Visual Description */}
                        <div>
                          <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>画面描述</div>
                          <TextArea
                            value={scene.description}
                            rows={2}
                            onChange={e => updateScene(index, 'description', e.target.value)}
                            style={{ fontSize: 12, borderRadius: 6, background: '#09090b', color: '#e4e4e7', border: '1px solid #27272a' }}
                          />
                        </div>

                        {/* Voiceover & Audition */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <SoundOutlined /> 旁白配音
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Voice selector */}
                              <Select
                                size="small"
                                placeholder="选择配音主播"
                                value={scene.voice || 'zh-CN-XiaoxiaoNeural'}
                                onChange={val => updateScene(index, 'voice', val)}
                                dropdownStyle={{ background: '#121214', border: '1px solid #27272a' }}
                                style={{ width: 120, fontSize: 11 }}
                                options={VOICE_OPTIONS}
                              />
                              {/* Audition Button */}
                              <Button
                                size="small"
                                type="text"
                                style={{
                                  background: isPlaying ? 'rgba(236,72,153,0.15)' : 'rgba(139,92,246,0.15)',
                                  color: isPlaying ? '#ec4899' : '#a78bfa',
                                  fontSize: 11,
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                icon={isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
                                onClick={() => handleAudition(scene.id, scene.voiceover, scene.voice || 'zh-CN-XiaoxiaoNeural')}
                              >
                                {isPlaying ? '停止' : '试听'}
                              </Button>
                            </div>
                          </div>
                          <Input
                            value={scene.voiceover}
                            onChange={e => updateScene(index, 'voiceover', e.target.value)}
                            style={{ fontSize: 12, borderRadius: 6, background: '#09090b', color: '#a78bfa', border: '1px solid #27272a' }}
                          />
                        </div>
                      </div>

                      {/* Right column: Single scene local render and micro preview */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-start' }}>
                        <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center' }}>单镜局部渲染</div>

                        {scene.videoUrl ? (
                          <div style={{ position: 'relative', width: '100%', height: 100, borderRadius: 6, overflow: 'hidden', border: '2px solid #10b981', boxShadow: '0 0 8px rgba(16,185,129,0.3)' }}>
                            <video src={scene.videoUrl} muted autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.7)', padding: '1px 3px', borderRadius: 3, fontSize: 8, color: '#10b981' }}>
                              ✓ 就绪
                            </div>
                            {/* Hover overlay to rerender again */}
                            <div style={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer'
                            }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}
                              onClick={() => rerenderScene(index)}
                            >
                              <ReloadOutlined style={{ color: '#fff', fontSize: 16 }} />
                            </div>
                          </div>
                        ) : (
                          <Button
                            block
                            type="dashed"
                            disabled={isRendering}
                            style={{
                              height: 100,
                              borderRadius: 6,
                              background: isRendering ? '#121214' : '#09090b',
                              border: isRendering ? '1px solid #ec4899' : '1px dashed #3f3f46',
                              color: isRendering ? '#ec4899' : '#71717a',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                            onClick={() => rerenderScene(index)}
                          >
                            {isRendering ? (
                              <>
                                <LoadingOutlined style={{ fontSize: 18 }} />
                                <span style={{ fontSize: 10 }}>渲染 {renderState?.progress}%</span>
                              </>
                            ) : (
                              <>
                                <VideoCameraOutlined style={{ fontSize: 18, color: '#3f3f46' }} />
                                <span style={{ fontSize: 10 }}>生成此片段</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 40,
            border: '1px solid #1f1f23', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#71717a', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <FileTextOutlined style={{ fontSize: 48, marginBottom: 12, color: '#3f3f46' }} />
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: '#a1a1aa' }}>暂无剧本</div>
            <div style={{ fontSize: 13 }}>填写商品信息后点击「AI 生成剧本」</div>
          </div>
        )}

        {errorMsg && (
          <Alert message={errorMsg} type="error" showIcon closable onClose={() => setErrorMsg('')} style={{ borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }} />
        )}
      </div>
    </div>
  )

  const renderCreationModule = () => (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        <div style={{
          background: '#121214', borderRadius: 12, padding: 20,
          border: '1px solid #1f1f23', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <VideoCameraOutlined style={{ color: '#ec4899', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#f4f4f5' }}>生成设置</span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>生成模式</label>
            <Radio.Group value={generationMode} onChange={e => setGenerationMode(e.target.value)} style={{ width: '100%' }}>
              <Radio.Button value="batch" style={{ width: '50%', textAlign: 'center', background: generationMode === 'batch' ? 'linear-gradient(135deg, #ec4899, #f472b6)' : '#18181b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px 0 0 8px' }}>
                <ThunderboltOutlined /> 批量合成
              </Radio.Button>
              <Radio.Button value="single" style={{ width: '50%', textAlign: 'center', background: generationMode === 'single' ? 'linear-gradient(135deg, #ec4899, #f472b6)' : '#18181b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '0 8px 8px 0' }}>
                <PlayCircleOutlined /> 首帧预览
              </Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>分辨率</label>
            <Radio.Group value={resolution} onChange={e => setResolution(e.target.value)} size="small">
              <Radio.Button value="480p" style={{ background: resolution === '480p' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>480p</Radio.Button>
              <Radio.Button value="720p" style={{ background: resolution === '720p' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>720p</Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>画幅比例</label>
            <Radio.Group value={ratio} onChange={e => setRatio(e.target.value)} size="small">
              <Radio.Button value="9:16" style={{ background: ratio === '9:16' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>9:16</Radio.Button>
              <Radio.Button value="16:9" style={{ background: ratio === '16:9' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>16:9</Radio.Button>
              <Radio.Button value="1:1" style={{ background: ratio === '1:1' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>1:1</Radio.Button>
            </Radio.Group>
          </div>

          {generationMode === 'batch' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>转场效果</label>
                <Radio.Group value={transition} onChange={e => setTransition(e.target.value)} size="small">
                  <Radio.Button value="cut" style={{ background: transition === 'cut' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>切换</Radio.Button>
                  <Radio.Button value="fade" style={{ background: transition === 'fade' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>淡入</Radio.Button>
                  <Radio.Button value="dissolve" style={{ background: transition === 'dissolve' ? '#ec4899' : '#18181b', color: '#fff', border: '1px solid #3f3f46' }}>溶解</Radio.Button>
                </Radio.Group>
              </div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch checked={enableTTS} onChange={setEnableTTS} style={{ background: enableTTS ? '#ec4899' : '#3f3f46' }} />
                <span style={{ fontSize: 13, color: '#e4e4e7' }}>启用 TTS 旁白合成配音</span>
              </div>
            </>
          )}

          {script && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: 8, fontSize: 12, color: '#f472b6' }}>
              《{script.title}》· {script.scenes.length} 分镜 · {script.totalDuration}s
            </div>
          )}

          <Button
            block type="primary"
            icon={<VideoCameraOutlined />}
            onClick={generateVideo}
            disabled={!script || videoStatus === 'generating'}
            loading={videoStatus === 'generating'}
            style={{
              height: 48, borderRadius: 8, fontWeight: 600, fontSize: 15,
              background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(236,72,153,0.3)'
            }}
          >
            {videoStatus === 'generating' ? '生成中...' : generationMode === 'batch' ? '一键生成完整视频' : '渲染第一分镜视频'}
          </Button>
        </div>

        {videoStatus === 'generating' && (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 20,
            border: '1px solid #1f1f23', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#e4e4e7' }}>{statusText || '生成中...'}</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#ec4899' }}>{videoProgress}%</span>
            </div>
            <Progress
              percent={videoProgress}
              status="active"
              strokeColor={{ '0%': '#ec4899', '100%': '#f472b6' }}
              showInfo={false}
              style={{ marginBottom: 12 }}
            />
            <Button
              block danger size="small"
              onClick={() => { clearPoll(); setVideoStatus('idle'); setStatusText('') }}
              style={{ borderRadius: 6, background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}
            >
              取消生成
            </Button>
          </div>
        )}

        {errorMsg && (
          <Alert
            message="生成失败"
            description={errorMsg}
            type="error" showIcon
            action={<Button size="small" onClick={generateVideo} style={{ background: '#18181b', color: '#fff', border: '1px solid #3f3f46' }}><ReloadOutlined /> 重试</Button>}
            style={{ borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}
          />
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        {script && (
          <div style={{
            background: '#121214', borderRadius: 12, padding: 16,
            border: '1px solid #1f1f23', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ScissorOutlined style={{ color: '#ec4899', fontSize: 14 }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#f4f4f5' }}>分镜预览胶片轨道</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {script.scenes.map((scene, i) => (
                <Tooltip key={scene.id} title={`分镜${i + 1}: ${scene.voiceover?.slice(0, 20)}...`}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: scene.videoUrl
                      ? 'linear-gradient(135deg, #10b981, #34d399)'
                      : 'linear-gradient(135deg, #a78bfa, #c084fc)',
                    color: '#fff',
                    boxShadow: scene.videoUrl ? '0 2px 6px rgba(16,185,129,0.3)' : '0 2px 6px rgba(167,139,250,0.2)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.2s'
                  }}>
                    {scene.videoUrl ? '✓' : i + 1}
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: '#121214', borderRadius: 12, padding: 20,
          border: '1px solid #1f1f23', flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          minHeight: 380
        }}>
          {videoUrl ? (
            <div style={{ textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ marginBottom: 12, display: 'flex', gap: 6, justifyContent: 'center' }}>
                <Tag color="success" style={{ borderRadius: 4, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>{resolution}</Tag>
                <Tag color="processing" style={{ borderRadius: 4, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}>{ratio}</Tag>
                {enableTTS && generationMode === 'batch' && <Tag color="purple" style={{ borderRadius: 4, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#c084fc' }}>AI配音</Tag>}
              </div>

              {/* TikTok 3D Simulated Frame */}
              <div style={{
                position: 'relative',
                width: ratio === '16:9' ? 480 : 230,
                height: ratio === '16:9' ? 270 : 420,
                background: '#09090b',
                borderRadius: 24,
                padding: 6,
                border: '4px solid #3f3f46',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.1)',
                overflow: 'hidden'
              }}>
                {/* Camera Island */}
                {ratio !== '16:9' && (
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 60,
                    height: 14,
                    background: '#000',
                    borderRadius: 10,
                    zIndex: 100
                  }} />
                )}

                {/* Smartphone Video screen */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 18,
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#000'
                }}>
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: ratio === '16:9' ? 'contain' : 'cover'
                    }}
                  />

                  {/* TikTok watermark elements if 9:16 */}
                  {ratio === '9:16' && (
                    <>
                      <div style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 60,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        zIndex: 10,
                        alignItems: 'center'
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                          👤
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: 16 }}>❤️</span>
                          <span style={{ fontSize: 8, color: '#fff', marginTop: 1 }}>9.2w</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: 16 }}>💬</span>
                          <span style={{ fontSize: 8, color: '#fff', marginTop: 1 }}>1.5k</span>
                        </div>
                      </div>

                      <div style={{
                        position: 'absolute',
                        left: 10,
                        bottom: 10,
                        right: 40,
                        zIndex: 10,
                        color: '#fff',
                        textAlign: 'left'
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 10, display: 'block', marginBottom: 1 }}>
                          @{productInfo.title || '电商爆款'}
                        </span>
                        <span style={{ fontSize: 9, color: '#e4e4e7', display: 'block', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {script?.title} #AIGC智能带货 #火山方舟大模型
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <a href={videoUrl} download={`composed_${Date.now()}.mp4`}>
                  <Button type="primary" icon={<DownloadOutlined />} style={{ borderRadius: 8, background: '#ec4899', border: 'none', height: 38, fontWeight: 600 }}>
                    下载完整视频
                  </Button>
                </a>
                <Button onClick={resetAll} style={{ borderRadius: 8, background: '#18181b', color: '#a1a1aa', border: '1px solid #3f3f46', height: 38 }}>
                  重新创建
                </Button>
              </div>
            </div>
          ) : videoStatus !== 'generating' ? (
            <div style={{ color: '#71717a', textAlign: 'center' }}>
              <VideoCameraOutlined style={{ fontSize: 54, marginBottom: 16, color: '#3f3f46' }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#a1a1aa' }}>等待成片合成</div>
              <div style={{ fontSize: 13, color: '#52525b' }}>
                {script ? '调整上述画幅比例后点击生成按钮' : '请先在剧本模块中AI生成剧本'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const moduleRenderers: Record<ModuleKey, () => React.ReactNode> = {
    material: renderMaterialModule,
    script: renderScriptModule,
    creation: renderCreationModule
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#09090b', color: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{
        padding: '16px 24px 0',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f4f4f5' }}>
              视频创作工作台
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#71717a' }}>
              素材分析 → 剧本创作 → 视频生成，三控制舱智能协同
            </p>
          </div>
          <Button size="small" onClick={resetAll} style={{ borderRadius: 6, background: '#18181b', color: '#a1a1aa', border: '1px solid #3f3f46' }}>
            重置工作台
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
          {(Object.keys(MODULE_CONFIG) as ModuleKey[]).map((key, idx) => {
            const cfg = MODULE_CONFIG[key]
            const status = getModuleStatus(key)
            const isActive = activeModule === key
            return (
              <div
                key={key}
                onClick={() => setActiveModule(key)}
                style={{
                  flex: 1, cursor: 'pointer',
                  background: isActive ? cfg.gradient : '#121214',
                  border: isActive ? 'none' : '1px solid #1f1f23',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: isActive ? `0 0 24px ${cfg.color}33` : 'none',
                  transform: isActive ? 'translateY(-2px)' : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
                    pointerEvents: 'none'
                  }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(255,255,255,0.25)' : '#18181b',
                  color: isActive ? '#fff' : cfg.color,
                  fontSize: 18, flexShrink: 0,
                  transition: 'all 0.25s'
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15,
                    color: isActive ? '#fff' : '#e4e4e7',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    {cfg.label}
                    <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                      {statusIcon(status)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: isActive ? 'rgba(255,255,255,0.8)' : '#71717a',
                    marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {cfg.description}
                  </div>
                </div>
                {idx < 2 && (
                  <div style={{
                    position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                    color: isActive ? 'rgba(255,255,255,0.6)' : '#3f3f46',
                    fontSize: 14, zIndex: 1
                  }}>→</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{
        flex: 1, padding: '16px 24px 24px', overflow: 'hidden',
        minHeight: 0, display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          background: '#09090b', borderRadius: 16, padding: 0,
          height: '100%', border: 'none', display: 'flex', flexDirection: 'column'
        }}>
          {moduleRenderers[activeModule]()}
        </div>
      </div>

      <Modal
        title="从素材库选择"
        open={libraryVisible}
        onCancel={() => setLibraryVisible(false)}
        onOk={() => setLibraryVisible(false)}
        width={800}
        okText="确认"
        cancelText="取消"
        className="dark-modal"
        styles={{
          body: { background: '#121214', color: '#f4f4f5' },
          header: { background: '#121214', borderBottom: '1px solid #1f1f23' },
          content: { background: '#121214', border: '1px solid #1f1f23', padding: 24 }
        }}
      >
        <Input.Search
          placeholder="搜索素材"
          value={librarySearch}
          onChange={e => setLibrarySearch(e.target.value)}
          style={{ marginBottom: 16, background: '#18181b', color: '#fff', border: '1px solid #27272a' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, maxHeight: 400, overflow: 'auto' }}>
          {libraryItems
            .filter(item => !librarySearch || (item.filename || '').includes(librarySearch))
            .map((item, i) => {
              const selected = materials.some(m => m.url === item.url)
              return (
                <div
                  key={i}
                  onClick={() => selectFromLibrary(item)}
                  style={{
                    borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: selected ? '2px solid #6366f1' : '1px solid #27272a',
                    background: selected ? 'rgba(99, 102, 241, 0.1)' : '#18181b',
                    transition: 'all 0.2s'
                  }}
                >
                  {item.type?.startsWith('video') ? (
                    <div style={{ height: 100, background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#818cf8' }} />
                    </div>
                  ) : (
                    <img src={item.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.filename || `素材${i + 1}`}
                    {selected && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, padding: '0 4px', lineHeight: '16px', borderRadius: 3 }}>已选</Tag>}
                  </div>
                </div>
              )
            })}
        </div>
      </Modal>
    </div>
  )
}

export default VideoCreationPage
