import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, message, Modal, Form, Input, Select, Progress, Descriptions, Row, Col, Statistic, Timeline } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, AuditOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const CompliancePage = () => {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadReviews();
    loadStats();
  }, []);

  const loadReviews = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/reviews`);
      const data = await response.json();
      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('加载审核失败:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleCreateReview = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (data.success) {
        message.success('审核任务创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadReviews();
        loadStats();
      }
    } catch (error) {
      console.error('创建失败:', error);
      message.error('创建失败');
    }
  };

  const handleFullReview = async (reviewId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/compliance/reviews/${reviewId}/full-review`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success('完整审核完成');
        loadReviews();
        loadStats();
        if (selectedReview?.id === reviewId) {
          setSelectedReview(data.review);
        }
      }
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reviewId) => {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/reviews/${reviewId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'admin', notes: '人工审核通过' }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('审核通过');
        loadReviews();
        loadStats();
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleReject = async (reviewId) => {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/reviews/${reviewId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'admin', notes: '人工审核拒绝' }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('审核拒绝');
        loadReviews();
        loadStats();
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: 'blue', text: '待审核', icon: <ClockCircleOutlined /> },
      reviewing: { color: 'processing', text: '审核中', icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: '已通过', icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: '已拒绝', icon: <CloseCircleOutlined /> },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '标题', dataIndex: 'title', key: 'title', render: (text, record) => (
      <a onClick={() => { setSelectedReview(record); setDetailModalVisible(true); }}>{text}</a>
    )},
    { title: '类型', dataIndex: 'type', key: 'type', render: (type) => <Tag color="blue">{type}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (date) => new Date(date).toLocaleString() },
    { title: '操作', key: 'actions', render: (_, record) => (
      <Space size="small">
        {record.status === 'pending' && (
          <Button type="text" size="small" onClick={() => handleFullReview(record.id)} loading={loading}>执行审核</Button>
        )}
        {record.status === 'pending' && (
          <>
            <Button type="text" size="small" onClick={() => handleApprove(record.id)}>通过</Button>
            <Button type="text" size="small" danger onClick={() => handleReject(record.id)}>拒绝</Button>
          </>
        )}
      </Space>
    )},
  ];

  return (
    <div className="content-area">
      <div className="page-title">✅ 合规审核</div>
      <div className="page-subtitle">内容审核、版权校验与合规管理</div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总审核数" value={stats.total} prefix={<AuditOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="📋 审核任务列表" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>新建审核</Button>}>
        <Table columns={columns} dataSource={reviews} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="审核详情" visible={detailModalVisible} onCancel={() => setDetailModalVisible(false)} footer={null} width={700}>
        {selectedReview && (
          <div>
            <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="ID">{selectedReview.id}</Descriptions.Item>
              <Descriptions.Item label="标题">{selectedReview.title}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedReview.description}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedReview.type}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedReview.status)}</Descriptions.Item>
              <Descriptions.Item label="创建者">{selectedReview.creator}</Descriptions.Item>
            </Descriptions>

            {selectedReview.checkResults && (
              <Card title="审核结果" type="inner" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>内容合规：</strong>
                    {selectedReview.checkResults.compliance.passed ? <Tag color="success">通过</Tag> : <Tag color="error">未通过</Tag>}
                    {selectedReview.checkResults.compliance.message && ` - ${selectedReview.checkResults.compliance.message}`}
                  </div>
                  <div>
                    <strong>版权校验：</strong>
                    {selectedReview.checkResults.copyright.passed ? <Tag color="success">通过</Tag> : <Tag color="error">未通过</Tag>}
                    {selectedReview.checkResults.copyright.message && ` - ${selectedReview.checkResults.copyright.message}`}
                  </div>
                </Space>
              </Card>
            )}

            {selectedReview.history && selectedReview.history.length > 0 && (
              <Card title="审核历史" type="inner">
                <Timeline>
                  {selectedReview.history.map((item, index) => (
                    <Timeline.Item key={index}>
                      <div>{item.action} - {new Date(item.timestamp).toLocaleString()}</div>
                      {item.notes && <div style={{ color: '#666' }}>{item.notes}</div>}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            <Space style={{ marginTop: 16 }}>
              {selectedReview.status === 'pending' && (
                <>
                  <Button type="primary" onClick={() => { handleFullReview(selectedReview.id); }}>执行自动审核</Button>
                  <Button type="primary" ghost onClick={() => { handleApprove(selectedReview.id); }}>人工通过</Button>
                  <Button danger onClick={() => { handleReject(selectedReview.id); }}>人工拒绝</Button>
                </>
              )}
            </Space>
          </div>
        )}
      </Modal>

      <Modal title="创建审核任务" visible={createModalVisible} onCancel={() => setCreateModalVisible(false)} onOk={() => form.submit()} width={500}>
        <Form form={form} layout="vertical" onFinish={handleCreateReview}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="请输入内容标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入内容描述" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select placeholder="请选择内容类型">
              <Option value="video">视频</Option>
              <Option value="image">图片</Option>
              <Option value="script">脚本</Option>
              <Option value="audio">音频</Option>
            </Select>
          </Form.Item>
          <Form.Item name="creator" label="创建者" initialValue="admin">
            <Input placeholder="创建者名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CompliancePage;
