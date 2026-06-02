import React from 'react';
import { useWorkbench, Scene, API_BASE } from '../useWorkbench';
import { renderMediaPreview } from '../utils/mediaHelper';
import {
  PlayCircleOutlined, LoadingOutlined, RocketOutlined, PictureOutlined,
  ApiOutlined, BulbOutlined, ThunderboltOutlined, SyncOutlined,
  CloseCircleOutlined, ReloadOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Button, Switch, Card, Space, Progress, Tag, Typography, Row, Col,
  message, Empty, Popover, List, Modal, Table,
} from 'antd';

const { Text } = Typography;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const VideoTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    settings, updateSettings, script, isRenderingAllScenes, handleRenderAllScenes,
    selectedSceneForSuggestions, setSelectedSceneForSuggestions,
    agentSuggestions, setAgentSuggestions, isAgentLoading, setIsAgentLoading,
    generateSingleSceneVideo, forceRerender,
  } = workbench;

  return (
    <Row gutter={24} style={{ height: '100%' }}>
      <Col span={24} style={{ height: '100%', overflowY: 'auto' }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ color: 'var(--text-primary)' }}><PlayCircleOutlined /> 🎬 分镜视频渲染仪表盘</span>
              <Space size="large">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>同时生成并同步旁白配音:</span>
                  <Switch
                    checked={settings.enableTTS}
                    onChange={(val) => updateSettings({ ...settings, enableTTS: val })}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                </div>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={isRenderingAllScenes}
                  onClick={handleRenderAllScenes}
                  disabled={!script || !script.scenes || script.scenes.length === 0}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 6, height: 38 }}
                >
                  ⚡ 一键渲染所有分镜
                </Button>
                <Button
                  type="default"
                  icon={<ApiOutlined />}
                  onClick={() => {
                    message.loading('正在获取后端任务状态...', 0);
                    fetch(`${API_BASE}/api/video/tasks`)
                      .then(res => res.json())
                      .then(data => {
                        message.destroy();
                        if (data.success && data.tasks.length > 0) {
                          Modal.info({
                            title: '📋 后端任务列表',
                            width: 800,
                            content: (
                              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                                <p style={{ marginBottom: 12, color: '#666' }}>
                                  当前共有 {data.total} 个后端任务：
                                </p>
                                <Table
                                  size="small"
                                  dataSource={data.tasks}
                                  rowKey="taskId"
                                  pagination={false}
                                  columns={[
                                    {
                                      title: '任务ID',
                                      dataIndex: 'taskId',
                                      key: 'taskId',
                                      width: 180,
                                      render: (id: string) => (
                                        <code style={{
                                          background: '#f5f5f5',
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          fontSize: 11
                                        }}>
                                          {id}
                                        </code>
                                      )
                                    },
                                    {
                                      title: '状态',
                                      dataIndex: 'status',
                                      key: 'status',
                                      width: 100,
                                      render: (status: string) => {
                                        const statusMap: Record<string, { color: string; text: string }> = {
                                          'queued': { color: 'default', text: '排队中' },
                                          'processing': { color: 'processing', text: '处理中' },
                                          'running': { color: 'processing', text: '运行中' },
                                          'succeeded': { color: 'success', text: '成功' },
                                          'failed': { color: 'error', text: '失败' }
                                        };
                                        const config = statusMap[status] || statusMap['queued'];
                                        return <Tag color={config.color}>{config.text}</Tag>;
                                      }
                                    },
                                    {
                                      title: '创建时间',
                                      dataIndex: 'age',
                                      key: 'age',
                                      width: 80,
                                      render: (age: string) => (
                                        <span style={{ fontSize: 11 }}>{age}</span>
                                      )
                                    },
                                    {
                                      title: '提示词',
                                      dataIndex: 'prompt',
                                      key: 'prompt',
                                      render: (prompt: string) => (
                                        <span style={{
                                          fontSize: 11,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: 200
                                        }}>
                                          {prompt}
                                        </span>
                                      )
                                    }
                                  ]}
                                />
                                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                  <Button
                                    type="primary"
                                    danger
                                    icon={<ReloadOutlined />}
                                    onClick={() => {
                                      fetch(`${API_BASE}/api/video/cleanup`, { method: 'POST' })
                                        .then(res => res.json())
                                        .then(cleanupData => {
                                          Modal.destroyAll();
                                          message.success(`✅ 已清理 ${cleanupData.cleanedCount} 个卡住的任务`);
                                        });
                                    }}
                                  >
                                    清理所有卡住任务
                                  </Button>
                                  <Button
                                    icon={<VideoCameraOutlined />}
                                    onClick={() => window.open('/task-center', '_blank')}
                                  >
                                    打开任务中心
                                  </Button>
                                </div>
                              </div>
                            ),
                            onOk: () => {},
                          });
                        } else {
                          message.info('✅ 当前没有运行中的后端任务');
                        }
                      })
                      .catch(err => {
                        message.destroy();
                        message.error('❌ 获取任务状态失败: ' + err.message);
                      });
                  }}
                  style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6, height: 38 }}
                >
                  📋 查看任务列表
                </Button>
              </Space>
            </div>
          }
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12 }}
        >
          {script && script.scenes && script.scenes.length > 0 ? (
            <Row gutter={[16, 16]}>
              {script.scenes.map((scene: Scene, index: number) => (
                <Col span={8} key={index}>
                  <Card
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8
                    }}
                    bodyStyle={{ padding: 12 }}
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>分镜 {index + 1} ({scene.duration}秒)</span>
                        <Space>
                          {scene.videoUrl ? (
                            <Tag color="success">视频就绪</Tag>
                          ) : (scene.rendering || scene.status === 'generating') ? (
                            <Tag color="processing" icon={<LoadingOutlined />}>正在生成</Tag>
                          ) : scene.status === 'error' ? (
                            <Tag color="error" icon={<CloseCircleOutlined />}>渲染失败</Tag>
                          ) : scene.imageUrl ? (
                            <Tag color="blue">首帧就绪</Tag>
                          ) : (
                            <Tag color="default">待处理</Tag>
                          )}
                          {scene.audioUrl && <Tag color="cyan">配音同步</Tag>}

                          {/* Agent 建议按钮 */}
                          <Popover
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>🤖 渲染优化建议</span>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => {
                                    setIsAgentLoading(true);
                                    setTimeout(() => {
                                      const suggestions = [
                                        {
                                          id: '1',
                                          title: '🎯 优化提示词',
                                          content: `建议优化分镜 ${index + 1} 的描述，增加更多细节以提升渲染质量`,
                                          type: 'prompt'
                                        },
                                        {
                                          id: '2',
                                          title: '⚡ 提升渲染优先级',
                                          content: '将该分镜标记为高优先级，提升渲染队列中的处理速度',
                                          type: 'priority'
                                        },
                                        {
                                          id: '3',
                                          title: '🎬 调整镜头参数',
                                          content: '建议调整镜头类型以获得更好的渲染效果',
                                          type: 'lens'
                                        }
                                      ];
                                      setAgentSuggestions(suggestions);
                                      setIsAgentLoading(false);
                                      setSelectedSceneForSuggestions(index);
                                    }, 500);
                                  }}
                                  style={{ padding: 0, fontSize: 12 }}
                                >
                                  刷新
                                </Button>
                              </div>
                            }
                            content={
                              <div style={{ width: 300 }}>
                                {isAgentLoading && selectedSceneForSuggestions === index ? (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <LoadingOutlined style={{ fontSize: 24, color: '#10b981' }} />
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Agent 正在分析中...</p>
                                  </div>
                                ) : selectedSceneForSuggestions === index && agentSuggestions.length > 0 ? (
                                  <List
                                    size="small"
                                    dataSource={agentSuggestions}
                                    renderItem={(item) => (
                                      <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ width: '100%' }}>
                                          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{item.title}</div>
                                          <p style={{ fontSize: 11, color: '#666', margin: 0 }}>{item.content}</p>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <ThunderboltOutlined style={{ fontSize: 24, color: '#10b981' }} />
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>点击获取渲染优化建议</p>
                                  </div>
                                )}
                              </div>
                            }
                            trigger="click"
                            placement="topRight"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<BulbOutlined />}
                              style={{ color: '#ffa940', padding: 0 }}
                            >
                              建议
                            </Button>
                          </Popover>
                        </Space>
                      </div>
                    }
                  >
                    {/* Visual Player Center */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: 180,
                      background: 'var(--page-bg)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                      marginBottom: 12
                    }}>
                      {scene.videoUrl ? (
                        <video src={scene.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (scene.rendering || scene.status === 'generating') ? (
                        <div style={{ textAlign: 'center', padding: 8 }}>
                          <LoadingOutlined style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }} />
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>后台渲染中 ({scene.progress || 10}%)</div>
                        </div>
                      ) : scene.imageUrl ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          {renderMediaPreview(scene.imageUrl, { alt: '首帧', style: { width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 } })}
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.4)'
                          }}>
                            <span style={{ color: 'var(--text-primary)', fontSize: 11, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4 }}>
                              首帧就绪，待生成视频
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <PictureOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                          <div style={{ fontSize: 11 }}>请先在分镜编辑中准备首帧</div>
                        </div>
                      )}
                    </div>

                    {/* Scene Script Reference Details */}
                    <div style={{ background: 'var(--card-bg)', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>分镜视觉 Prompt:</div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4, height: 30, marginBottom: 6 }}>
                        {scene.description}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>旁白台词:</div>
                      <div style={{ fontSize: 11, color: '#818cf8', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {scene.voiceover || '无'}
                      </div>
                    </div>

                    {/* Narration Player Wave */}
                    {scene.audioUrl && (
                      <div style={{ padding: '6px 10px', background: 'var(--card-bg)', borderRadius: 6, border: '1px solid var(--border-color)', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>🎙️ 旁白配音预听</span>
                          {scene.ttsEstDuration && <span style={{ opacity: 0.6 }}>({scene.ttsEstDuration}s)</span>}
                        </div>
                        <audio src={scene.audioUrl} controls style={{ width: '100%', height: 20 }} />
                      </div>
                    )}

                    {/* Render Actions */}
                    <div>
                      {/* 错误信息显示 */}
                      {scene.status === 'error' && scene.errorMessage && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          marginBottom: 10,
                          fontSize: 11,
                          color: '#fca5a5'
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CloseCircleOutlined /> 渲染失败
                          </div>
                          <div style={{ wordBreak: 'break-word' }}>
                            {scene.errorMessage}
                          </div>
                        </div>
                      )}

                      {/* 渲染中 */}
                      {scene.rendering || scene.status === 'generating' ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={6}>
                          <Button
                            type="dashed"
                            danger
                            block
                            icon={<CloseCircleOutlined />}
                            onClick={() => forceRerender(index)}
                            style={{
                              borderRadius: 6,
                              height: 32
                            }}
                          >
                            ⏹️ 取消渲染任务
                          </Button>
                          <Progress
                            percent={scene.progress || 10}
                            status="active"
                            size="small"
                            strokeColor={{
                              '0%': '#10b981',
                              '100%': '#059669',
                            }}
                            format={(percent) => `${percent}%`}
                          />
                          <Text type="secondary" style={{ fontSize: 10, textAlign: 'center', display: 'block' }}>
                            后台渲染中，请稍候...
                          </Text>
                        </Space>
                      ) : (
                        <Space direction="vertical" style={{ width: '100%' }} size={6}>
                          {/* 主要渲染按钮 */}
                          <Button
                            type={scene.status === 'error' ? 'primary' : 'primary'}
                            block
                            icon={scene.status === 'error' ? <SyncOutlined /> : scene.videoUrl ? <SyncOutlined /> : <PlayCircleOutlined />}
                            onClick={() => generateSingleSceneVideo(index)}
                            style={{
                              background: scene.status === 'error'
                                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                : scene.videoUrl
                                  ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              color: 'var(--text-primary)',
                              borderRadius: 6,
                              height: 36,
                              fontSize: 13
                            }}
                          >
                            {scene.status === 'error'
                              ? '🔄 重新渲染'
                              : scene.videoUrl
                                ? '🔄 重新渲染分镜'
                                : '🎥 渲染分镜视频'}
                          </Button>

                          {/* 强制重置按钮 - 只有在错误或卡住时显示 */}
                          {scene.status === 'error' || (scene.progress && scene.progress > 0 && !scene.videoUrl) ? (
                            <Button
                              type="dashed"
                              danger
                              block
                              icon={<ThunderboltOutlined />}
                              onClick={() => forceRerender(index)}
                              style={{
                                borderRadius: 6,
                                height: 28
                              }}
                            >
                              ⚡ 强制重置状态
                            </Button>
                          ) : null}
                        </Space>
                      )}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description={<span style={{ color: '#888' }}>暂无分镜场景数据，请先生成剧本分镜</span>} />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default VideoTab;
