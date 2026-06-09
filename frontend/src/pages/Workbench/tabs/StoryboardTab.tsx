import React from 'react';
import { useWorkbench, Scene, API_BASE } from '../useWorkbench';
import { renderMediaPreview } from '../utils/mediaHelper';
import AssetPanel from '../AssetPanel';
import {
  SendOutlined, LoadingOutlined, PictureOutlined, VideoCameraOutlined,
  PlusOutlined, DeleteOutlined, BulbOutlined, ThunderboltOutlined,
  ApiOutlined, EditOutlined, AudioOutlined,
} from '@ant-design/icons';
import {
  Button, Input, Select, Card, Space, Tag, Typography, Divider,
  Row, Col, message, Empty, Popover, List,
} from 'antd';

const { Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const StoryboardTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    projectId, projectMaterials, setProjectMaterials,
    injectingMaterial, handleInjectMode, cancelInjectMode, handleSceneCardClick,
    chatHistory, chatInput, setChatInput, isChatting, handleSendChatMessage,
    script,
    selectedSceneForSuggestions, setSelectedSceneForSuggestions,
    agentSuggestions, isAgentLoading,
    updateSceneField, uploadFrameImage, clearSceneImage, openEditModal,
    generateSingleSceneImage, handleRenderAllImages,
    getAgentSuggestions, batchOptimize, applyAgentSuggestion, optimizeAllScenes,
    setWorkflowNodes,
  } = workbench;

  return (
    <Row gutter={24} style={{ height: '100%' }}>
      {/* Left: Asset Panel & Controls */}
      <Col span={6} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <AssetPanel
          projectId={projectId!}
          materials={projectMaterials}
          injectingMaterialId={injectingMaterial?.id || null}
          onInjectMode={handleInjectMode}
          onMaterialUploaded={(newMaterial) => {
            setProjectMaterials(prev => [newMaterial, ...prev]);
          }}
        />

        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><AudioOutlined /> 分镜编辑 Co-pilot</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12 }}
        >
          {/* Chat Message Lists for Storyboard */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, paddingRight: 4 }}>
            <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 12, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6 }}>
              💬 <strong>分镜导演 Agent</strong>：我可以帮您批量重写分镜描述、修改转场、微调台词旁白或调整时长。可以直接和我说："把所有镜头的色彩改为冷色调"
            </div>
            {chatHistory.slice(1).map((msg, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10
              }}>
                <div style={{
                  maxWidth: '90%',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--hover-bg)',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  fontSize: 12,
                  lineHeight: 1.4
                }}>
                  <Paragraph style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{msg.content}</Paragraph>
                </div>
              </div>
            ))}
            {isChatting && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ background: 'var(--hover-bg)', padding: '6px 10px', borderRadius: '10px 10px 10px 2px', fontSize: 12 }}>
                  <span style={{ color: '#818cf8' }}><LoadingOutlined /> 导演正在修改分镜配置...</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-color)', paddingTop: 8, flexShrink: 0 }}>
            <TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              placeholder="输入修改指令..."
              autoSize={{ minRows: 2, maxRows: 2 }}
              style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: 12 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={isChatting || !chatInput.trim()}
              onClick={handleSendChatMessage}
              style={{ height: 'auto', background: '#4f46e5', border: 'none' }}
            />
          </div>
        </Card>
      </Col>

      {/* Right: Grid of Scene Form Cards */}
      <Col span={18} style={{ height: '100%', overflowY: 'auto' }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ color: 'var(--text-primary)' }}><VideoCameraOutlined /> 🎬 分镜视觉首帧编辑面板 (支持 AI 生图及手动上传图片)</span>
              <Space size="middle">
                {injectingMaterial && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#818cf8' }}>点击分镜卡片注入参考图 →</span>
                    <Button size="small" onClick={cancelInjectMode} style={{ background: 'var(--hover-bg)', border: 'none', color: 'var(--text-secondary)' }}>取消</Button>
                  </div>
                )}
                {/* Agent 批量操作 */}
                <Popover
                  title="🤖 Agent 智能工具箱"
                  content={
                    <div style={{ minWidth: 220 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button
                          type="primary"
                          icon={<ThunderboltOutlined />}
                          block
                          onClick={optimizeAllScenes}
                        >
                          一键智能优化
                        </Button>
                        <Divider style={{ margin: '8px 0' }} />
                        <Text style={{ fontSize: 12, color: '#666' }}>批量操作：</Text>
                        <Button
                          size="small"
                          block
                          onClick={() => batchOptimize('consistency')}
                        >
                          统一风格
                        </Button>
                        <Button
                          size="small"
                          block
                          onClick={() => batchOptimize('duration')}
                        >
                          调整时长
                        </Button>
                        <Button
                          size="small"
                          block
                          onClick={() => batchOptimize('voiceover')}
                        >
                          优化配音
                        </Button>
                      </Space>
                    </div>
                  }
                  trigger="click"
                >
                  <Button
                    type="default"
                    icon={<ApiOutlined />}
                    style={{ background: '#1890ff', border: 'none', color: 'var(--text-primary)', borderRadius: 6 }}
                  >
                    Agent 工具箱
                  </Button>
                </Popover>

                <Button
                  type="default"
                  icon={<PictureOutlined />}
                  onClick={handleRenderAllImages}
                  disabled={!script || !script.scenes || script.scenes.length === 0}
                  style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6 }}
                >
                  一键生成所有图片
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
                <Col span={12} key={index}>
                  <Card
                    hoverable={!!injectingMaterial}
                    onClick={() => {
                      if (injectingMaterial) {
                        handleSceneCardClick(index);
                      }
                    }}
                    style={{
                      background: 'var(--card-bg)',
                      border: injectingMaterial ? '2px dashed #6366f1' : '1px solid var(--border-color)',
                      borderRadius: 8,
                      cursor: injectingMaterial ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      boxShadow: injectingMaterial ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
                    }}
                    bodyStyle={{ padding: 16 }}
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>分镜 {index + 1}</span>
                          {!!scene.imageUrl ? (
                            <Tag color="blue">首帧已就绪</Tag>
                          ) : (
                            <Tag color="default">待生图/待上传</Tag>
                          )}
                          {(scene.rendering || scene.status === 'generating') && (
                            <Tag color="processing" icon={<LoadingOutlined />}>生图中</Tag>
                          )}
                          {scene.status === 'error' && <Tag color="error">失败</Tag>}
                        </Space>
                        <Space>
                          {/* Agent 建议按钮 */}
                          <Popover
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>🤖 智能建议</span>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => getAgentSuggestions(index)}
                                  style={{ padding: 0, fontSize: 12 }}
                                >
                                  刷新
                                </Button>
                              </div>
                            }
                            content={
                              <div style={{ width: 320 }}>
                                {isAgentLoading && selectedSceneForSuggestions === index ? (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Agent 正在分析中...</p>
                                  </div>
                                ) : selectedSceneForSuggestions === index && agentSuggestions.length > 0 ? (
                                  <List
                                    dataSource={agentSuggestions}
                                    renderItem={(item) => (
                                      <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ width: '100%' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</span>
                                            <Tag color="orange" style={{ fontSize: 10 }}>Cost: {item.cost} ⚡</Tag>
                                          </div>
                                          <p style={{ fontSize: 11, color: '#666', margin: 0, marginBottom: 6 }}>{item.content}</p>
                                          <Button
                                            type="primary"
                                            size="small"
                                            style={{ fontSize: 11, height: '24px' }}
                                            onClick={() => applyAgentSuggestion(item, index)}
                                          >
                                            应用
                                          </Button>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <BulbOutlined style={{ fontSize: 24, color: '#ffc107' }} />
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>点击获取智能建议</p>
                                    <Button
                                      type="primary"
                                      size="small"
                                      onClick={() => getAgentSuggestions(index)}
                                    >
                                      获取建议
                                    </Button>
                                  </div>
                                )}
                              </div>
                            }
                            trigger="click"
                            placement="topRight"
                            onOpenChange={(visible) => {
                              if (visible && selectedSceneForSuggestions !== index) {
                                setSelectedSceneForSuggestions(index);
                              }
                            }}
                          >
                            <Button
                              type="link"
                              size="small"
                              icon={<BulbOutlined />}
                              style={{ color: '#ffa940', padding: 0 }}
                            >
                              建议
                            </Button>
                          </Popover>

                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(index);
                            }}
                            style={{ color: '#818cf8', padding: 0 }}
                          >
                            编辑
                          </Button>
                        </Space>
                      </div>
                    }
                  >
                    <Row gutter={12}>
                      {/* Left part of card: Preview player / generator placeholder */}
                      <Col span={10}>
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          height: 160,
                          background: 'var(--page-bg)',
                          border: '1px dashed var(--border-color)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          {/* Reference image corner badge */}
                          {scene.referenceImageUrl && (
                            <div style={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              width: 32,
                              height: 32,
                              borderRadius: 4,
                              border: '1.5px solid #6366f1',
                              overflow: 'hidden',
                              zIndex: 10,
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)'
                            }} title="已关联商品参考图">
                              {renderMediaPreview(scene.referenceImageUrl, { alt: '参考图', style: { width: '100%', height: '100%', objectFit: 'cover' } })}
                            </div>
                          )}

                          {(scene.rendering || scene.status === 'generating') ? (
                            <div style={{ textAlign: 'center', padding: 8 }}>
                              <LoadingOutlined style={{ fontSize: 24, color: '#6366f1', marginBottom: 8 }} />
                              <div style={{ fontSize: 11, color: '#888' }}>正在生图...</div>
                            </div>
                          ) : !!scene.imageUrl ? (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                              {renderMediaPreview(scene.imageUrl, { alt: '首帧图片', style: { width: '100%', height: '100%', objectFit: 'cover' } })}
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearSceneImage(index, 'main');
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  opacity: 0.8,
                                  height: 24,
                                  minWidth: 24,
                                  padding: '0 4px',
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 8 }}>
                              <PictureOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                              <div style={{ fontSize: 10 }}>暂无首帧画面</div>
                            </div>
                          )}
                        </div>

                        {/* CONDITIONAL PREVIEW ACTIONS BASED ON WORKFLOW STATE */}
                        {!scene.rendering && (
                          <div style={{ marginTop: 8 }}>
                            {!scene.imageUrl ? (
                              <>
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<PictureOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateSingleSceneImage(index);
                                  }}
                                  style={{
                                    width: '100%',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 12
                                  }}
                                >
                                  🎨 AI生图
                                </Button>
                                <div style={{ marginTop: 6 }}>
                                  <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = async (e: any) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const formData = new FormData();
                                          formData.append('file', file);
                                          message.loading(`正在上传 "${file.name}"...`, 0);
                                          try {
                                            const res = await fetch(`${API_BASE}/api/upload`, {
                                              method: 'POST',
                                              body: formData
                                            });
                                            const uploadData = await res.json();
                                            message.destroy();
                                            if (uploadData.success && uploadData.url) {
                                              message.success('分镜首帧上传成功！');
                                              updateSceneField(index, 'imageUrl', uploadData.url);
                                              updateSceneField(index, 'status', 'image_completed');
                                              setWorkflowNodes(prev => prev.map(n => n.id === 'storyboard' ? { ...n, status: 'completed' } : n));
                                            } else {
                                              throw new Error(uploadData.error || '上传失败');
                                            }
                                          } catch (err: any) {
                                            message.error('上传失败: ' + err.message);
                                          }
                                        }
                                      };
                                      input.click();
                                    }}
                                    style={{
                                      width: '100%',
                                      background: 'var(--hover-bg)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-primary)',
                                      borderRadius: 4,
                                      fontSize: 12
                                    }}
                                  >
                                    📤 上传图片
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateSingleSceneImage(index);
                                  }}
                                  style={{ fontSize: 11, padding: 0, height: 'auto', color: 'var(--text-secondary)' }}
                                >
                                  🎨 重新生图
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = async (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        message.loading(`正在上传 "${file.name}"...`, 0);
                                        try {
                                          const res = await fetch(`${API_BASE}/api/upload`, {
                                            method: 'POST',
                                            body: formData
                                          });
                                          const uploadData = await res.json();
                                          message.destroy();
                                          if (uploadData.success && uploadData.url) {
                                            message.success('分镜图片替换成功！');
                                            updateSceneField(index, 'imageUrl', uploadData.url);
                                            updateSceneField(index, 'status', 'image_completed');
                                          } else {
                                            throw new Error(uploadData.error || '上传失败');
                                          }
                                        } catch (err: any) {
                                          message.error('上传失败: ' + err.message);
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                  style={{ fontSize: 11, padding: 0, height: 'auto', color: '#818cf8' }}
                                >
                                  📤 重新上传
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SLEEK TTS AUDIO PLAYBACK BAR */}
                        {scene.audioUrl && (
                          <div style={{ marginTop: 8, padding: '4px 8px', background: 'var(--input-bg)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: 10, color: '#34d399', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>🎙️ 旁白配音就绪</span>
                              {scene.ttsEstDuration && <span style={{ opacity: 0.6 }}>({scene.ttsEstDuration}s)</span>}
                            </div>
                            <audio src={scene.audioUrl} controls style={{ width: '100%', height: 18 }} />
                          </div>
                        )}
                      </Col>

                      {/* Right part of card: Editable input forms */}
                      <Col span={14}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>分镜视觉提示词：</Text>
                            <TextArea
                              value={scene.description}
                              onChange={(e) => updateSceneField(index, 'description', e.target.value)}
                              rows={2}
                              style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: 11.5 }}
                            />
                          </div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>旁白配音：</Text>
                            <TextArea
                              value={scene.voiceover}
                              onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                              rows={1}
                              style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: 11.5 }}
                            />
                          </div>

                          {/* 声音参考 */}
                          <div>
                            <Row gutter={8} align="middle">
                              <Col span={24}>
                                <Text type="secondary" style={{ fontSize: 10, marginBottom: 4, display: 'block' }}>
                                  🎵 声音参考（可选）
                                </Text>
                              </Col>
                            </Row>
                            {scene.referenceAudioUrl ? (
                              <div style={{
                                background: 'var(--input-bg)',
                                borderRadius: 4,
                                padding: 8,
                                border: '1px solid #818cf8',
                              }}>
                                <Row gutter={8} align="middle">
                                  <Col span={18}>
                                    <audio
                                      src={scene.referenceAudioUrl}
                                      controls
                                      style={{ width: '100%', height: 24 }}
                                    />
                                  </Col>
                                  <Col span={6}>
                                    <Button
                                      size="small"
                                      danger
                                      block
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSceneField(index, 'referenceAudioUrl', undefined);
                                        message.info('🗑️ 已清除声音参考');
                                      }}
                                      style={{ height: 24, fontSize: 10 }}
                                    >
                                      删除
                                    </Button>
                                  </Col>
                                </Row>
                              </div>
                            ) : (
                              <Button
                                type="dashed"
                                size="small"
                                block
                                icon={<AudioOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'audio/*';
                                  input.onchange = async (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      message.loading(`正在上传声音参考 "${file.name}"...`, 0);
                                      try {
                                        const res = await fetch(`${API_BASE}/api/upload`, {
                                          method: 'POST',
                                          body: formData
                                        });
                                        const uploadData = await res.json();
                                        message.destroy();
                                        if (uploadData.success && uploadData.url) {
                                          updateSceneField(index, 'referenceAudioUrl', uploadData.url);
                                          message.success('🎵 声音参考上传成功！');
                                        } else {
                                          throw new Error(uploadData.error || '上传失败');
                                        }
                                      } catch (err: any) {
                                        message.error('上传失败: ' + err.message);
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                                style={{
                                  background: 'rgba(129, 140, 248, 0.1)',
                                  border: '1px dashed #818cf8',
                                  color: '#818cf8',
                                  fontSize: 11,
                                  height: 28
                                }}
                              >
                                📤 上传声音参考（配音语气/节奏参考）
                              </Button>
                            )}
                          </div>
                          <Row gutter={8}>
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 10 }}>时长(秒):</Text>
                              <Input
                                type="number"
                                value={scene.duration}
                                onChange={(e) => updateSceneField(index, 'duration', parseInt(e.target.value) || 3)}
                                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', height: 26, fontSize: 11 }}
                              />
                            </Col>
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 10 }}>镜头:</Text>
                              <Select
                                value={scene.shot_type}
                                onChange={(val) => updateSceneField(index, 'shot_type', val)}
                                style={{ width: '100%', height: 26 }}
                                size="small"
                              >
                                <Option value="特写">特写</Option>
                                <Option value="中景">中景</Option>
                                <Option value="全景">全景</Option>
                              </Select>
                            </Col>
                          </Row>
                          <Divider style={{ margin: '8px 0', borderColor: 'var(--border-color)' }} />
                          <Row gutter={8}>
                            {/* 首帧 */}
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>首帧</Text>
                              <div style={{
                                height: 60,
                                background: 'var(--page-bg)',
                                border: '1px dashed var(--border-color)',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                position: 'relative',
                              }} onClick={(e) => {
                                e.stopPropagation();
                                uploadFrameImage(index, 'first');
                              }}>
                                {!!scene.firstFrameUrl ? (
                                  <>
                                    {renderMediaPreview(scene.firstFrameUrl, { alt: '首帧', style: { width: '100%', height: '100%', objectFit: 'cover' } })}
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        clearSceneImage(index, 'first');
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 2,
                                        right: 2,
                                        opacity: 0.8,
                                        height: 18,
                                        minWidth: 18,
                                        padding: '0 2px',
                                        fontSize: 10,
                                      }}
                                    />
                                  </>
                                ) : (
                                  <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>点击上传</span>
                                )}
                              </div>
                            </Col>
                            {/* 尾帧 */}
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>尾帧</Text>
                              <div style={{
                                height: 60,
                                background: 'var(--page-bg)',
                                border: '1px dashed var(--border-color)',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                position: 'relative',
                              }} onClick={(e) => {
                                e.stopPropagation();
                                uploadFrameImage(index, 'last');
                              }}>
                                {!!scene.lastFrameUrl ? (
                                  <>
                                    {renderMediaPreview(scene.lastFrameUrl, { alt: '尾帧', style: { width: '100%', height: '100%', objectFit: 'cover' } })}
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        clearSceneImage(index, 'last');
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 2,
                                        right: 2,
                                        opacity: 0.8,
                                        height: 18,
                                        minWidth: 18,
                                        padding: '0 2px',
                                        fontSize: 10,
                                      }}
                                    />
                                  </>
                                ) : (
                                  <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>点击上传</span>
                                )}
                              </div>
                            </Col>
                          </Row>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description={<span style={{ color: '#888' }}>暂无分镜场景数据，请先生成剧本</span>} />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default StoryboardTab;
