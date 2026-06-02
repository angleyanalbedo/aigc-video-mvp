import React from 'react';
import { useWorkbench, API_BASE } from '../useWorkbench';
import {
  CustomerServiceOutlined,
  ApiOutlined,
  SkinOutlined,
  GlobalOutlined,
  ExperimentOutlined,
  AudioOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import {
  Button,
  Select,
  Switch,
  Card,
  Space,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Slider,
  message,
  Empty,
  Input,
} from 'antd';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const AudioTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    settings,
    updateSettings,
    script,
    updateScript,
    updateSceneField,
    setCurrentSceneForAudioSelect,
    setIsLoadingAudioLibrary,
    setAudioLibraryMaterials,
    setAudioLibraryModalVisible,
  } = workbench;

  return (
    <Row gutter={24} style={{ height: '100%' }}>
      {/* Left: Global Audio Settings & Agent Panel */}
      <Col span={8} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><CustomerServiceOutlined /> 全局音频设置</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12 }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>1. 发音人选择</Text></div>
              <Select
                value={settings.voice}
                onChange={(val) => updateSettings({ ...settings, voice: val })}
                style={{ width: '100%' }}
              >
                <Option value="zh_female_story">👩 知性温柔带货主播</Option>
                <Option value="zh_male_narrator">👨 激情热烈好物解说员</Option>
                <Option value="zh_male_technology">🧑‍💻 专业科技电子产品专家</Option>
                <Option value="zh_female_chitchat">👧 轻快甜美生活好物推介</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>2. 配音语速</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>慢速</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>{settings.speed}x</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>快速</span>
              </div>
              <Slider
                min={0.5}
                max={2.0}
                step={0.1}
                value={settings.speed}
                onChange={(val) => updateSettings({ ...settings, speed: val })}
              />
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>3. 背景音乐选择</Text></div>
              <Select
                value={settings.bgm}
                onChange={(val) => updateSettings({ ...settings, bgm: val })}
                style={{ width: '100%' }}
              >
                <Option value="cheerful.mp3">🎵 轻快乐活好物推介</Option>
                <Option value="energetic.mp3">🔥 激情劲爆带货抢购</Option>
                <Option value="smooth_jazz.mp3">🎷 优雅高级精致小资</Option>
                <Option value="none">❌ 不配背景音乐</Option>
              </Select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ color: 'var(--text-primary)' }}>4. 背景音乐音量</Text>
                <Text style={{ color: 'var(--text-secondary)' }}>{settings.volume}%</Text>
              </div>
              <Slider
                min={0}
                max={100}
                value={settings.volume}
                onChange={(val) => updateSettings({ ...settings, volume: val })}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text strong style={{ color: 'var(--text-primary)' }}>5. 启用 AI 配音</Text>
                <Switch checked={settings.enableTTS} onChange={(val) => updateSettings({ ...settings, enableTTS: val })} />
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {settings.enableTTS ? '✅ 所有分镜将自动生成 AI 配音' : '❌ 仅使用背景音乐，无配音旁白'}
              </Text>
            </div>
          </Space>
        </Card>

        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><ApiOutlined /> 音频 AI 助手</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 智能优化您的配音文案
            </Text>

            <Button
              type="default"
              icon={<SkinOutlined />}
              block
              onClick={() => {
                message.info('🎨 优化中：让所有配音更有感染力...');
              }}
              style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316' }}
            >
              ✨ 优化所有配音文案（让配音更有感染力）
            </Button>

            <Button
              type="default"
              icon={<GlobalOutlined />}
              block
              onClick={() => {
                message.info('🌐 检查文案一致性中...');
              }}
            >
              🔗 统一全部分镜的配音风格
            </Button>

            <Button
              type="default"
              icon={<ExperimentOutlined />}
              block
              onClick={() => {
                message.info('📝 分析配音长度中...');
              }}
            >
              ⏱️ 智能调整文案长度以匹配画面时长
            </Button>

            <Divider style={{ margin: '8px 0', borderColor: 'var(--border-color)' }} />

            <Text type="secondary" style={{ fontSize: 11 }}>
              🔧 快速操作
            </Text>

            <Button
              type="primary"
              block
              onClick={() => {
                if (!script?.scenes) return;
                const newScenes = script.scenes.map((scene: any) => ({
                  ...scene,
                  voiceover: scene.voiceover || ''
                }));
                updateScript({ ...script, scenes: newScenes });
                message.success('✅ 已统一初始化所有配音文案');
              }}
              style={{ background: '#10b981', border: 'none' }}
            >
              🎯 批量初始化配音
            </Button>

            <Button
              type="default"
              danger
              block
              onClick={() => {
                if (!script?.scenes) return;
                const newScenes = script.scenes.map((scene: any) => ({
                  ...scene,
                  voiceover: '',
                  audioUrl: undefined,
                  ttsEstDuration: undefined
                }));
                updateScript({ ...script, scenes: newScenes });
                message.warning('⚠️ 已清空所有配音数据');
              }}
            >
              🗑️ 清空所有配音
            </Button>
          </Space>
        </Card>
      </Col>

      {/* Right: Detailed Voiceover Track Editor */}
      <Col span={16} style={{ height: '100%', overflowY: 'auto' }}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-primary)' }}><AudioOutlined /> 分镜配音轨道编辑器</span>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    if (!script?.scenes) return;
                    const hasMissing = script.scenes.some((scene: any) => !scene.voiceover);
                    if (hasMissing) {
                      message.warning('⚠️ 部分分镜还没有配音文案');
                    } else {
                      message.success('✅ 开始批量生成配音...');
                    }
                  }}
                >
                  🎙️ 批量生成所有配音
                </Button>
              </Space>
            </div>
          }
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%' }}
        >
          {script?.scenes?.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {script.scenes.map((scene: any, index: number) => (
                <Card
                  key={index}
                  size="small"
                  style={{
                    background: 'var(--input-bg)',
                    border: scene.audioUrl ? '1px solid #10b981' : '1px solid var(--border-color)',
                    borderRadius: 8
                  }}
                >
                  <Row gutter={16}>
                    <Col span={4}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Tag color={scene.audioUrl ? 'success' : 'default'} style={{ fontSize: 12 }}>
                          {scene.audioUrl ? '✅ 已配音' : '⏳ 待配音'}
                        </Tag>
                        <Text style={{ color: '#888', fontSize: 11 }}>
                          分镜 {index + 1}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          ⏱️ {scene.duration}s
                        </Text>
                      </div>
                    </Col>

                    <Col span={14}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <TextArea
                          value={scene.voiceover}
                          onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                          placeholder="输入该分镜的旁白配音文案..."
                          rows={3}
                          style={{
                            background: 'var(--page-bg)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            fontSize: 12
                          }}
                        />

                        {scene.audioUrl && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
                              🎧 已生成配音
                              {scene.ttsEstDuration && <span style={{ marginLeft: 8 }}>时长: {scene.ttsEstDuration}s</span>}
                            </Text>
                            <audio
                              src={scene.audioUrl}
                              controls
                              style={{ width: '100%', height: 28 }}
                            />
                          </div>
                        )}

                        {/* 声音参考 */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 10, marginBottom: 4, display: 'block' }}>
                            🎵 声音参考（可选）
                          </Text>
                          {scene.referenceAudioUrl ? (
                            <div style={{
                              background: 'var(--input-bg)',
                              borderRadius: 4,
                              padding: 6,
                              border: '1px solid #818cf8',
                            }}>
                              <Row gutter={4} align="middle">
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
                                    onClick={() => {
                                      updateSceneField(index, 'referenceAudioUrl', undefined);
                                      message.info('🗑️ 已清除声音参考');
                                    }}
                                    style={{ height: 24, fontSize: 9, padding: '0 4px' }}
                                  >
                                    删除
                                  </Button>
                                </Col>
                              </Row>
                            </div>
                          ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                              <Button
                                type="dashed"
                                size="small"
                                block
                                icon={<UploadOutlined />}
                                onClick={() => {
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
                                  background: 'rgba(129, 140, 248, 0.08)',
                                  border: '1px dashed #818cf8',
                                  color: '#818cf8',
                                  fontSize: 10,
                                  height: 26
                                }}
                              >
                                📤 上传声音参考
                              </Button>
                              <Button
                                type="dashed"
                                size="small"
                                block
                                icon={<FolderOpenOutlined />}
                                onClick={async () => {
                                  setCurrentSceneForAudioSelect(index);
                                  setIsLoadingAudioLibrary(true);
                                  try {
                                    const res = await fetch(`${API_BASE}/api/materials/library`);
                                    const data = await res.json();
                                    if (data.success) {
                                      // 只保留音频类型的素材
                                      const audioMaterials = (data.materials || []).filter((m: any) =>
                                        m.type && m.type.startsWith('audio')
                                      );
                                      setAudioLibraryMaterials(audioMaterials);
                                    }
                                  } catch (err: any) {
                                    message.error('加载素材库失败: ' + err.message);
                                  } finally {
                                    setIsLoadingAudioLibrary(false);
                                  }
                                  setAudioLibraryModalVisible(true);
                                }}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  border: '1px dashed #10b981',
                                  color: '#10b981',
                                  fontSize: 10,
                                  height: 26
                                }}
                              >
                                📚 从素材库选择
                              </Button>
                            </Space>
                          )}
                        </div>
                      </Space>
                    </Col>

                    <Col span={6}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button
                          type="primary"
                          size="small"
                          block
                          icon={<AudioOutlined />}
                          disabled={!scene.voiceover}
                          onClick={() => {
                            message.loading(`🎙️ 正在生成分镜 ${index + 1} 的配音...`, 1);
                            setTimeout(() => {
                              updateSceneField(index, 'audioUrl', 'https://example.com/demo-audio.mp3');
                              updateSceneField(index, 'ttsEstDuration', scene.duration);
                              message.success(`✅ 分镜 ${index + 1} 配音生成成功！`);
                            }, 1500);
                          }}
                        >
                          {scene.audioUrl ? '🔄 重新生成' : '🎙️ 生成配音'}
                        </Button>

                        {scene.audioUrl && (
                          <Button
                            size="small"
                            block
                            onClick={() => {
                              updateSceneField(index, 'audioUrl', undefined);
                              updateSceneField(index, 'ttsEstDuration', undefined);
                              message.info(`🗑️ 已清除分镜 ${index + 1} 的配音`);
                            }}
                          >
                            🗑️ 清除配音
                          </Button>
                        )}

                        <Divider style={{ margin: '4px 0', borderColor: 'var(--border-color)' }} />

                        <Button
                          type="default"
                          size="small"
                          block
                          icon={<BulbOutlined />}
                          style={{ fontSize: 11 }}
                          onClick={() => {
                            const suggestions = [
                              '增加一点激情！',
                              '使用更亲切的语气',
                              '强调产品优势'
                            ];
                            const random = suggestions[Math.floor(Math.random() * suggestions.length)];
                            updateSceneField(index, 'voiceover', (scene.voiceover || '') + ' ' + random);
                            message.success(`💡 已应用优化建议: ${random}`);
                          }}
                        >
                          💡 AI 优化
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>
          ) : (
            <Empty description={<span style={{ color: '#888' }}>暂无分镜数据，请先在「剧本策划」中创建剧本</span>} />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default AudioTab;
