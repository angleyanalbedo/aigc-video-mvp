import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Card } from 'antd';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: '50px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f0f2f5'
        }}>
          <Card>
            <Result
              status="error"
              title="页面加载失败"
              subTitle={this.state.error?.message || '发生了未知错误'}
              extra={[
                <Button type="primary" key="reload" onClick={this.handleReload}>
                  刷新页面
                </Button>,
                <Button key="home" onClick={this.handleGoHome}>
                  返回首页
                </Button>,
              ]}
            />
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
