import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Alert, Button, Space, Tag, message, Descriptions } from 'antd';
import { MonitorOutlined, DatabaseOutlined, AlertOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const ObservabilityPage = () => {
  const [health, setHealth] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [requestMetrics, setRequestMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthRes, systemRes, requestRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/api/observability/health`),
        fetch(`${API_BASE}/api/observability/metrics/system`),
        fetch(`${API_BASE}/api/observability/metrics/requests`),
        fetch(`${API_BASE}/api/observability/alerts`),
      ]);

      const [healthData, systemData, requestData, alertsData] = await Promise.all([
        healthRes.json(),
        systemRes.json(),
        requestRes.json(),
        alertsRes.json(),
      ]);

      if (healthData.success && healthData.data) setHealth(healthData.data);
      if (systemData.success && systemData.data) setSystemMetrics(systemData.data);
      if (requestData.success && requestData.data) setRequestMetrics(requestData.data);
      if (alertsData.success && alertsData.data) {
        setAlerts(alertsData.data.history || alertsData.data || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (id: any) => {
    try {
      const response = await fetch(`${API_BASE}/api/observability/alerts/${id}/resolve`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success('告警已处理');
        loadData();
      }
    } catch (error) {
      console.error('处理告警失败:', error);
      message.error('处理告警失败');
    }
  };

  const getStatusColor = (status: any) => {
    switch (status) {
      case 'healthy': return '#52c41a';
      case 'degraded': return '#faad14';
      case 'unhealthy': return '#ff4d4f';
      default: return '#666';
    }
  };

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: any) => new Date(t).toLocaleString() },
    { title: '级别', dataIndex: 'level', key: 'level', render: (level: any) => (
      <Tag color={level === 'critical' ? 'red' : level === 'warning' ? 'orange' : 'blue'}>{level}</Tag>
    )},
    { title: '来源', dataIndex: 'source', key: 'source' },
    { title: '消息', dataIndex: 'message', key: 'message' },
    { title: '状态', dataIndex: 'resolved', key: 'resolved', render: (resolved: any) => (
      resolved ? <Tag color="success">已处理</Tag> : <Tag color="warning">未处理</Tag>
    )},
    { title: '操作', key: 'actions', render: (_: any, record: any, index: any) => {
      const alertId = record.id !== undefined ? record.id : index;
      return (
        !record.resolved && (
          <Button type="text" size="small" onClick={() => handleResolveAlert(alertId)}>处理</Button>
        )
      );
    }},
  ];

  const endpointColumns = [
    { title: '端点', dataIndex: 'endpoint', key: 'endpoint' },
    { title: '请求数', dataIndex: 'count', key: 'count' },
    { title: '平均响应时间', dataIndex: 'avgDuration', key: 'avgDuration', render: (d: any) => `${d.toFixed(2)}ms` },
    { title: '错误数', dataIndex: 'errors', key: 'errors' },
    { title: '错误率', dataIndex: 'errorRate', key: 'errorRate', render: (rate: any) => <Progress percent={rate} size="small" status={rate > 10 ? 'exception' : 'normal'} /> },
  ];

  return (
    <div className="content-area">
      <div className="page-title">🔍 系统观测</div>
      <div className="page-subtitle">实时监控系统状态和关键指标</div>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </Space>

      {health && (
        <Card title="🏥 系统健康状态" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="系统状态" value={health.status} prefix={<CheckCircleOutlined />} valueStyle={{ color: getStatusColor(health.status) }} />
            </Col>
            <Col span={6}>
              <Statistic title="运行时间" value={health.uptime} prefix={<ClockCircleOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="当前时间" value={new Date(health.timestamp).toLocaleString()} />
            </Col>
            <Col span={6}>
              <Statistic title="版本" value={health.version} />
            </Col>
          </Row>
          <Alert
            message={health.status === 'healthy' ? '系统运行正常' : health.status === 'degraded' ? '系统部分功能异常' : '系统异常'}
            type={health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'error'}
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      {systemMetrics && (
        <Card title="💻 系统资源指标" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Card type="inner" title="CPU 使用率" style={{ marginBottom: 16 }}>
                <Progress percent={systemMetrics.cpu.percent} status={systemMetrics.cpu.percent > 80 ? 'exception' : 'normal'} />
                <Row gutter={8}>
                  <Col span={6}><Statistic title="内核数" value={systemMetrics.cpu.cores} /></Col>
                  <Col span={6}><Statistic title="平均负载" value={systemMetrics.cpu.loadAvg} /></Col>
                </Row>
              </Card>
            </Col>
            <Col span={12}>
              <Card type="inner" title="内存使用率" style={{ marginBottom: 16 }}>
                <Progress percent={systemMetrics.memory.percent} status={systemMetrics.memory.percent > 80 ? 'exception' : 'normal'} />
                <Row gutter={8}>
                  <Col span={6}><Statistic title="已用" value={systemMetrics.memory.used} /></Col>
                  <Col span={6}><Statistic title="总计" value={systemMetrics.memory.total} /></Col>
                </Row>
              </Card>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Card type="inner" title="磁盘使用率">
                <Progress percent={systemMetrics.disk.percent} status={systemMetrics.disk.percent > 80 ? 'exception' : 'normal'} />
                <Row gutter={8}>
                  <Col span={6}><Statistic title="已用" value={systemMetrics.disk.used} /></Col>
                  <Col span={6}><Statistic title="总计" value={systemMetrics.disk.total} /></Col>
                </Row>
              </Card>
            </Col>
            <Col span={12}>
              <Card type="inner" title="网络流量">
                <Row gutter={8}>
                  <Col span={8}><Statistic title="入流量" value={systemMetrics.network.rxBytes} /></Col>
                  <Col span={8}><Statistic title="出流量" value={systemMetrics.network.txBytes} /></Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {requestMetrics && (
        <Card title="📊 请求统计" style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Statistic title="总请求" value={requestMetrics.totalRequests} prefix={<DatabaseOutlined />} /></Col>
            <Col span={6}><Statistic title="成功率" value={requestMetrics.successRate} suffix="%" /></Col>
            <Col span={6}><Statistic title="平均响应" value={requestMetrics.avgDuration} suffix="ms" /></Col>
            <Col span={6}><Statistic title="错误数" value={requestMetrics.errorCount} /></Col>
          </Row>
          <Card type="inner" title="端点详情">
            <Table size="small" columns={endpointColumns} dataSource={requestMetrics.endpoints} rowKey="endpoint" pagination={false} />
          </Card>
        </Card>
      )}

      <Card title="⚠️ 告警列表">
        <Table columns={columns} dataSource={alerts} rowKey={(record: any, index?: number) => record.id || String(index)} pagination={{ pageSize: 5 }} />
      </Card>
    </div>
  );
};

export default ObservabilityPage;
