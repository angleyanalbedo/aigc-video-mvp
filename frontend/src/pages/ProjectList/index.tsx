import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  CalendarOutlined,
  RobotOutlined
} from '@ant-design/icons';
import {
  Card,
  Row,
  Col,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Popconfirm,
  Modal,
  Form,
  message,
  List,
  Statistic,
  Empty,
  Tooltip
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form] = Form.useForm();

  // 加载项目列表
  const loadProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/api/projects?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProjects(data.data.list || []);
      }
    } catch (e) {
      console.error('加载项目失败', e);
    } finally {
      setLoading(false);
    }
  };

  // 加载素材列表（用于项目绑定）
  const loadMaterials = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/materials`);
      const data = await res.json();
      if (data.success) {
        setMaterials(data.data || []);
      }
    } catch (e) {
      console.error('加载素材失败', e);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      loadMaterials();
    }
  }, [showCreateModal]);

  useEffect(() => {
    const timer = setTimeout(() => loadProjects(), 300);
    return () => clearTimeout(timer);
  }, [keyword, statusFilter]);

  // 创建项目
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (data.success) {
        message.success('项目创建成功');
        setShowCreateModal(false);
        form.resetFields();
        await loadProjects();
      }
    } catch (e) {
      console.error('创建项目失败', e);
    }
  };

  // 删除项目
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        await loadProjects();
      }
    } catch (e) {
      console.error('删除失败', e);
    }
  };

  // 复制项目
  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/duplicate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        message.success('复制成功');
        await loadProjects();
      }
    } catch (e) {
      console.error('复制失败', e);
    }
  };

  // 打开项目
  const openProject = (id: string) => {
    navigate(`/workbench/${id}`);
  };

  // 打开 Copilot AI 助手
  const openCopilot = (id: string) => {
    navigate(`/copilot/${id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'processing': return 'processing';
      case 'completed': return 'success';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿';
      case 'processing': return '生成中';
      case 'completed': return '已完成';
      case 'archived': return '已归档';
      default: return status;
    }
  };

  return (
    <div className="content-area" style={{ padding: 24 }}>
      <Row align="middle" justify="space-between" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>📁 项目管理</Title>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="搜索项目名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 250 }}
              prefix={<FileTextOutlined />}
            />
            <Select
              placeholder="状态筛选"
              style={{ width: 150 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="draft">草稿</Option>
              <Option value="processing">生成中</Option>
              <Option value="completed">已完成</Option>
              <Option value="archived">已归档</Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
            >
              新建项目
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {projects.length > 0 ? (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
              dataSource={projects}
              loading={loading}
              renderItem={project => (
                <List.Item key={project.id}>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 160,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                        onClick={() => openProject(project.id)}
                      >
                        <FolderOutlined style={{ fontSize: 48, opacity: 0.8 }} />
                      </div>
                    }
                    actions={[
                      <Tooltip title="Copilot AI 助手" key="copilot">
                        <RobotOutlined onClick={() => openCopilot(project.id)} />
                      </Tooltip>,
                      <EditOutlined key="edit" onClick={() => openProject(project.id)} />,
                      <CopyOutlined key="copy" onClick={() => handleDuplicate(project.id)} />,
                      <Popconfirm
                        title="确定删除这个项目?"
                        onConfirm={() => handleDelete(project.id)}
                      >
                        <DeleteOutlined key="delete" />
                      </Popconfirm>
                    ]}
                  >
                    <div onClick={() => openProject(project.id)} style={{ cursor: 'pointer' }}>
                      <Card.Meta
                        title={project.name}
                        description={
                          <>
                            <Tag color={getStatusColor(project.status)} style={{ marginBottom: 8 }}>
                              {getStatusText(project.status)}
                            </Tag>
                            <br />
                            <Text type="secondary" ellipsis>
                              {project.description || '暂无描述'}
                            </Text>
                            <br /><br />
                            <Space direction="vertical" size="small" style={{ fontSize: 12 }}>
                              <Text type="secondary">
                                <CalendarOutlined /> 创建于 {new Date(project.createdAt).toLocaleDateString()}
                              </Text>
                              <br />
                              <Text type="secondary">
                                更新于 {new Date(project.updatedAt).toLocaleDateString()}
                              </Text>
                            </Space>
                          </>
                        }
                      />
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无项目"
            >
              <Button type="primary" onClick={() => setShowCreateModal(true)}>
                创建第一个项目
              </Button>
            </Empty>
          )}
        </Col>
      </Row>

      {/* 创建项目 Modal */}
      <Modal
        title="新建项目"
        open={showCreateModal}
        onOk={handleCreate}
        onCancel={() => { setShowCreateModal(false); form.resetFields(); }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea placeholder="简单描述这个项目" rows={2} />
          </Form.Item>
          <Form.Item name="materialIds" label="关联商品素材 (可多选)">
            <Select
              mode="multiple"
              placeholder="选择已分析的商品图片/视频素材"
              allowClear
              optionLabelProp="label"
              style={{ width: '100%' }}
            >
              {materials.map((m) => (
                <Option key={m.id} value={m.id} label={m.filename}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    {m.type && m.type.startsWith('image') ? (
                      <img src={m.url} alt={m.filename} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, backgroundColor: '#eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>🎥</div>
                    )}
                    <div style={{ lineHeight: '1.2' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{m.filename}</div>
                      <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 2 }}>
                        {m.tags && Array.isArray(m.tags) ? m.tags.slice(0, 3).join(', ') : (m.tags || '暂无标签')}
                      </div>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectListPage;
