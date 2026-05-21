import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Progress, Tag, Spin, Empty } from 'antd'
import { VideoCameraOutlined, EyeOutlined, ClockCircleOutlined, RiseOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
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

export default function Dashboard() {
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
        <span style={{ color: v > 4 ? '#52c41a' : v > 2 ? '#faad14' : '#ff4d4f' }}>
          {v}%
        </span>
      )
    },
  ]

  const taskColumns = [
    { title: '任务ID', dataIndex: 'id', key: 'id', width: 100, render: (v: string) => v.slice(-6) },
    { title: '商品', dataIndex: 'product', key: 'product' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          completed: 'success',
          processing: 'processing',
          failed: 'error',
          queued: 'default'
        }
        const texts: Record<string, string> = {
          completed: '已完成',
          processing: '处理中',
          failed: '失败',
          queued: '排队中'
        }
        return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>
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
      render: (v: number) => new Date(v).toLocaleString()
    },
  ]

  return (
    <div>
      {/* 总览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总视频数"
              value={data.overview.totalVideos}
              prefix={<VideoCameraOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总播放量"
              value={data.overview.totalViews}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均完播率"
              value={data.overview.avgCompletionRate}
              suffix="%"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均互动"
              value={data.overview.avgEngagement}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日视频"
              value={data.overview.todayVideos}
              valueStyle={{ color: '#1890ff' }}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}><ArrowUpOutlined /> +12%</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日播放"
              value={data.overview.todayViews}
              valueStyle={{ color: '#52c41a' }}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}><ArrowUpOutlined /> +8%</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图和热门商品 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="📊 近7天趋势">
            {data.trend.map((item, index) => (
              <div key={item.date} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{item.date}</span>
                  <span>{item.videos} 个视频 · {item.views.toLocaleString()} 播放</span>
                </div>
                <Progress 
                  percent={(item.views / Math.max(...data.trend.map(t => t.views))) * 100} 
                  showInfo={false} 
                  strokeColor="#1890ff"
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="🔥 热门商品">
            <Table 
              dataSource={data.topProducts} 
              columns={productColumns} 
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 最近任务和系统状态 */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="📋 最近任务">
            <Table 
              dataSource={data.recentTasks} 
              columns={taskColumns} 
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="⚙️ 系统状态">
            <div style={{ marginBottom: 16 }}>
              <span>API 调用额度</span>
              <Progress 
                percent={(data.systemStatus.apiCalls.used / data.systemStatus.apiCalls.limit) * 100} 
                format={() => `${data.systemStatus.apiCalls.used} / ${data.systemStatus.apiCalls.limit}`}
                strokeColor="#1890ff"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span>视频生成额度</span>
              <Progress 
                percent={(data.systemStatus.videoQuota.used / data.systemStatus.videoQuota.limit) * 100} 
                format={() => `${data.systemStatus.videoQuota.used} / ${data.systemStatus.videoQuota.limit}`}
                strokeColor="#52c41a"
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <span>存储使用：</span>
              <strong>{data.systemStatus.storageUsed}</strong>
            </div>
            <div>
              <span>运行时间：</span>
              <strong>{data.systemStatus.uptime}</strong>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
