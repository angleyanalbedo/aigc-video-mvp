import React, { useState, useEffect } from 'react';
import {
  AppstoreOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  UploadOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined
} from '@ant-design/icons';
import {
  Layout,
  Button,
  Input,
  Select,
  Switch,
  Upload,
  Form,
  Card,
  Collapse,
  Space,
  Progress,
  Alert,
  Modal,
  List,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Statistic,
  Popconfirm,
  message,
  Tooltip
} from 'antd';
import type { UploadFile } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Content, Sider } = Layout;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const API_BASE = import.meta.env.VITE_API_BASE || '';

const WorkbenchPage: React.FC = () => {
  const [form] = Form.useForm();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<UploadFile[]>([]);
  const [script, setScript] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);

  // 自动保存
  useEffect(() => {
    if (currentProjectId) {
      setSaveStatus('unsaved');
      const timer = setTimeout(() => {
        handleSave();
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [script, materials, currentProjectId]);

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      const data = await res.json();
      if (data.success) {
        setProjects(data.data.list || []);
      }
    } catch (e) {
      console.error('加载项目失败', e);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // 加载项目详情
  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentProjectId(id);
        const p = data.data;
        form.setFieldsValue({
          projectName: p.name,
          productName: p.product_info?.title || '',
          sellingPoints: p.product_info?.sellingPoints?.join('\n') || '',
          targetAudience: p.product_info?.targetAudience || '',
          resolution: p.settings?.resolution || '720p',
          ratio: p.settings?.ratio || '9:16',
          transition: p.settings?.transition || 'fade',
          enableTTS: p.settings?.enableTTS ?? true
        });
        if (p.script) setScript(p.script);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      }
    } catch (e) {
      console.error('加载项目详情失败', e);
    }
  };

  // 创建新项目
  const createProject = async (name = '未命名项目') => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        await loadProjects();
        await loadProject(data.data.id);
        message.success('项目创建成功');
      }
    } catch (e) {
      console.error('创建项目失败', e);
    }
  };

  // 保存项目
  const handleSave = async () => {
    if (!currentProjectId) return;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const values = await form.validateFields();
      const res = await fetch(`${API_BASE}/api/projects/${currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.projectName,
          productInfo: {
            title: values.productName,
            sellingPoints: values.sellingPoints?.split('\n').filter(Boolean),
            targetAudience: values.targetAudience
          },
          script,
          settings: {
            resolution: values.resolution,
            ratio: values.ratio,
            transition: values.transition,
            enableTTS: values.enableTTS
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        message.success('保存成功');
      }
    } catch (e) {
      console.error('保存失败', e);
    } finally {
      setIsSaving(false);
    }
  };

  // 生成剧本
  const handleGenerateScript = async () => {
    try {
      const values = await form.validateFields();
      setIsGenerating(true);
      setStatusMessage('正在生成剧本...');
      const res = await fetch(`${API_BASE}/api/script/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productInfo: {
            title: values.productName,
            sellingPoints: values.sellingPoints?.split('\n').filter(Boolean),
            targetAudience: values.targetAudience
          },
          materials: materials.map(m => m.url)
        })
      });
      const data = await res.json();
      if (data.success) {
        setScript(data.script);
        message.success('剧本生成成功');
      }
    } catch (e) {
      console.error('剧本生成失败', e);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  // 删除分镜
  const deleteScene = (index: number) => {
    if (!script) return;
    const newScenes = [...script.scenes];
    newScenes.splice(index, 1);
    setScript({ ...script, scenes: newScenes });
  };

  // 生成分镜轨道
  const getTracks = () => {
    if (!script || !script.scenes) return [];
    const tracks = [];
    let currentTrack = [];
    let currentDuration = 0;

    for (const scene of script.scenes) {
      const duration = scene.duration || 3;
      if (currentDuration + duration > 15 && currentTrack.length > 0) {
        tracks.push({
          id: tracks.length + 1,
          scenes: currentTrack,
          totalDuration: currentDuration
        });
        currentTrack = [];
        currentDuration = 0;
      }
      currentTrack.push(scene);
      currentDuration += duration;
    }

    if (currentTrack.length > 0) {
      tracks.push({
        id: tracks.length + 1,
        scenes: currentTrack,
        totalDuration: currentDuration
      });
    }
    return tracks;
  };

  // 一键生成视频
  const handleGenerateVideo = async () => {
    if (!script) {
      message.warning('请先生成剧本');
      return;
    }
    const values = await form.validateFields();
    setIsGenerating(true);
    setProgress(0);
    setStatusMessage('开始生成视频...');
    setVideoUrl(null);

    try {
      const res = await fetch(`${API_BASE}/api/video/batch-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          materials: materials.map(m => m.url),
          options: {
            resolution: values.resolution,
            ratio: values.ratio,
            transition: values.transition
          }
        })
      });
      const data = await res.json();
      if (data.batchId) {
        const taskId = data.batchId;
        // 使用 SSE
        const es = new EventSource(`${API_BASE}/api/tasks/${taskId}/stream`);
        es.onmessage = (event) => {
          const task = JSON.parse(event.data);
          setProgress(task.progress || 0);
          if (task.message) setStatusMessage(task.message);
          if (task.videoUrl) {
            setVideoUrl(task.videoUrl);
          }
          if (task.status === 'completed' || task.status === 'failed') {
            es.close();
            setIsGenerating(false);
            if (task.status === 'failed') {
              message.error(task.error || '生成失败');
            } else {
              message.success('生成成功');
            }
          }
        };
        es.onerror = () => {
          es.close();
          setIsGenerating(false);
          message.error('连接失败，请重试');
        };
      }
    } catch (e) {
      console.error('生成失败', e);
      setIsGenerating(false);
    }
  };

  // 上传素材
  const handleUpload = async (info: any) => {
    if (info.file.status === 'done') {
      const fileUrl = info.file.response.url || info.file.response.data?.url;
      const newMaterial = {
        uid: info.file.uid,
        name: info.file.name,
        status: 'done',
        url: fileUrl
      };
      setMaterials([...materials, newMaterial]);
      message.success('上传成功');
    }
  };

  // 从素材库选择
  const handleLoadMaterials = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/materials`);
      
      if (!res.ok) {
        throw new Error(`服务器错误: ${res.status}`);
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('服务器返回了非 JSON 响应');
      }
      
      const data = await res.json();
      if (data.success) {
        setAvailableMaterials(data.data || []);
        setShowMaterialModal(true);
      } else {
        message.error(data.error || '加载素材失败');
      }
    } catch (e: any) {
      console.error('加载素材失败:', e);
      message.error('无法连接到服务器，请确保后端服务已启动');
      setAvailableMaterials([]);
      setShowMaterialModal(true);
    } finally {
      setLoading(false);
    }
  };

  const selectMaterial = (mat: any) => {
    const newMaterial = {
      uid: mat.id,
      name: mat.filename,
      status: 'done',
      url: mat.url
    };
    setMaterials([...materials, newMaterial]);
    setShowMaterialModal(false);
  };

  return (
    <div className="content-area" style={{ padding: '24px' }}>
      {/* 顶部工具栏 */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Form form={form} style={{ display: 'inline-flex', gap: 8 }}>
              <Form.Item name="projectName" noStyle>
                <Input style={{ width: 300, fontSize: 18, fontWeight: 600 }} placeholder="项目名称" />
              </Form.Item>
              <Form.Item name="projectSelect" noStyle>
                <Select
                  style={{ width: 200 }}
                  placeholder="切换项目"
                  options={projects.map(p => ({ label: p.name, value: p.id }))}
                  onChange={loadProject}
                  allowClear
                />
              </Form.Item>
            </Form>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isSaving}
              onClick={handleSave}
            >
              {saveStatus === 'saving' ? '保存中' : '保存'}
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => createProject()}
            >
              新建项目
            </Button>
          </Space>
        </Col>
        <Col>
          <Text type="secondary">
            {saveStatus === 'saved' && lastSavedAt && (
              <>✅ 已保存，最近保存于 {lastSavedAt.toLocaleTimeString()}</>
            )}
            {saveStatus === 'unsaved' && '⚠️ 有未保存的修改'}
            {saveStatus === 'saving' && '⏳ 正在保存...'}
          </Text>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 左边 - 主要编辑区域 */}
        <Col span={16}>
          <Card style={{ marginBottom: 16 }}>
            <Collapse defaultActiveKey={['materials', 'script', 'storyboard']}>
              {/* 素材管理 */}
              <Panel header="📁 素材管理" key="materials">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload.Dragger
                    name="file"
                    action={`${API_BASE}/api/upload`}
                    listType="picture"
                    fileList={materials}
                    onChange={handleUpload}
                    customRequest={async ({ file, onSuccess }) => {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch(`${API_BASE}/api/upload`, {
                        method: 'POST',
                        body: formData
                      });
                      const data = await res.json();
                      onSuccess(data);
                    }}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽上传素材</p>
                    <p className="ant-upload-hint">支持图片和视频</p>
                  </Upload.Dragger>
                  <Button onClick={handleLoadMaterials}>从素材库选择</Button>
                  {materials.length > 0 && (
                    <List
                      grid={{ gutter: 16, column: 4 }}
                      dataSource={materials}
                      renderItem={item => (
                        <List.Item>
                          <Card
                            hoverable
                            cover={
                              item.url ? (
                                <img
                                  alt={item.name}
                                  src={item.url}
                                  style={{ height: 120, objectFit: 'cover' }}
                                />
                              ) : null
                            }
                            actions={[
                              <Popconfirm
                                title="确定删除?"
                                onConfirm={() => setMaterials(materials.filter(m => m.uid !== item.uid))}
                              >
                                <DeleteOutlined key="delete" />
                              </Popconfirm>
                            ]}
                          >
                            <Card.Meta title={item.name} />
                          </Card>
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              </Panel>

              {/* 剧本编辑 */}
              <Panel header="📝 剧本生成" key="script">
                <Form form={form} layout="vertical">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="productName" label="商品名称">
                        <Input placeholder="输入商品名称" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="targetAudience" label="目标人群">
                        <Input placeholder="例如：18-25岁女性" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="sellingPoints" label="卖点（每行一个）">
                    <TextArea rows={4} placeholder="卖点1\n卖点2\n..." />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      onClick={handleGenerateScript}
                      loading={isGenerating && !videoUrl}
                      icon={<PlayCircleOutlined />}
                    >
                      生成剧本
                    </Button>
                  </Form.Item>
                </Form>
                {script && (
                  <div style={{ marginTop: 16 }}>
                    <Title level={4}>{script.title}</Title>
                    <Paragraph>{script.description}</Paragraph>
                    <Title level={5}>分镜列表</Title>
                    {script.scenes?.map((scene: any, index: number) => (
                      <Card
                        key={index}
                        style={{ marginBottom: 12 }}
                        actions={[
                          <Popconfirm title="确定删除这个分镜?" onConfirm={() => deleteScene(index)}>
                            <DeleteOutlined key="delete" />
                          </Popconfirm>
                        ]}
                      >
                        <Row gutter={16}>
                          <Col span={2}><Tag color="blue">分镜 {index + 1}</Tag></Col>
                          <Col span={5}>
                            <Text strong>镜头:</Text> {scene.shot_type || '中景'}
                          </Col>
                          <Col span={5}>
                            <Text strong>时长:</Text> {scene.duration || 3}秒
                          </Col>
                          <Col span={5}>
                            <Text strong>画面:</Text> {scene.description?.substring(0, 50)}...
                          </Col>
                          <Col span={7}>
                            <Text strong>旁白:</Text> {scene.voiceover?.substring(0, 50)}...
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                )}
              </Panel>

              {/* 分镜轨道 */}
              <Panel header="🎬 分镜轨道" key="storyboard">
                {getTracks().map(track => (
                  <Card
                    key={track.id}
                    title={`轨道 ${track.id}（${track.totalDuration}秒）`}
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={8}>
                      {track.scenes.map((scene: any, idx: number) => (
                        <Col key={idx}>
                          <Tag color="cyan" style={{ padding: 8, fontSize: 14 }}>
                            {scene.duration || 3}秒
                          </Tag>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                ))}
              </Panel>
            </Collapse>
          </Card>
        </Col>

        {/* 右边 - 视频生成和预览 */}
        <Col span={8}>
          <Card title="🎥 视频生成" style={{ marginBottom: 24 }}>
            <Form form={form} layout="vertical">
              <Form.Item label="分辨率" name="resolution" initialValue="720p">
                <Select>
                  <Option value="480p">480p</Option>
                  <Option value="720p">720p</Option>
                </Select>
              </Form.Item>
              <Form.Item label="画幅" name="ratio" initialValue="9:16">
                <Select>
                  <Option value="9:16">9:16 (竖屏)</Option>
                  <Option value="16:9">16:9 (横屏)</Option>
                  <Option value="1:1">1:1 (方形)</Option>
                </Select>
              </Form.Item>
              <Form.Item label="转场" name="transition" initialValue="fade">
                <Select>
                  <Option value="fade">淡入淡出</Option>
                  <Option value="cut">硬切</Option>
                </Select>
              </Form.Item>
              <Form.Item name="enableTTS" valuePropName="checked" label="启用TTS配音" initialValue={true}>
                <Switch />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handleGenerateVideo}
                  loading={isGenerating}
                  icon={<PlayCircleOutlined />}
                  disabled={!script}
                >
                  一键生成视频
                </Button>
              </Form.Item>
            </Form>

            {isGenerating && (
              <div style={{ marginBottom: 24 }}>
                <Progress percent={progress} status="active" />
                {statusMessage && <Text type="secondary">{statusMessage}</Text>}
              </div>
            )}

            {videoUrl && (
              <div>
                <Divider>生成完成</Divider>
                <video src={videoUrl} controls style={{ width: '100%' }} />
                <div style={{ marginTop: 16 }}>
                  <Button
                    type="primary"
                    onClick={() => window.open(videoUrl, '_blank')}
                  >
                    下载视频
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 素材库 Modal */}
      <Modal
        title="从素材库选择"
        open={showMaterialModal}
        onCancel={() => setShowMaterialModal(false)}
        footer={null}
      >
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={availableMaterials}
          renderItem={item => (
            <List.Item>
              <Card
                hoverable
                onClick={() => selectMaterial(item)}
                cover={
                  <img
                    alt={item.filename}
                    src={item.url}
                    style={{ height: 100, objectFit: 'cover' }}
                  />
                }
              >
                <Card.Meta title={item.filename} />
              </Card>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default WorkbenchPage;
