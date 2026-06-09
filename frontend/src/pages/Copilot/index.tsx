import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Spin, Alert, Button, List, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  MessageOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  ExpandOutlined,
  CompressOutlined
} from '@ant-design/icons';
import CopilotChat from '../../components/CopilotChat';
import InfiniteCanvas from '../../components/InfiniteCanvas';
import { getChatSessions, createChatSession } from '../../utils/copilotApi';

import './index.css';

const { Content } = Layout;

const Copilot: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  // Layout collapsed states
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  // Chat sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!projectId) return;
    try {
      const response = await getChatSessions(projectId);
      if (response.success) {
        setSessions(response.sessions || []);
        // Set the most recent session as active if none is selected
        if (!activeSessionId && response.sessions && response.sessions.length > 0) {
          setActiveSessionId(response.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('❌ Failed to fetch chat sessions:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchSessions();
    }
  }, [projectId]);

  const handleCreateSession = async () => {
    if (!projectId) return;
    try {
      const title = `新对话 ${sessions.length + 1}`;
      const response = await createChatSession(projectId, title);
      if (response.success) {
        setActiveSessionId(response.sessionId);
        await fetchSessions();
      }
    } catch (err) {
      console.error('❌ Failed to create chat session:', err);
    }
  };

  if (loading) {
    return (
      <div className="copilot-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="copilot-error">
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="copilot-error">
        <Alert
          message="缺少项目ID"
          description="请选择一个项目以继续"
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <Layout className="copilot-layout">
      {/* Premium Top navigation bar with toggle controllers */}
      <div className="copilot-topbar">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/projects')}
          className="copilot-back-button"
        >
          返回项目列表
        </Button>
        <Tooltip title={leftCollapsed ? "打开历史会话" : "关闭历史会话"}>
          <Button
            type="text"
            icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="layout-toggle-btn"
          />
        </Tooltip>
        <div className="copilot-title">
          <h2>AI 创意助手</h2>
        </div>
        
        {/* Toggle to toggle entire Canvas full screen */}
        <Tooltip title={rightCollapsed ? "展开右侧画板" : "收起右侧画板（全屏聊天）"}>
          <Button
            type="text"
            icon={rightCollapsed ? <ExpandOutlined /> : <CompressOutlined />}
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="layout-toggle-btn canvas-toggle"
            style={{ marginLeft: 'auto' }}
          >
            {rightCollapsed ? "展示画板" : "全屏对话"}
          </Button>
        </Tooltip>
      </div>

      <Content className="copilot-content">
        <div className="copilot-main">
          {/* Column 1: Collapsible Sessions list */}
          <div className={`copilot-sidebar ${leftCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
              <span>对话历史</span>
              <Button
                type="text"
                shape="circle"
                icon={<PlusOutlined />}
                onClick={handleCreateSession}
                title="新建对话"
                size="small"
                className="new-chat-btn"
              />
            </div>
            <div className="sidebar-sessions-list">
              <List
                dataSource={sessions}
                renderItem={(session) => (
                  <div
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.id)}
                    key={session.id}
                  >
                    <MessageOutlined className="session-icon" />
                    <span className="session-title" title={session.title}>
                      {session.title}
                    </span>
                  </div>
                )}
                locale={{ emptyText: '暂无历史会话' }}
              />
            </div>
          </div>

          {/* Column 2: Chat area (Flexible if right-panel is collapsed) */}
          <div className={`copilot-chat-container ${rightCollapsed ? 'full-width' : ''}`}>
            <CopilotChat
              projectId={projectId}
              activeSessionId={activeSessionId}
              onSessionCreated={(sid) => {
                setActiveSessionId(sid);
                fetchSessions();
              }}
            />
          </div>

          {/* Column 3: Collapsible Infinite Canvas */}
          <div className={`copilot-canvas-container ${rightCollapsed ? 'collapsed' : ''}`}>
            <InfiniteCanvas projectId={projectId} />
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default Copilot;
