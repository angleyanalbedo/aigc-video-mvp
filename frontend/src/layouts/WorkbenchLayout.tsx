import React from 'react'
import { Tooltip } from 'antd'
import {
  VideoCameraAddOutlined,
  DashboardOutlined,
  SettingOutlined,
  GithubOutlined,
  CustomerServiceOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

interface MenuItem {
  key: string
  path: string
  icon: React.ReactNode
  tooltip: string
}

interface WorkbenchLayoutProps {
  children: React.ReactNode
  activeMenu?: string
}

const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems: MenuItem[] = [
    {
      key: 'video-creation',
      path: '/',
      icon: <VideoCameraAddOutlined />,
      tooltip: '视频创作'
    },
    {
      key: 'task-center',
      path: '/task-center',
      icon: <DashboardOutlined />,
      tooltip: '任务中心'
    }
  ]

  const footerItems: MenuItem[] = [
    {
      key: 'feedback',
      path: 'https://github.com',
      icon: <CustomerServiceOutlined />,
      tooltip: '反馈问题'
    },
    {
      key: 'settings',
      path: '/settings',
      icon: <SettingOutlined />,
      tooltip: '系统设置'
    },
    {
      key: 'github',
      path: 'https://github.com',
      icon: <GithubOutlined />,
      tooltip: '访问 GitHub'
    }
  ]

  const handleMenuClick = (item: MenuItem) => {
    if (item.key === 'github' || item.key === 'feedback') {
      window.open(item.path, '_blank')
    } else {
      navigate(item.path)
    }
  }

  const isActive = (item: MenuItem) => {
    if (item.key === 'video-creation') {
      return location.pathname === '/' || location.pathname === '/video-creation'
    }
    return location.pathname === item.path
  }

  return (
    <div className="workbench">
      <div className="sidebar">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon"></div>
        </div>

        <div className="sidebar__menu">
          {menuItems.map((item) => (
            <Tooltip
              key={item.key}
              title={item.tooltip}
              placement="right"
              destroyOnHidden
              showArrow={false}
            >
              <div
                className={`sidebar__item ${isActive(item) ? 'active' : ''}`}
                onClick={() => handleMenuClick(item)}
              >
                <span className="icon">{item.icon}</span>
              </div>
            </Tooltip>
          ))}
        </div>

        <div className="sidebar__footer">
          {footerItems.map((item) => (
            <Tooltip
              key={item.key}
              title={item.tooltip}
              placement="right"
              destroyOnHidden
              showArrow={false}
            >
              <div
                className="sidebar__item"
                onClick={() => handleMenuClick(item)}
              >
                <span className="icon">{item.icon}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="main-content">
        {children}
      </div>
    </div>
  )
}

export default WorkbenchLayout
