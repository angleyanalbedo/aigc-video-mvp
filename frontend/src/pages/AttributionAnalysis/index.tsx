import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Statistic, Row, Col, Progress, Descriptions, Space, Tag, Select, message, Spin } from 'antd';
import { BarChartOutlined, RiseOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';

const { Option } = Select;

const API_BASE = '';

const AttributionAnalysisPage = () => {
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [videos, setVideos] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    loadFactors();
    loadVideos();
  }, []);

  const loadFactors = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/attribution/factors`);
      const data = await response.json();
      if (data.success) {
        setFactors(data.factors);
      }
    } catch (error) {
      console.error('加载因子失败:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/attribution/videos?limit=50`);
      const data = await response.json();
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('加载视频失败:', error);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/attribution/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: selectedProduct }),
      });
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
        message.success('归因分析完成');
      }
    } catch (error) {
      console.error('分析失败:', error);
      message.error('分析失败');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
    if (value < 0) return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
    return null;
  };

  const factorColumns = [
    {
      title: '因子名称',
      dataIndex: 'factorName',
      key: 'factorName',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '样本量',
      dataIndex: 'count',
      key: 'count',
    },
    {
      title: '平均播放量',
      dataIndex: 'avgViews',
      key: 'avgViews',
      render: (num) => num.toLocaleString(),
    },
    {
      title: '完播率',
      dataIndex: 'avgCompletionRate',
      key: 'avgCompletionRate',
      render: (rate) => (
        <Progress percent={Math.round(rate * 100)} size="small" />
      ),
    },
    {
      title: '转化率',
      dataIndex: 'avgConversionRate',
      key: 'avgConversionRate',
      render: (rate) => (
        <Progress percent={Math.round(rate * 100)} size="small" status="active" />
      ),
    },
  ];

  const videoColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
    },
    {
      title: '播放量',
      dataIndex: 'views',
      key: 'views',
      render: (num) => num.toLocaleString(),
    },
    {
      title: '完播率',
      dataIndex: 'completionRate',
      key: 'completionRate',
      render: (rate) => <Tag color="blue">{Math.round(rate * 100)}%</Tag>,
    },
    {
      title: '转化率',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      render: (rate) => <Tag color="green">{Math.round(rate * 100)}%</Tag>,
    },
    {
      title: '视频长度',
      dataIndex: 'videoLength',
      key: 'videoLength',
      render: (len) => `${len}s`,
    },
  ];

  const productNames = [...new Set(videos.map(v => v.productName))];

  return (
    <div className="content-area">
      <div className="page-title">📊 多因子归因分析</div>
      <div className="page-subtitle">分析各视频要素对转化的影响，优化视频策略</div>

      <Card title="🔍 归因分析" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择产品"
            style={{ width: 200 }}
            value={selectedProduct}
            onChange={setSelectedProduct}
          >
            {productNames.map(name => (
              <Option key={name} value={name}>{name}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<BarChartOutlined />} onClick={handleAnalyze} loading={loading}>执行分析</Button>
          <Button icon={<ReloadOutlined />} onClick={loadVideos}>刷新数据</Button>
        </Space>
      </Card>

      {analysis && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="分析样本量" value={analysis.sampleSize} prefix={<RiseOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="最佳播放因子" value={analysis.topViewsFactor} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="最佳完播因子" value={analysis.topCompletionFactor} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="最佳转化因子" value={analysis.topConversionFactor} />
              </Card>
            </Col>
          </Row>

          <Card title="📈 各因子详细分析" style={{ marginBottom: 16 }}>
            {factors.map((factor, idx) => {
              const factorData = analysis.factorAnalysis[factor.name];
              if (!factorData) return null;
              return (
                <Card
                  key={factor.name}
                  type="inner"
                  title={`${factor.displayName} 分析`}
                  style={{ marginBottom: 12 }}
                  extra={factor.type === 'category' ? '分类型' : '范围型'}
                >
                  <Table
                    size="small"
                    columns={factorColumns}
                    dataSource={factorData}
                    pagination={false}
                    rowKey="value"
                  />
                </Card>
              );
            })}
          </Card>

          <Card title="💡 优化建议">
            <Descriptions column={1}>
              <Descriptions.Item label="🎯 播放量优化">{analysis.optimizationSuggestions.views}</Descriptions.Item>
              <Descriptions.Item label="👀 完播率优化">{analysis.optimizationSuggestions.completion}</Descriptions.Item>
              <Descriptions.Item label="💰 转化率优化">{analysis.optimizationSuggestions.conversion}</Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      )}

      <Card title="🎬 视频数据列表">
        <Table
          columns={videoColumns}
          dataSource={videos}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default AttributionAnalysisPage;
