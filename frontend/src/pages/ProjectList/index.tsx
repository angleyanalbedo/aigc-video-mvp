import React, { useState, useEffect } from 'react';
import {
  FolderOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  CalendarOutlined
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
  Empty
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_BASE || '';

const ProjectListPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
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

  useEffect(() => {
    loadProjects();
  }, []);

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
    window.location.hash = `/workbench/${id}`;
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
                    onClick={() => openProject(project.id)}
                    cover={
                      <div
                        style={{
                          height: 160,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white'
                        }}
                      >
                        <FolderOutlined style={{ fontSize: 48, opacity: 0.8 }} />
                      </div>
                    }
                    actions={[
                      <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); openProject(project.id); }} />,
                      <CopyOutlined key="copy" onClick={(e) => { e.stopPropagation(); handleDuplicate(project.id); }} />,
                      <Popconfirm
                        title="确定删除这个项目?"
                        onConfirm={() => handleDelete(project.id)}
                      >
                        <DeleteOutlined key="delete" />
                      </Popconfirm>
                    ]}
                  >
                    <Card.Meta
                      title={project.name}
                      description={
                        <>
                          <Tag color={getStatusColor(project.status)} style={{ marginBottom: 8 }}>
                            {getStatusText(project.status)}
                          </Tag>
                          <br />
                          <Text type="secondary" ellipsis={{ rows: 2 }}>
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
            <Input.TextArea placeholder="简单描述这个项目" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectListPage;
