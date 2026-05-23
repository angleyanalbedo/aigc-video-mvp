import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout, Spin, Alert } from 'antd';
import CopilotChat from '../../components/CopilotChat';
import InfiniteCanvas from '../../components/InfiniteCanvas';

import './index.css';

const { Content } = Layout;

const Copilot: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
      <Content className="copilot-content">
        <div className="copilot-main">
          <CopilotChat
          projectId={projectId}
        />
          <InfiniteCanvas
          projectId={projectId}
        />
        </div>
      </Content>
    </Layout>
  );
};

export default Copilot;
