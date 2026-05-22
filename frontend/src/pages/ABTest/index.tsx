import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Progress, Statistic, Row, Col, Tag, Space, message, Modal, Form, Input, Select, InputNumber, Alert } from 'antd';
import { ExperimentOutlined, BarChartOutlined, PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const ABTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [results, setResults] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments`);
      const data = await response.json();
      if (data.success) {
        setExperiments(data.experiments);
      }
    } catch (error) {
      console.error('加载实验失败:', error);
    }
  };

  const loadExperimentResults = async (experimentId) => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/results`);
      const data = await response.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('加载结果失败:', error);
    }
  };

  const handleCreateExperiment = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          variants: [
            { id: 'control', name: '对照组', description: '现有方案' },
            { id: 'variant_a', name: '变体A', description: values.variantADescription },
            { id: 'variant_b', name: '变体B', description: values.variantBDescription },
          ],
        }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('实验创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadExperiments();
      }
    } catch (error) {
      console.error('创建实验失败:', error);
      message.error('创建实验失败');
    }
  };

  const handleChangeStatus = async (experimentId, action) => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success(`实验${action === 'start' ? '启动' : action === 'pause' ? '暂停' : '结束'}成功`);
        loadExperiments();
        if (selectedExperiment) {
          loadExperimentResults(experimentId);
        }
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      draft: { color: 'default', text: '草稿', icon: null },
      running: { color: 'processing', text: '运行中', icon: <PlayCircleOutlined /> },
      paused: { color: 'warning', text: '暂停', icon: <PauseCircleOutlined /> },
      completed: { color: 'success', text: '完成', icon: <CheckCircleOutlined /> },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '实验名称', dataIndex: 'name', key: 'name', render: (text, record) => (
      <a onClick={() => { setSelectedExperiment(record); loadExperimentResults(record.id); }}>{text}</a>
    )},
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (date) => new Date(date).toLocaleString() },
    { title: '操作', key: 'actions', render: (_, record) => (
      <Space size="small">
        {record.status === 'draft' && (
          <Button type="text" size="small" onClick={() => handleChangeStatus(record.id, 'start')}>启动</Button>
        )}
        {record.status === 'running' && (
          <Button type="text" size="small" onClick={() => handleChangeStatus(record.id, 'pause')}>暂停</Button>
        )}
        {record.status === 'paused' && (
          <Button type="text" size="small" onClick={() => handleChangeStatus(record.id, 'start')}>继续</Button>
        )}
        {(record.status === 'running' || record.status === 'paused') && (
          <Button type="text" size="small" onClick={() => handleChangeStatus(record.id, 'end')}>结束</Button>
        )}
      </Space>
    )},
  ];

  return (
    <div className="content-area">
      <div className="page-title">🧪 A/B 测试</div>
      <div className="page-subtitle">数据驱动的 A/B 实验与优化</div>

      <Card title="📊 实验管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>创建实验</Button>}>
        <Table columns={columns} dataSource={experiments} rowKey="id" />
      </Card>

      {selectedExperiment && results && (
        <Card title={`📈 实验结果：${selectedExperiment.name}`} style={{ marginTop: 16 }} extra={<Button onClick={() => { setSelectedExperiment(null); setResults(null); }}>关闭</Button>}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {Object.entries(results.variantResults).map(([variantId, variantResult]) => (
              <Col key={variantId} span={8}>
                <Card type="inner" title={`${variantResult.variantName} (${variantId})`} style={{ marginBottom: 16 }}>
                  <Descriptions column={1}>
                    <Descriptions.Item label="样本量">{variantResult.impressions}</Descriptions.Item>
                    <Descriptions.Item label="转化量">{variantResult.conversions}</Descriptions.Item>
                    <Descriptions.Item label="转化率">
                      <Progress percent={variantResult.conversionRate} />
                    </Descriptions.Item>
                    {variantId !== 'control' && (
                      <>
                        <Descriptions.Item label="改进率">
                          <span style={{ color: variantResult.improvement > 0 ? '#52c41a' : variantResult.improvement < 0 ? '#ff4d4f' : '#666' }}>
                            {variantResult.improvement > 0 ? '+' : ''}{variantResult.improvement}%
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="P值">{variantResult.pValue}</Descriptions.Item>
                        <Descriptions.Item label="显著性">
                          {variantResult.isSignificant ? <Tag color="success">显著</Tag> : <Tag color="default">不显著</Tag>}
                        </Descriptions.Item>
                      </>
                    )}
                  </Descriptions>
                </Card>
              </Col>
            ))}
          </Row>

          <Card type="inner" title="🎯 实验结论">
            <Alert
              message={results.conclusion}
              type={results.recommendation === 'variant_a' || results.recommendation === 'variant_b' ? 'success' : 'info'}
              description={results.recommendation}
              showIcon
            />
          </Card>
        </Card>
      )}

      <Modal title="创建 A/B 实验" visible={createModalVisible} onCancel={() => setCreateModalVisible(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreateExperiment}>
          <Form.Item name="name" label="实验名称" rules={[{ required: true }]}>
            <Input placeholder="请输入实验名称" />
          </Form.Item>
          <Form.Item name="description" label="实验描述">
            <TextArea rows={3} placeholder="请输入实验描述" />
          </Form.Item>
          <Form.Item name="variantADescription" label="变体A描述">
            <Input placeholder="变体A的描述" />
          </Form.Item>
          <Form.Item name="variantBDescription" label="变体B描述">
            <Input placeholder="变体B的描述" />
          </Form.Item>
          <Form.Item name="sampleSize" label="目标样本量" initialValue={1000}>
            <InputNumber min={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ABTestPage;
