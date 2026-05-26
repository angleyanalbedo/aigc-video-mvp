import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Row, Col, Tag, Space, message, Modal, Form, Input, Select, InputNumber,
  Alert, Empty, Spin, Divider, Typography, Popconfirm, Statistic
} from 'antd';
import {
  PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined, PlusOutlined, EyeOutlined,
  ThunderboltOutlined, RocketOutlined, DeleteOutlined, SyncOutlined, ExperimentOutlined,
  AudioOutlined, VideoCameraOutlined, PictureOutlined, AppstoreOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_BASE || '';

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  bgm: <AudioOutlined />,
  voice: <AudioOutlined />,
  ratio: <VideoCameraOutlined />,
  resolution: <VideoCameraOutlined />,
  transition: <AppstoreOutlined />,
  promptStyle: <PictureOutlined />,
};

interface Experiment {
  id: string;
  name: string;
  description: string;
  projectId: string;
  projectName?: string;
  testDimension: string;
  dimensionLabel: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: Variant[];
  sampleSize: number;
  createdAt: number;
  startTime: number | null;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  weight: number;
  isControl: boolean;
  settings: Record<string, string>;
}

interface VariantData {
  status: 'pending' | 'generating' | 'generated' | 'published';
  videoUrl: string | null;
  publishedAt: number | null;
  metrics: VariantMetrics | null;
}

interface VariantMetrics {
  views: number;
  conversions: number;
  conversionRate: number;
  completionRate: number;
  clickThroughRate: number;
}

interface ExperimentResults {
  experimentId: string;
  name: string;
  status: string;
  testDimension: string;
  dimensionLabel: string;
  variantResults: Record<string, VariantResult>;
  conclusion: string;
  recommendation: string;
}

interface VariantResult {
  variantName: string;
  status: string;
  videoUrl: string | null;
  impressions: number;
  conversions: number;
  conversionRate: number;
  completionRate: number;
  clickThroughRate: number;
  improvement: number;
  pValue: string;
  isSignificant: boolean;
}

const ABTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [dimensions, setDimensions] = useState<Record<string, any>>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [variantDataMap, setVariantDataMap] = useState<Record<string, VariantData>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadExperiments();
    loadDimensions();
    loadProjects();
  }, []);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments`);
      const data = await res.json();
      if (data.success) {
        const expList: Experiment[] = await Promise.all((data.experiments || []).map(async (exp: Experiment) => {
          if (exp.projectId) {
            try {
              const pRes = await fetch(`${API_BASE}/api/projects/${exp.projectId}`);
              const pData = await pRes.json();
              if (pData.success) {
                exp.projectName = pData.project.name;
              }
            } catch {}
          }
          return exp;
        }));
        setExperiments(expList);
      }
    } catch (e) {
      console.error('加载实验失败', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDimensions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/dimensions`);
      const data = await res.json();
      if (data.success) setDimensions(data.dimensions);
    } catch (e) {
      console.error('加载维度失败', e);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/projects`);
      const data = await res.json();
      if (data.success) setProjects(data.projects || []);
    } catch (e) {
      console.error('加载项目失败', e);
    }
  };

  const loadExperimentDetail = async (experimentId: string) => {
    setDetailLoading(true);
    try {
      const [expRes, resultsRes] = await Promise.all([
        fetch(`${API_BASE}/api/abtest/experiments/${experimentId}`),
        fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/results`),
      ]);
      const expData = await expRes.json();
      const resultsData = await resultsRes.json();
      if (expData.success) {
        setSelectedExperiment(expData.experiment);
        setVariantDataMap(expData.variantData || {});
      }
      if (resultsData.success) setResults(resultsData.results);
    } catch (e) {
      console.error('加载实验详情失败', e);
      message.error('加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateExperiment = async (values: Record<string, any>) => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success('实验创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadExperiments();
      } else {
        message.error(data.error || '创建失败');
      }
    } catch (e) {
      message.error('创建失败');
    }
  };

  const handleStatusChange = async (experimentId: string, action: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const texts: Record<string, string> = { start: '启动', pause: '暂停', end: '结束' };
        message.success(`实验${texts[action]}成功`);
        loadExperiments();
        if (selectedExperiment?.id === experimentId) loadExperimentDetail(experimentId);
      } else {
        message.error(data.error || '操作失败');
      }
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDeleteExperiment = async (experimentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        message.success('实验已删除');
        if (selectedExperiment?.id === experimentId) {
          setSelectedExperiment(null);
          setResults(null);
          setVariantDataMap({});
        }
        loadExperiments();
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleGenerateVariant = async (experimentId: string, variantId: string, variantName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/variants/${variantId}/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        message.loading({ content: `${variantName} 视频生成中...`, key: 'gen' });
        const mockUrl = `https://example.com/abtest/${experimentId}/${variantId}.mp4`;
        setTimeout(async () => {
          try {
            await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/variants/${variantId}/generate-complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl: mockUrl }),
            });
            message.success({ content: `${variantName} 视频生成完成`, key: 'gen' });
            loadExperimentDetail(experimentId);
          } catch {}
        }, 3000);
        loadExperimentDetail(experimentId);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch (e) {
      message.error('生成失败');
    }
  };

  const handlePublishVariant = async (experimentId: string, variantId: string, variantName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/abtest/experiments/${experimentId}/variants/${variantId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        message.success({ content: `${variantName} 发布成功，数据已收集`, key: 'pub' });
        loadExperimentDetail(experimentId);
      } else {
        message.error(data.error || '发布失败');
      }
    } catch (e) {
      message.error('发布失败');
    }
  };

  const getVariantStatusTag = (variantId: string) => {
    const data = variantDataMap[variantId];
    if (!data) return <Tag>未开始</Tag>;
    switch (data.status) {
      case 'generating': return <Tag color="processing" icon={<SyncOutlined spin />}>生成中</Tag>;
      case 'generated': return <Tag color="blue">待发布</Tag>;
      case 'published': return <Tag color="success" icon={<CheckCircleOutlined />}>已发布</Tag>;
      default: return <Tag>待生成</Tag>;
    }
  };

  const renderVariantRow = (variant: Variant, experimentId: string) => {
    const data = variantDataMap[variant.id];
    const isControl = variant.isControl || variant.id === 'control';
    const result = results?.variantResults?.[variant.id];

    return (
      <Card
        key={variant.id}
        size="small"
        style={{ marginBottom: 12, border: variant.id === 'control' ? '1px solid #d9d9d9' : '1px solid #1890ff' }}
        title={
          <Space>
            <span style={{ fontWeight: 'bold' }}>{variant.name}</span>
            {isControl && <Tag>基准</Tag>}
            {getVariantStatusTag(variant.id)}
          </Space>
        }
        extra={
          <Space>
            {!data || data.status === 'pending' ? (
              <Button
                type="primary"
                size="small"
                icon={<ThunderboltOutlined />}
                disabled={selectedExperiment?.status !== 'running'}
                onClick={() => handleGenerateVariant(experimentId, variant.id, variant.name)}
              >
                生成视频
              </Button>
            ) : data.status === 'generating' ? (
              <Button size="small" icon={<SyncOutlined spin />}>生成中...</Button>
            ) : data.status === 'generated' ? (
              <Button
                type="primary"
                size="small"
                icon={<RocketOutlined />}
                onClick={() => handlePublishVariant(experimentId, variant.id, variant.name)}
              >
                发布
              </Button>
            ) : data.status === 'published' ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
            ) : null}
          </Space>
        }
      >
        <Row gutter={12}>
          <Col span={8}>
            <Text type="secondary">参数设置</Text>
            <div style={{ marginTop: 4 }}>
              {Object.entries(variant.settings || {}).map(([k, v]) => (
                <Tag key={k} icon={DIMENSION_ICONS[k]}>{v}</Tag>
              ))}
            </div>
            {variant.description && <div style={{ marginTop: 4 }}><Text type="secondary">{variant.description}</Text></div>}
          </Col>
          {result && data?.status === 'published' ? (
            <>
              <Col span={4}>
                <Statistic
                  title="播放量"
                  value={result.impressions}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="转化率"
                  value={result.conversionRate}
                  suffix="%"
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              {!isControl && (
                <>
                  <Col span={4}>
                    <Statistic
                      title="提升"
                      value={result.improvement}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        fontSize: 16,
                        color: result.improvement > 0 ? '#52c41a' : result.improvement < 0 ? '#ff4d4f' : '#666'
                      }}
                      prefix={result.improvement > 0 ? '↑' : result.improvement < 0 ? '↓' : '→'}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="P值"
                      value={result.pValue}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </>
              )}
            </>
          ) : (
            <Col span={12}>
              <Text type="secondary">
                {data?.status === 'generated' ? '视频已生成，点击"发布"收集数据' : '点击"生成视频"开始'}
              </Text>
            </Col>
          )}
        </Row>
      </Card>
    );
  };

  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Experiment) => (
        <a onClick={() => { setSelectedExperiment(record); loadExperimentDetail(record.id); }}>
          <Space>
            <ExperimentOutlined />
            {text}
          </Space>
        </a>
      ),
    },
    {
      title: '测试维度',
      dataIndex: 'dimensionLabel',
      key: 'dimensionLabel',
      width: 120,
      render: (label: string, record: Experiment) => (
        <Tag icon={DIMENSION_ICONS[record.testDimension]}>{label}</Tag>
      ),
    },
    {
      title: '关联项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 160,
      render: (name: string) => name || <Text type="secondary">未关联</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: '草稿' },
          running: { color: 'processing', text: '运行中' },
          paused: { color: 'warning', text: '暂停' },
          completed: { color: 'success', text: '已完成' },
        };
        const c = cfg[status] || cfg.draft;
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    {
      title: '变体数',
      dataIndex: 'variants',
      key: 'variants',
      width: 80,
      render: (variants: Variant[]) => variants?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (t: number) => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Experiment) => (
        <Space size="small">
          {record.status === 'draft' && (
            <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(record.id, 'start')}>启动</Button>
          )}
          {record.status === 'running' && (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleStatusChange(record.id, 'pause')}>暂停</Button>
          )}
          {record.status === 'paused' && (
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(record.id, 'start')}>继续</Button>
          )}
          {(record.status === 'running' || record.status === 'paused') && (
            <Button size="small" danger onClick={() => handleStatusChange(record.id, 'end')}>结束</Button>
          )}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedExperiment(record); loadExperimentDetail(record.id); }}>详情</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteExperiment(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="content-area">
      <div className="page-title">🧪 A/B 测试</div>
      <div className="page-subtitle">选择视频参数维度，对比不同方案的实际效果，用数据驱动优化决策</div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Statistic title="总实验数" value={experiments.length} /></Col>
        <Col span={6}><Statistic title="运行中" value={experiments.filter(e => e.status === 'running').length} valueStyle={{ color: '#1890ff' }} /></Col>
        <Col span={6}><Statistic title="已完成" value={experiments.filter(e => e.status === 'completed').length} valueStyle={{ color: '#52c41a' }} /></Col>
        <Col span={6}><Statistic title="草稿" value={experiments.filter(e => e.status === 'draft').length} /></Col>
      </Row>

      <Card
        title="📊 实验列表"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>创建实验</Button>}
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
          title={`📈 实验详情：${selectedExperiment.name}`}
          style={{ marginTop: 16 }}
          extra={<Button onClick={() => { setSelectedExperiment(null); setResults(null); setVariantDataMap({}); }}>关闭</Button>}
        >
          <Spin spinning={detailLoading}>
            <Alert
              message={`测试维度：${selectedExperiment.dimensionLabel}`}
              description={`关联项目：${selectedExperiment.projectName || '无'}｜状态：${selectedExperiment.status === 'running' ? '运行中' : selectedExperiment.status === 'completed' ? '已完成' : '草稿'}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {results?.conclusion && (
              <Alert
                message="实验结论"
                description={results.conclusion}
                type={results.recommendation !== 'control' ? 'success' : 'info'}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider orientation="left">变体配置</Divider>
            {selectedExperiment.variants.map(v => renderVariantRow(v, selectedExperiment.id))}

            {results && results.variantResults && (
              <>
                <Divider orientation="left">数据对比</Divider>
                <Table
                  size="small"
                  dataSource={Object.entries(results.variantResults).map(([id, r]) => ({ key: id, ...r }))}
                  columns={[
                    { title: '变体', dataIndex: 'variantName', key: 'variantName' },
                    { title: '播放量', dataIndex: 'impressions', key: 'impressions', render: (v: number) => v.toLocaleString() },
                    { title: '转化量', dataIndex: 'conversions', key: 'conversions', render: (v: number) => v.toLocaleString() },
                    { title: '转化率', dataIndex: 'conversionRate', key: 'conversionRate', render: (v: number) => `${v.toFixed(2)}%` },
                    { title: '改进率', dataIndex: 'improvement', key: 'improvement', render: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
                    { title: 'P值', dataIndex: 'pValue', key: 'pValue' },
                    {
                      title: '显著性',
                      dataIndex: 'isSignificant',
                      key: 'isSignificant',
                      render: (v: boolean) => v ? <Tag color="success">显著 ✓</Tag> : <Tag>不显著</Tag>
                    },
                    { title: '完播率', dataIndex: 'completionRate', key: 'completionRate', render: (v: number) => `${v}%` },
                    { title: '点击率', dataIndex: 'clickThroughRate', key: 'clickThroughRate', render: (v: number) => `${v.toFixed(2)}%` },
                  ]}
                  pagination={false}
                />
              </>
            )}
          </Spin>
        </Card>
      )}

      <Modal
        title="🧪 创建 A/B 实验"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateExperiment}>
          <Form.Item name="name" label="实验名称" rules={[{ required: true, message: '请输入实验名称' }]}>
            <Input placeholder="例如：背景音乐对比实验" />
          </Form.Item>

          <Form.Item name="description" label="实验描述">
            <TextArea rows={2} placeholder="描述实验目的" />
          </Form.Item>

          <Form.Item name="projectId" label="关联项目" rules={[{ required: true, message: '请选择一个项目' }]}>
            <Select
              placeholder="选择一个已有项目进行A/B测试"
              showSearch
              optionFilterProp="label"
              options={projects.map(p => ({ value: p.id, label: `${p.name} (${p.sceneCount}个分镜)` }))}
            />
          </Form.Item>

          <Form.Item name="testDimension" label="测试维度" rules={[{ required: true, message: '请选择测试维度' }]}>
            <Select
              placeholder="选择要对比的参数维度"
              options={Object.entries(dimensions).map(([key, cfg]: [string, any]) => ({
                value: key,
                label: (
                  <Space>
                    {DIMENSION_ICONS[key]}
                    {cfg.label}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item name="sampleSize" label="目标样本量" initialValue={1000}>
            <InputNumber min={100} style={{ width: '100%' }} />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建实验</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ABTestPage;
