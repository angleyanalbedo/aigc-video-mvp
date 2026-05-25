import { useState, useRef, useCallback } from 'react'
import {
  Upload, Input, Button, Tag, Progress, Alert, Radio, Switch, Modal,
  message, Tooltip
} from 'antd'
import {
  UploadOutlined, FileTextOutlined, VideoCameraOutlined,
  PictureOutlined, SoundOutlined, ThunderboltOutlined,
  EditOutlined, SwapOutlined, PlayCircleOutlined,
  CheckCircleFilled, ClockCircleFilled, MinusCircleFilled,
  DeleteOutlined, PlusOutlined, ReloadOutlined,
  AppstoreOutlined, ScissorOutlined, BulbOutlined
} from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname.includes('trae.cn')
  ? 'http://localhost:3001'
  : ''

const { TextArea } = Input

type ModuleKey = 'material' | 'script' | 'creation'
type TaskStatus = 'idle' | 'loading' | 'generating' | 'completed' | 'error'

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
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <UploadOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>上传素材</span>
          </div>
          <Upload.Dragger
            beforeUpload={handleUpload}
            showUploadList={false}
            accept="image/*,video/*"
            multiple
            style={{ borderRadius: 8 }}
          >
            <div style={{ padding: '20px 0' }}>
              <UploadOutlined style={{ fontSize: 32, color: '#6366f1', marginBottom: 8 }} />
              <div style={{ color: '#475569', fontSize: 14 }}>点击或拖拽上传素材</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>支持图片和视频格式</div>
            </div>
          </Upload.Dragger>
          <Button
            block
            icon={<AppstoreOutlined />}
            onClick={openLibrary}
            style={{ marginTop: 12, height: 40, borderRadius: 8 }}
          >
            从素材库选择
          </Button>
        </div>

        {materials.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0', flex: 1, overflow: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PictureOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>已选素材</span>
                <Tag color="blue" style={{ marginLeft: 4 }}>{materials.length}</Tag>
              </div>
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={sendToScript}
                style={{ borderRadius: 6, background: '#6366f1' }}
              >
                传入剧本模块 →
              </Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {materials.map((m, i) => (
                <div key={i} style={{
                  position: 'relative', borderRadius: 8, overflow: 'hidden',
                  border: '1px solid #e2e8f0', background: '#f8fafc'
                }}>
                  {m.type?.startsWith('video') ? (
                    <div style={{
                      height: 100, background: '#1e1b4b', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#a5b4fc' }} />
                    </div>
                  ) : (
                    <img src={m.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '4px 8px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.filename || `素材${i + 1}`}
                  </div>
                  <Tooltip title="AI分析">
                    <Button
                      type="text" size="small"
                      icon={<BulbOutlined />}
                      onClick={() => analyzeMaterial(m.url)}
                      style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(255,255,255,0.9)', borderRadius: 4, minWidth: 24, width: 24, height: 24, padding: 0 }}
                    />
                  </Tooltip>
                  <Button
                    type="text" size="small" danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeMaterial(m.url)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)', borderRadius: 4, minWidth: 24, width: 24, height: 24, padding: 0 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #e2e8f0', flex: 1, overflow: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BulbOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>素材分析结果</span>
          </div>
          {analysisResult ? (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              {analysisResult.productInfo && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>商品信息</div>
                  <div style={{ color: '#475569' }}>
                    <div>名称: {analysisResult.productInfo.title || '-'}</div>
                    <div>卖点: {analysisResult.productInfo.sellingPoints || '-'}</div>
                  </div>
                </div>
              )}
              {analysisResult.tags && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>标签</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(Array.isArray(analysisResult.tags) ? analysisResult.tags : []).map((t: string, i: number) => (
                      <Tag key={i} color="purple" style={{ borderRadius: 4 }}>{t}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.slices && (
                <div>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>切片</div>
                  <div style={{ color: '#64748b' }}>{analysisResult.slices.length} 个切片</div>
                </div>
              )}
              <Button
                size="small" type="primary"
                style={{ marginTop: 12, borderRadius: 6, background: '#6366f1' }}
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
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              <BulbOutlined style={{ fontSize: 32, marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>点击素材上的灯泡图标<br />进行AI分析</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderScriptModule = () => (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <EditOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>商品信息</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4, display: 'block' }}>
              商品标题 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Input
              placeholder="例如：2024新款轻薄羽绒服"
              value={productInfo.title}
              onChange={e => setProductInfo({ ...productInfo, title: e.target.value })}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4, display: 'block' }}>卖点描述</label>
            <TextArea
              rows={3}
              placeholder="每行一个卖点"
              value={productInfo.sellingPoints}
              onChange={e => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4, display: 'block' }}>目标人群</label>
            <Input
              placeholder="例如：18-35岁都市女性"
              value={productInfo.targetAudience}
              onChange={e => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
              style={{ borderRadius: 8 }}
            />
          </div>

          {materials.length > 0 && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0f0ff', borderRadius: 8, fontSize: 12, color: '#6366f1' }}>
              已关联 {materials.length} 个素材
            </div>
          )}

          <Button
            block type="primary"
            icon={<ThunderboltOutlined />}
            onClick={generateScript}
            loading={scriptLoading}
            style={{ height: 44, borderRadius: 8, background: '#8b5cf6', fontWeight: 600 }}
          >
            AI 生成剧本
          </Button>
        </div>

        {script && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <SwapOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>剧本干预</span>
            </div>
            <TextArea
              rows={3}
              placeholder="输入修改指令，如：让旁白更活泼、增加一个产品特写分镜..."
              value={refinePrompt}
              onChange={e => setRefinePrompt(e.target.value)}
              style={{ borderRadius: 8, marginBottom: 8 }}
            />
            <Button
              block size="small"
              type="primary"
              onClick={refineScript}
              loading={refineLoading}
              style={{ borderRadius: 6, background: '#8b5cf6' }}
            >
              精修剧本
            </Button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {script ? (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0', flex: 1, overflow: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>《{script.title}》</span>
                <Tag color="purple" style={{ borderRadius: 4 }}>{script.scenes.length} 分镜</Tag>
                <Tag color="blue" style={{ borderRadius: 4 }}>{script.totalDuration}s</Tag>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" icon={<PlusOutlined />} onClick={addScene} style={{ borderRadius: 6 }}>
                  添加分镜
                </Button>
                <Button
                  type="primary" size="small"
                  icon={<VideoCameraOutlined />}
                  onClick={sendToCreation}
                  style={{ borderRadius: 6, background: '#8b5cf6' }}
                >
                  传入创作模块 →
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {script.scenes.map((scene, index) => (
                <div key={scene.id} style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10, padding: 14,
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 6, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                        color: '#fff', fontSize: 12, fontWeight: 700
                      }}>{index + 1}</span>
                      <Tag style={{ borderRadius: 4, margin: 0 }}>{scene.shot}</Tag>
                      {scene.emotion && <Tag color="volcano" style={{ borderRadius: 4, margin: 0 }}>{scene.emotion}</Tag>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Input
                        type="number" value={scene.duration}
                        onChange={e => updateScene(index, 'duration', parseInt(e.target.value) || 3)}
                        style={{ width: 50, height: 24, fontSize: 12, borderRadius: 4, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>秒</span>
                      <Button
                        type="text" size="small" danger icon={<DeleteOutlined />}
                        onClick={() => deleteScene(index)}
                        style={{ marginLeft: 4, minWidth: 20, width: 20, height: 20, padding: 0 }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>画面</div>
                    <TextArea
                      value={scene.description}
                      rows={2}
                      onChange={e => updateScene(index, 'description', e.target.value)}
                      style={{ fontSize: 12, borderRadius: 6, background: '#fff' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b5cf6', marginBottom: 2 }}>
                      <SoundOutlined /> 旁白
                    </div>
                    <Input
                      value={scene.voiceover}
                      onChange={e => updateScene(index, 'voiceover', e.target.value)}
                      style={{ fontSize: 12, borderRadius: 6, background: '#fff', color: '#6366f1' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 40,
            border: '1px solid #e2e8f0', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8'
          }}>
            <FileTextOutlined style={{ fontSize: 48, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>暂无剧本</div>
            <div style={{ fontSize: 13 }}>填写商品信息后点击「AI 生成剧本」</div>
          </div>
        )}

        {errorMsg && (
          <Alert message={errorMsg} type="error" showIcon closable onClose={() => setErrorMsg('')} style={{ borderRadius: 8 }} />
        )}
      </div>
    </div>
  )

  const renderCreationModule = () => (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <VideoCameraOutlined style={{ color: '#ec4899', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>生成设置</span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>生成模式</label>
            <Radio.Group value={generationMode} onChange={e => setGenerationMode(e.target.value)} style={{ width: '100%' }}>
              <Radio.Button value="batch" style={{ width: '50%', textAlign: 'center', borderRadius: '8px 0 0 8px' }}>
                <ThunderboltOutlined /> 批量生成
              </Radio.Button>
              <Radio.Button value="single" style={{ width: '50%', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>
                <PlayCircleOutlined /> 单分镜
              </Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>分辨率</label>
            <Radio.Group value={resolution} onChange={e => setResolution(e.target.value)} size="small">
              <Radio.Button value="480p">480p</Radio.Button>
              <Radio.Button value="720p">720p</Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>画幅比例</label>
            <Radio.Group value={ratio} onChange={e => setRatio(e.target.value)} size="small">
              <Radio.Button value="9:16">9:16</Radio.Button>
              <Radio.Button value="16:9">16:9</Radio.Button>
              <Radio.Button value="1:1">1:1</Radio.Button>
            </Radio.Group>
          </div>

          {generationMode === 'batch' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>转场效果</label>
                <Radio.Group value={transition} onChange={e => setTransition(e.target.value)} size="small">
                  <Radio.Button value="cut">切换</Radio.Button>
                  <Radio.Button value="fade">淡入淡出</Radio.Button>
                  <Radio.Button value="dissolve">溶解</Radio.Button>
                </Radio.Group>
              </div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch checked={enableTTS} onChange={setEnableTTS} />
                <span style={{ fontSize: 13, color: '#475569' }}>启用 TTS 配音</span>
              </div>
            </>
          )}

          {script && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fdf4ff', borderRadius: 8, fontSize: 12, color: '#8b5cf6' }}>
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
              border: 'none'
            }}
          >
            {videoStatus === 'generating' ? '生成中...' : generationMode === 'batch' ? '一键生成完整视频' : '生成分镜视频'}
          </Button>
        </div>

        {videoStatus === 'generating' && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{statusText || '生成中...'}</span>
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
              style={{ borderRadius: 6 }}
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
            action={<Button size="small" onClick={generateVideo}><ReloadOutlined /> 重试</Button>}
            style={{ borderRadius: 8 }}
          />
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {script && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ScissorOutlined style={{ color: '#ec4899', fontSize: 14 }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>分镜预览</span>
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
                      : 'linear-gradient(135deg, #f0abfc, #e879f9)',
                    color: '#fff',
                    boxShadow: '0 2px 6px rgba(236,72,153,0.2)'
                  }}>
                    {scene.videoUrl ? '✓' : i + 1}
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #e2e8f0', flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          {videoUrl ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ marginBottom: 12, display: 'flex', gap: 6, justifyContent: 'center' }}>
                <Tag color="success" style={{ borderRadius: 4 }}>{resolution}</Tag>
                <Tag color="processing" style={{ borderRadius: 4 }}>{ratio}</Tag>
                {enableTTS && generationMode === 'batch' && <Tag color="purple" style={{ borderRadius: 4 }}>AI配音</Tag>}
              </div>
              <video
                src={videoUrl} controls autoPlay
                style={{
                  width: '100%', maxWidth: ratio === '9:16' ? 320 : 560,
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              />
              <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button type="primary" style={{ borderRadius: 8, background: '#ec4899', border: 'none' }}>
                  下载视频
                </Button>
                <Button onClick={resetAll} style={{ borderRadius: 8 }}>
                  创建新视频
                </Button>
              </div>
            </div>
          ) : videoStatus !== 'generating' ? (
            <div style={{ color: '#94a3b8' }}>
              <VideoCameraOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>等待生成</div>
              <div style={{ fontSize: 13 }}>
                {script ? '调整设置后点击生成按钮' : '请先在剧本模块中生成剧本'}
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 24px 0',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
              视频创作工作台
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              素材分析 → 剧本创作 → 视频生成，三模块协同创作
            </p>
          </div>
          <Button size="small" onClick={resetAll} style={{ borderRadius: 6 }}>
            重置
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
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
                  background: isActive ? cfg.gradient : '#fff',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: isActive ? `0 4px 16px ${cfg.color}33` : '0 1px 3px rgba(0,0,0,0.04)',
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
                  background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: isActive ? '#fff' : cfg.color,
                  fontSize: 18, flexShrink: 0,
                  transition: 'all 0.25s'
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15,
                    color: isActive ? '#fff' : '#334155',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    {cfg.label}
                    <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                      {statusIcon(status)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: isActive ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                    marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {cfg.description}
                  </div>
                </div>
                {idx < 2 && (
                  <div style={{
                    position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                    color: isActive ? 'rgba(255,255,255,0.6)' : '#cbd5e1',
                    fontSize: 14, zIndex: 1
                  }}>→</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{
        flex: 1, padding: '16px 24px 24px', overflow: 'auto',
        minHeight: 0
      }}>
        <div style={{
          background: '#f8fafc', borderRadius: 16, padding: 20,
          minHeight: '100%', border: '1px solid #f1f5f9'
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
      >
        <Input.Search
          placeholder="搜索素材"
          value={librarySearch}
          onChange={e => setLibrarySearch(e.target.value)}
          style={{ marginBottom: 16 }}
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
                    border: selected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    background: selected ? '#f0f0ff' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  {item.type?.startsWith('video') ? (
                    <div style={{ height: 100, background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#a5b4fc' }} />
                    </div>
                  ) : (
                    <img src={item.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
