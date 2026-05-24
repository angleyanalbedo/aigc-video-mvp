import { useState, useEffect } from 'react';
import { Card, Table, Button, Progress, Row, Col, Tag, Space, message, Modal, Form, Input, InputNumber, Alert, Descriptions, Empty, Spin } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  createdAt: number;
}

interface VariantResult {
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  improvement: number;
  pValue: string;
  isSignificant: boolean;
}

interface ExperimentResults {
  conclusion: string;
  recommendation: string;
  variantResults: Record<string, VariantResult>;
}

const ABTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments`);
      const data = await response.json();
      if (data.success) {
        setExperiments(data.experiments);
      }
    } catch (error) {
      console.error('加载实验失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExperimentResults = async (experimentId: string) => {
    setResultsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/results`);
      const data = await response.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('加载结果失败:', error);
      message.error('加载结果失败');
    } finally {
      setResultsLoading(false);
    }
  };

  const handleCreateExperiment = async (values: Record<string, unknown>) => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          variants: [
            { id: 'control', name: '对照组', description: '现有方案', weight: 34, isControl: true },
            { id: 'variant_a', name: '变体A', description: values.variantADescription || '方案A', weight: 33, isControl: false },
            { id: 'variant_b', name: '变体B', description: values.variantBDescription || '方案B', weight: 33, isControl: false },
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

  const handleChangeStatus = async (experimentId: string, action: 'start' | 'pause' | 'end') => {
    try {
      const response = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        const actionText: Record<string, string> = { start: '启动', pause: '暂停', end: '结束' };
        message.success(`实验${actionText[action]}成功`);
        loadExperiments();
        if (selectedExperiment && selectedExperiment.id === experimentId) {
          loadExperimentResults(experimentId);
        }
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleViewResults = (record: Experiment) => {
    setSelectedExperiment(record);
    loadExperimentResults(record.id);
  };

  const handleCloseResults = () => {
    setSelectedExperiment(null);
    setResults(null);
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      draft: { color: 'default', text: '草稿', icon: null },
      running: { color: 'processing', text: '运行中', icon: <PlayCircleOutlined /> },
      paused: { color: 'warning', text: '暂停', icon: <PauseCircleOutlined /> },
      completed: { color: 'success', text: '完成', icon: <CheckCircleOutlined /> },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const columns = [
    { title: '实验名称', dataIndex: 'name', key: 'name', render: (text: string, record: Experiment) => (
      <a onClick={() => handleViewResults(record)}>{text}</a>
    )},
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: getStatusTag },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (date: number) => date ? new Date(date).toLocaleString() : '-' },
    { title: '操作', key: 'actions', width: 260, render: (_: unknown, record: Experiment) => (
      <Space size="small">
        {record.status === 'draft' && (
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleChangeStatus(record.id, 'start')}>启动</Button>
        )}
        {record.status === 'running' && (
          <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleChangeStatus(record.id, 'pause')}>暂停</Button>
        )}
        {record.status === 'paused' && (
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleChangeStatus(record.id, 'start')}>继续</Button>
        )}
        {(record.status === 'running' || record.status === 'paused') && (
          <Button size="small" danger onClick={() => handleChangeStatus(record.id, 'end')}>结束</Button>
        )}
        {(record.status === 'running' || record.status === 'paused' || record.status === 'completed') && (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewResults(record)}>结果</Button>
        )}
      </Space>
    )},
  ];

  const renderVariantCard = (variantId: string, variantResult: VariantResult) => {
    const isControl = variantId === 'control';
    return (
      <Card
        type="inner"
        title={
          <Space>
            <span>{variantResult.variantName}</span>
            {isControl ? <Tag>基准</Tag> : null}
            {variantResult.isSignificant && !isControl ? <Tag color="green">胜出</Tag> : null}
          </Space>
        }
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="样本量">{variantResult.impressions?.toLocaleString() ?? 0}</Descriptions.Item>
          <Descriptions.Item label="转化量">{variantResult.conversions?.toLocaleString() ?? 0}</Descriptions.Item>
          <Descriptions.Item label="转化率">
            <Space>
              <span>{variantResult.conversionRate?.toFixed(2) ?? 0}%</span>
              <Progress
                percent={variantResult.conversionRate ?? 0}
                size="small"
                style={{ width: 120 }}
                format={(val) => `${val?.toFixed(1)}%`}
              />
            </Space>
          </Descriptions.Item>
          {!isControl && (
            <>
              <Descriptions.Item label="相比对照组">
                <span style={{
                  color: variantResult.improvement > 0 ? '#52c41a' : variantResult.improvement < 0 ? '#ff4d4f' : '#666',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>
                  {variantResult.improvement > 0 ? '↑' : variantResult.improvement < 0 ? '↓' : '→'}
                  {' '}{Math.abs(variantResult.improvement)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="P值">
                {variantResult.pValue}
                {variantResult.pValue !== '-' && (
                  <span style={{ color: '#999', marginLeft: 4 }}>
                    {parseFloat(variantResult.pValue) < 0.05 ? '(< 0.05)' : '(≥ 0.05)'}
                  </span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="统计显著性">
                {variantResult.isSignificant
                  ? <Tag color="success">显著 ✓</Tag>
                  : <Tag color="default">不显著</Tag>}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>
    );
  };

  return (
    <div className="content-area">
      <div className="page-title">🧪 A/B 测试</div>
      <div className="page-subtitle">创建对比实验，用数据判断哪个方案效果更好</div>

      <Card
        title="📊 实验列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建实验
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={experiments}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无实验，点击「创建实验」开始" /> }}
        />
      </Card>

      {selectedExperiment && (
        <Card
          title={`📈 实验结果：${selectedExperiment.name}`}
          style={{ marginTop: 16 }}
          extra={<Button onClick={handleCloseResults}>关闭</Button>}
        >
          <Spin spinning={resultsLoading}>
            {results ? (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  {results.variantResults && Object.entries(results.variantResults).map(([variantId, variantResult]) => (
                    <Col key={variantId} span={8}>
                      {renderVariantCard(variantId, variantResult)}
                    </Col>
                  ))}
                </Row>

                <Card type="inner" title="🎯 实验结论">
                  <Alert
                    message={results.conclusion || '暂无结论'}
                    type={
                      results.recommendation === 'variant_a' || results.recommendation === 'variant_b'
                        ? 'success'
                        : 'info'
                    }
                    description={
                      results.recommendation === 'variant_a' || results.recommendation === 'variant_b'
                        ? `建议采用「${results.variantResults?.[results.recommendation]?.variantName || results.recommendation}」方案`
                        : '当前数据不足以得出明确结论，建议继续收集数据或调整实验策略'
                    }
                    showIcon
                  />
                </Card>
              </>
            ) : (
              <Empty description="暂无结果数据" />
            )}
          </Spin>
        </Card>
      )}

      <Modal
        title="创建 A/B 实验"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreateExperiment}>
          <Form.Item name="name" label="实验名称" rules={[{ required: true, message: '请输入实验名称' }]}>
            <Input placeholder="例如：视频封面样式对比" />
          </Form.Item>
          <Form.Item name="description" label="实验描述">
            <TextArea rows={3} placeholder="描述你要验证什么假设，例如：新封面是否能提升点击率" />
          </Form.Item>
          <Form.Item name="variantADescription" label="变体A描述">
            <Input placeholder="例如：使用大字标题封面" />
          </Form.Item>
          <Form.Item name="variantBDescription" label="变体B描述">
            <Input placeholder="例如：使用人物特写封面" />
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
