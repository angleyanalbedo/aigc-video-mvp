import React, { useState, useEffect } from 'react'
import { Row, Col, Table, Progress, Tag, Spin, Empty, Button, Popconfirm, message } from 'antd'
import { 
  VideoCameraOutlined, 
  EyeOutlined, 
  ClockCircleOutlined, 
  RiseOutlined, 
  ArrowUpOutlined, 
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ClearOutlined
} from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname.includes('trae.cn') 
  ? 'http://localhost:3001' 
  : ''

interface DashboardData {
  overview: {
    totalVideos: number
    totalViews: number
    avgCompletionRate: number
    avgEngagement: number
    todayVideos: number
    todayViews: number
  }
  topProducts: Array<{
    id: number
    name: string
    videos: number
    views: number
    conversionRate: number
  }>
  recentTasks: Array<{
    id: string
    product: string
    status: string
    duration: number | null
    createdAt: number
  }>
  trend: Array<{
    date: string
    videos: number
    views: number
  }>
  systemStatus: {
    apiCalls: { used: number; limit: number }
    videoQuota: { used: number; limit: number }
    storageUsed: string
    uptime: string
  }
}

const TaskCenterPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/dashboard/stats`)
      setData(response.data.data)
    } catch (error) {
      console.error('获取看板数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await axios.delete(`${API_BASE}/api/tasks/${id}`);
      if (res.data.success) {
        message.success('任务删除成功');
        fetchDashboard();
      } else {
        message.error(res.data.error || '删除失败');
      }
    } catch (error: any) {
      console.error('删除任务失败:', error);
      message.error('删除失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleClearTasks = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/tasks/clear-finished`);
      if (res.data.success) {
        message.success(res.data.message || '清理完成');
        fetchDashboard();
      } else {
        message.error(res.data.error || '清空失败');
      }
    } catch (error: any) {
      console.error('清空已结束任务失败:', error);
      message.error('清空失败: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#999' }}>加载看板数据...</p>
      </div>
    )
  }

  if (!data) {
    return <Empty description="暂无数据" />
  }

  const productColumns = [
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    { title: '视频数', dataIndex: 'videos', key: 'videos', render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: '播放量', dataIndex: 'views', key: 'views', render: (v: number) => v.toLocaleString() },
    { 
      title: '转化率', 
      dataIndex: 'conversionRate', 
      key: 'conversionRate',
      render: (v: number) => (
        <span style={{ color: v > 4 ? '#52c41a' : v > 2 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}>
          {v}%
        </span>
      )
    },
  ]

  const taskColumns = [
    { 
      title: '任务ID', 
      dataIndex: 'id', 
      key: 'id', 
      width: 120,
      render: (v: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{v.slice(-8)}</code>
    },
    { title: '商品', dataIndex: 'product', key: 'product' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
          completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
          processing: { color: 'processing', icon: <PlayCircleOutlined />, text: '处理中' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          queued: { color: 'default', icon: <ClockCircleOutlined />, text: '排队中' }
        }
        const item = config[status] || config.queued
        return <Tag color={item.color} icon={item.icon}>{item.text}</Tag>
      }
    },
    { 
      title: '时长', 
      dataIndex: 'duration', 
      key: 'duration',
      render: (v: number | null) => v ? `${v}s` : '-'
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: (v: number) => new Date(v).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => {
        const deletable = ['completed', 'failed', 'succeeded'].includes(record.status);
        return (
          <Popconfirm
            title="确认要将该任务从任务中心移除吗？"
            onConfirm={() => handleDeleteTask(record.id)}
            okText="确认"
            cancelText="取消"
            disabled={!deletable}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              disabled={!deletable}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        );
      }
    }
  ]

  return (
    <>
      <div className="topbar">
        <div className="topbar__title">📊 任务中心</div>
        <div className="topbar__actions" style={{ display: 'flex', gap: 8 }}>
          <Popconfirm
            title="确认要清空所有已完成和失败的渲染任务吗？"
            onConfirm={handleClearTasks}
            okText="清空"
            cancelText="取消"
          >
            <Button icon={<ClearOutlined />} danger>
              清空已完成和失败任务
            </Button>
          </Popconfirm>
          <Button icon={<ReloadOutlined />} type="primary" onClick={fetchDashboard}>
            刷新数据
          </Button>
        </div>
      </div>
      <div className="content-area">
        <div className="page-title">数据统计看板</div>
        <div className="page-subtitle">实时监控视频生成任务和业务数据</div>
        
        {/* 总览统计 */}
        <div className="card-grid">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <VideoCameraOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>总视频数</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.totalVideos}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <EyeOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>总播放量</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.totalViews.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #722ed1 0%, #531d93 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <ClockCircleOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>平均完播率</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.avgCompletionRate}%
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <RiseOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>平均互动</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.avgEngagement}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <VideoCameraOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>今日视频</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.todayVideos}
                  <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                    <ArrowUpOutlined /> +12%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24
              }}>
                <EyeOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>今日播放</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#333' }}>
                  {data.overview.todayViews.toLocaleString()}
                  <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                    <ArrowUpOutlined /> +8%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 趋势图和热门商品 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>📊 近7天趋势</h3>
              {data.trend.map((item) => (
                <div key={item.date} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{item.date}</span>
                    <span style={{ color: '#666' }}>
                      {item.videos} 个视频 · {item.views.toLocaleString()} 播放
                    </span>
                  </div>
                  <Progress 
                    percent={(item.views / Math.max(...data.trend.map(t => t.views))) * 100} 
                    showInfo={false} 
                    strokeColor={{
                      '0%': '#667eea',
                      '100%': '#764ba2',
                    }}
                  />
                </div>
              ))}
            </div>
          </Col>
          <Col span={12}>
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>🔥 热门商品</h3>
              <Table 
                dataSource={data.topProducts} 
                columns={productColumns} 
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>
          </Col>
        </Row>

        {/* 最近任务和系统状态 */}
        <Row gutter={16}>
          <Col span={16}>
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>📋 最近任务</h3>
              <Table 
                dataSource={data.recentTasks} 
                columns={taskColumns} 
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>⚙️ 系统状态</h3>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#666' }}>API 调用额度</span>
                  <span style={{ fontWeight: 600 }}>
                    {data.systemStatus.apiCalls.used} / {data.systemStatus.apiCalls.limit}
                  </span>
                </div>
                <Progress 
                  percent={(data.systemStatus.apiCalls.used / data.systemStatus.apiCalls.limit) * 100} 
                  showInfo={false}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': '#0050b3',
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#666' }}>视频生成额度</span>
                  <span style={{ fontWeight: 600 }}>
                    {data.systemStatus.videoQuota.used} / {data.systemStatus.videoQuota.limit}
                  </span>
                </div>
                <Progress 
                  percent={(data.systemStatus.videoQuota.used / data.systemStatus.videoQuota.limit) * 100} 
                  showInfo={false}
                  strokeColor={{
                    '0%': '#52c41a',
                    '100%': '#237804',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#666' }}>存储使用：</span>
                <strong>{data.systemStatus.storageUsed}</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>运行时间：</span>
                <strong>{data.systemStatus.uptime}</strong>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </>
  )
}

export default TaskCenterPage
