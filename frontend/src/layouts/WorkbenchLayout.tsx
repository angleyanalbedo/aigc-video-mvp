import React from 'react';
import { Tooltip } from 'antd';
import {
  VideoCameraAddOutlined,
  DashboardOutlined,
  SettingOutlined,
  GithubOutlined,
  CustomerServiceOutlined,
  FolderOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  MonitorOutlined,
  AuditOutlined,
  ProjectOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import ConnectionStatus from '../components/ConnectionStatus';

interface MenuItem {
  key: string;
  path: string;
  icon: React.ReactNode;
  tooltip: string;
}

interface WorkbenchLayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
}

const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems: MenuItem[] = [
    {
      key: 'projects',
      path: '/projects',
      icon: <ProjectOutlined />,
      tooltip: '项目管理',
    },
    {
      key: 'video-creation',
      path: '/video-creation',
      icon: <VideoCameraAddOutlined />,
      tooltip: '视频创作',
    },
    {
      key: 'task-center',
      path: '/task-center',
      icon: <DashboardOutlined />,
      tooltip: '任务中心',
    },
    {
      key: 'materials',
      path: '/materials',
      icon: <FolderOutlined />,
      tooltip: '素材管理',
    },
    {
      key: 'attribution',
      path: '/attribution',
      icon: <BarChartOutlined />,
      tooltip: '归因分析',
    },
    {
      key: 'abtest',
      path: '/abtest',
      icon: <ExperimentOutlined />,
      tooltip: 'A/B测试',
    },
    {
      key: 'observability',
      path: '/observability',
      icon: <MonitorOutlined />,
      tooltip: '系统观测',
    },
    {
      key: 'compliance',
      path: '/compliance',
      icon: <AuditOutlined />,
      tooltip: '合规审核',
    },
  ];

  const footerItems: MenuItem[] = [
    {
      key: 'feedback',
      path: 'https://github.com',
      icon: <CustomerServiceOutlined />,
      tooltip: '反馈问题',
    },
    {
      key: 'settings',
      path: '/settings',
      icon: <SettingOutlined />,
      tooltip: '系统设置',
    },
    {
      key: 'github',
      path: 'https://github.com',
      icon: <GithubOutlined />,
      tooltip: '访问 GitHub',
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.key === 'github' || item.key === 'feedback') {
      window.open(item.path, '_blank');
    } else {
      navigate(item.path);
    }
  };

  const isActive = (item: MenuItem) => {
    if (item.key === 'projects') {
      return location.pathname === '/' || location.pathname === '/projects';
    }
    if (item.key === 'workbench') {
      return location.pathname.startsWith('/workbench');
    }
    return location.pathname === item.path;
  };

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
        <div style={{ 
          position: 'fixed', 
          top: 10, 
          right: 10, 
          zIndex: 1000,
          background: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <ConnectionStatus />
        </div>
        {children}
      </div>
    </div>
  );
};

export default WorkbenchLayout;
