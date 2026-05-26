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
  ArrowLeftOutlined,
  VideoCameraOutlined,
  RocketOutlined,
  FireOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
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

  // Detect project-level workspace mode
  const match = location.pathname.match(/\/workbench\/([^/]+)/);
  const projectId = match ? match[1] : null;
  const isProjectMode = !!projectId;

  // Read current active tab from query search parameters (e.g. ?tab=script)
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'script';

  // Standard global menu items
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
      key: 'video-library',
      path: '/video-library',
      icon: <FireOutlined />,
      tooltip: '优质视频库',
    },
    {
      key: 'template-library',
      path: '/template-library',
      icon: <ThunderboltOutlined />,
      tooltip: '灵感模板',
    },
    {
      key: 'one-click',
      path: '/one-click',
      icon: <PlayCircleOutlined />,
      tooltip: '一键成片',
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

  // Project-dedicated dynamic menu items
  const projectMenuItems: MenuItem[] = projectId ? [
    {
      key: 'back-to-projects',
      path: '/projects',
      icon: <ArrowLeftOutlined />,
      tooltip: '返回项目列表',
    },
    {
      key: 'script',
      path: `/workbench/${projectId}?tab=script`,
      icon: <EditOutlined />,
      tooltip: '1. 剧本协同',
    },
    {
      key: 'storyboard',
      path: `/workbench/${projectId}?tab=storyboard`,
      icon: <VideoCameraOutlined />,
      tooltip: '2. 分镜设计',
    },
    {
      key: 'audio',
      path: `/workbench/${projectId}?tab=audio`,
      icon: <CustomerServiceOutlined />,
      tooltip: '3. 音轨配音',
    },
    {
      key: 'render',
      path: `/workbench/${projectId}?tab=render`,
      icon: <RocketOutlined />,
      tooltip: '4. 合成输出',
    },
  ] : [];

  const footerItems: MenuItem[] = [
    {
      key: 'feedback',
      path: 'https://github.com/angleyanalbedo/aigc-video-mvp/issues',
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
      path: 'https://github.com/angleyanalbedo/aigc-video-mvp',
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
    if (isProjectMode) {
      if (item.key === 'back-to-projects') return false;
      return item.key === activeTab;
    }
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
      <div className={`sidebar ${isProjectMode ? 'sidebar--dark' : ''}`}>
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon"></div>
        </div>

        <div className="sidebar__menu">
          {(isProjectMode ? projectMenuItems : menuItems).map((item) => (
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

      <div className={`main-content ${isProjectMode ? 'main-content--dark' : ''}`}>
        <div style={{ 
          position: 'fixed', 
          top: 10, 
          right: 10, 
          zIndex: 1000,
          background: isProjectMode ? '#1e1e2f' : 'white',
          color: isProjectMode ? '#fff' : '#000',
          padding: '4px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: isProjectMode ? '1px solid #27272a' : 'none'
        }}>
          <ConnectionStatus />
        </div>
        {children}
      </div>
    </div>
  );
};

export default WorkbenchLayout;
