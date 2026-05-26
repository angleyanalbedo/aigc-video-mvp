import React, { useState, useEffect } from 'react';
import { Card, Result, Button, Spin, Descriptions, Tag, Space } from 'antd';
import { ReloadOutlined, ApiOutlined } from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const checkServerStatus = async () => {
    setStatus('loading');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setServerInfo(data);
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error('无法连接到服务器:', error);
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    checkServerStatus();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#f0f2f5'
      }}>
        <Spin size="large" tip="正在连接服务器..." />
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: '20px'
      }}>
        <Card>
          <Result
            status="success"
            title="✅ 服务器连接成功"
            subTitle="后端服务正常运行中"
            extra={
              <Space direction="vertical">
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="状态">
                    <Tag color="green">运行中</Tag>
                  </Descriptions.Item>
                  {serverInfo?.status && (
                    <Descriptions.Item label="服务状态">
                      {serverInfo.status}
                    </Descriptions.Item>
                  )}
                  {serverInfo?.time && (
                    <Descriptions.Item label="服务器时间">
                      {new Date(serverInfo.time).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  )}
                  {serverInfo?.features && (
                    <Descriptions.Item label="可用功能">
                      {Object.entries(serverInfo.features)
                        .filter(([_, v]) => v)
                        .map(([k]) => (
                          <Tag key={k} color="blue">{k}</Tag>
                        ))}
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.href = '/'}
                >
                  进入应用
                </Button>
              </Space>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '20px'
    }}>
      <Card>
        <Result
          status="warning"
          icon={<ApiOutlined style={{ fontSize: '64px', color: '#faad14' }} />}
          title="⚠️ 无法连接到后端服务器"
          subTitle={
            <div>
              <p>请确保后端服务已启动</p>
              <p style={{ fontSize: '12px', color: '#999' }}>
                API 地址: {API_BASE || '/api'}
              </p>
            </div>
          }
          extra={
            <Space direction="vertical">
              <div>
                <h4>启动后端服务：</h4>
                <code style={{ 
                  display: 'block', 
                  padding: '10px', 
                  background: '#f5f5f5', 
                  borderRadius: '4px',
                  marginTop: '8px'
                }}>
                  cd /workspace/server && npm start
                </code>
              </div>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={checkServerStatus}
              >
                重新检测
              </Button>
            </Space>
          }
        />
      </Card>
    </div>
  );
};

export default StatusPage;
