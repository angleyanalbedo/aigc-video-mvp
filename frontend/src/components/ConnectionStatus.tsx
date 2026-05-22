import React, { useState, useEffect } from 'react';
import { Badge, Tooltip, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      setStatus('checking');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch (error) {
        setStatus('disconnected');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusInfo = () => {
    switch (status) {
      case 'checking':
        return {
          color: 'default',
          text: '检查中',
          icon: <LoadingOutlined />,
        };
      case 'connected':
        return {
          color: 'success',
          text: '已连接',
          icon: <CheckCircleOutlined />,
        };
      case 'disconnected':
        return {
          color: 'error',
          text: '未连接',
          icon: <CloseCircleOutlined />,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Tooltip 
      title={
        status === 'disconnected' 
          ? `无法连接到服务器 (${API_BASE || '/api'})。请确保后端服务已启动。`
          : status === 'connected'
          ? '后端服务连接正常'
          : '正在检查连接...'
      }
    >
      <Space>
        <Badge status={statusInfo.color as any} />
        {statusInfo.icon}
        <span style={{ fontSize: '12px' }}>{statusInfo.text}</span>
      </Space>
    </Tooltip>
  );
};

export default ConnectionStatus;
