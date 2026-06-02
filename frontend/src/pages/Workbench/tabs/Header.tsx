import React from 'react';
import { useWorkbench } from '../useWorkbench';
import { SaveOutlined, ArrowLeftOutlined, LoadingOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Typography, Tooltip } from 'antd';

const { Title, Text } = Typography;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const Header: React.FC<WorkbenchProps> = (workbench) => {
  const {
    navigate,
    project,
    projectMaterials,
    saveStatus,
    handleSave,
    workflowStarted,
    workflowNodes,
    projectId,
  } = workbench;

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderBottom: '1px solid var(--border-color)',
      flexShrink: 0,
    }}>
      {/* Row 1: Project title + save controls */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Space size="large">
          <Button
            type="text"
            icon={<ArrowLeftOutlined style={{ color: 'var(--text-secondary)', fontSize: '20px' }} />}
            onClick={() => navigate('/projects')}
            style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              padding: '8px 16px',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            返回项目列表
          </Button>
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>🎬 {project?.name || '创意工作台'}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {project?.description ? `绑定素材: ${projectMaterials.length} 个 | ${project.description.slice(0, 40)}` : '创意无限，全 AI 驱动视频生成器'}
            </Text>
          </div>
        </Space>

        <Space size="middle">
          {saveStatus === 'saved' && <Tag color="success"><CheckCircleOutlined /> 自动保存已同步</Tag>}
          {saveStatus === 'saving' && <Tag color="processing"><LoadingOutlined /> 自动保存中</Tag>}
          {saveStatus === 'unsaved' && <Tag color="warning">⚠️ 本地有待同步修改</Tag>}

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveStatus === 'saving'}
            onClick={() => handleSave()}
            style={{ borderRadius: 6, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}
          >
            强制保存
          </Button>
        </Space>
      </div>

      {/* Row 2: Agent Workflow 步骤条（仅触发过流程后显示） */}
      {workflowStarted && (
        <div style={{
          padding: '0 24px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
        }}>
          {workflowNodes.map((node, idx) => {
            const tabMap: Record<string, string> = {
              materials: 'materials',
              script: 'script',
              storyboard: 'storyboard',
              video: 'video',
              clip: 'render'
            };
            const statusColor: Record<string, string> = {
              pending: 'var(--text-secondary)',
              running: '#6366f1',
              completed: '#10b981',
              failed: '#ef4444',
            };
            const statusIcon: Record<string, React.ReactNode> = {
              pending: <span style={{ fontSize: 10 }}>○</span>,
              running: <SyncOutlined spin style={{ fontSize: 10 }} />,
              completed: <CheckCircleOutlined style={{ fontSize: 10 }} />,
              failed: <CloseCircleOutlined style={{ fontSize: 10 }} />,
            };
            return (
              <React.Fragment key={node.id}>
                <Tooltip title={`${node.agent} · ${node.layer}`} placement="bottom">
                  <div
                    onClick={() => navigate(`/workbench/${projectId}?tab=${tabMap[node.id] || 'script'}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: node.status === 'pending' ? 'transparent' : `${statusColor[node.status]}18`,
                      border: `1px solid ${statusColor[node.status]}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: statusColor[node.status] }}>
                      {statusIcon[node.status]}
                    </span>
                    <span style={{ fontSize: 11, color: node.status === 'pending' ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: node.status !== 'pending' ? 600 : 400 }}>
                      {node.name}
                    </span>
                    {node.status === 'completed' && node.output?.score !== undefined && (
                      <span style={{ fontSize: 9, color: '#10b981' }}>{node.output.score}分</span>
                    )}
                    {node.status === 'completed' && node.output?.sceneCount !== undefined && (
                      <span style={{ fontSize: 9, color: '#10b981' }}>{node.output.sceneCount}镜</span>
                    )}
                  </div>
                </Tooltip>
                {idx < workflowNodes.length - 1 && (
                  <div style={{ width: 20, height: 1, background: 'var(--border-color)', flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Header;
