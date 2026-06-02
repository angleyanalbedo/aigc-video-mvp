import React from 'react';
import { useWorkbench } from '../useWorkbench';
import {
  RocketOutlined,
  ScissorOutlined,
  PlayCircleOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Row,
  Col,
  Card,
  Space,
  Select,
  Button,
  Divider,
  Switch,
  Slider,
  Tag,
  Progress,
  Empty,
  Typography,
} from 'antd';

const { Text, Paragraph } = Typography;
const { Option } = Select;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const RenderTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    settings,
    updateSettings,
    script,
    isRenderingAll,
    renderProgress,
    renderStatus,
    finalVideoUrl,
    clipPlan,
    isPlanningClip,
    handleGenerateClipPlan,
    handleCompileFinalVideo,
    handlePublishVideo,
  } = workbench;

  return (
    <Row gutter={24} style={{ height: '100%' }}>
      {/* Left: Resolution, Ratio, transition configs & AI Clip Agent planner */}
      <Col span={10} style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><RocketOutlined /> 视频最终渲染编译设置</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, flexShrink: 0 }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>1. 分辨率选择 (Resolution)</Text></div>
              <Select
                value={settings.resolution}
                onChange={(val) => updateSettings({ ...settings, resolution: val })}
                style={{ width: '100%' }}
              >
                <Option value="480p">480p (流畅导出 - 渲染极快)</Option>
                <Option value="720p">720p (标清带货 - 推荐画质)</Option>
                <Option value="1080p">1080p (高清精美 - 适合高配机型)</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>2. 画面幅面比 (Aspect Ratio)</Text></div>
              <Select
                value={settings.ratio}
                onChange={(val) => updateSettings({ ...settings, ratio: val })}
                style={{ width: '100%' }}
              >
                <Option value="9:16">📱 9:16 (竖屏 - 适合抖音/快手短视频)</Option>
                <Option value="16:9">🖥️ 16:9 (横屏 - 适合哔哩哔哩/常规PC播放)</Option>
                <Option value="1:1">⬛ 1:1 (正方形 - 适合社交平台展示)</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>3. 分镜转场效果 (Transitions)</Text></div>
              <Select
                value={settings.transition}
                onChange={(val) => updateSettings({ ...settings, transition: val })}
                style={{ width: '100%' }}
              >
                <Option value="fade">🌀 渐显淡入淡出转场 (Cross Fade)</Option>
                <Option value="cut">⚡ 极速硬切镜头转场 (Direct Cut)</Option>
                <Option value="flash">✨ 闪白转场效果 (White Flash)</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>4. 配音发音人角色 (Speaker Role)</Text></div>
              <Select
                value={settings.voice}
                onChange={(val) => updateSettings({ ...settings, voice: val })}
                style={{ width: '100%' }}
              >
                <Option value="zh_female_story">知性温柔带货主播（推荐）</Option>
                <Option value="zh_male_narrator">激情热烈好物解说员</Option>
                <Option value="zh_male_technology">专业科技电子产品专家</Option>
                <Option value="zh_female_chitchat">轻快甜美生活好物推介</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>5. 带货背景音乐 (BGM Soundtrack)</Text></div>
              <Select
                value={settings.bgm}
                onChange={(val) => updateSettings({ ...settings, bgm: val })}
                style={{ width: '100%' }}
              >
                <Option value="cheerful.mp3">轻快乐活好物推介 (Cheerful BGM)</Option>
                <Option value="energetic.mp3">激情劲爆带货抢购 (Energetic EDM)</Option>
                <Option value="smooth_jazz.mp3">优雅高级精致小资 (Smooth Jazz)</Option>
                <Option value="none">不配背景乐 (None)</Option>
              </Select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ color: 'var(--text-primary)' }}>6. 背景音乐音量混音比例</Text>
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
                <Text strong style={{ color: 'var(--text-primary)' }}>7. 启用 AI 旁白配音</Text>
                <Switch checked={settings.enableTTS} onChange={(val) => updateSettings({ ...settings, enableTTS: val })} />
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {settings.enableTTS ? '✅ 所有分镜将自动生成 AI 配音' : '❌ 仅使用背景音乐，无配音旁白'}
              </Text>
            </div>

            <Divider style={{ margin: '12px 0', borderTopColor: 'var(--border-color)' }} />

            <Button
              type="primary"
              size="large"
              block
              disabled={!script}
              loading={isRenderingAll}
              onClick={handleCompileFinalVideo}
              icon={<PlayCircleOutlined />}
              style={{
                height: 52,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)'
              }}
            >
              {isRenderingAll ? '正在执行高精编译成片...' : '🎬 一键合成发布带货视频'}
            </Button>
          </Space>
        </Card>

        {/* AI Video Editor Agent (ClipAgent) */}
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><ScissorOutlined /> AI 剪辑师 Copilot</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, flexShrink: 0 }}
          bodyStyle={{ padding: 16 }}
        >
          {!clipPlan ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Paragraph style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                AI 剪辑师可以智能分析分镜剧本节奏，编排最佳转场，并精确配平旁白配音与背景乐（BGM）比例！
              </Paragraph>
              <Button
                type="primary"
                icon={<ScissorOutlined />}
                loading={isPlanningClip}
                onClick={handleGenerateClipPlan}
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: 6, height: 40 }}
              >
                {isPlanningClip ? 'AI 剪辑师正在深度分析中...' : '🧠 召唤 AI 剪辑师制定智能剪辑方案'}
              </Button>
            </div>
          ) : (
            <div>
              <div style={{ background: 'var(--input-bg)', padding: 12, borderRadius: 8, marginBottom: 12, borderLeft: '4px solid #6366f1' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5, marginBottom: 4 }}>🎉 智能剪辑编排方案已应用：</div>
                <div style={{ color: '#34d399', fontSize: 12, marginBottom: 4 }}>
                  🎵 推荐背景乐: <strong>{clipPlan.audio?.bgm || '欢快乐活'}</strong> | 音量: <strong>{Math.round((clipPlan.audio?.volume || 0.2) * 100)}%</strong>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                  AI 建议: 配音音量设为 80% (当前为 {settings.volume}%)，与 BGM 保持完美听觉平衡，防止背景音嘈杂。
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>🎬 分镜智能剪切轨道 (AI Storyboard Transitions):</Text>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {clipPlan.clips?.slice(0, 6).map((clip: any, idx: number) => (
                    <Tag key={idx} color="purple" style={{ borderRadius: 4, margin: 0, padding: '2px 8px', fontSize: 11 }}>
                      镜 {clip.sceneId || idx + 1} ➔ {clip.transition === 'fade' ? '🌀 渐变' : clip.transition === 'flash' ? '✨ 闪白' : '⚡ 硬切'}
                    </Tag>
                  ))}
                  {clipPlan.clips?.length > 6 && <Tag color="default" style={{ borderRadius: 4, margin: 0, padding: '2px 8px', fontSize: 11 }}>+ {clipPlan.clips.length - 6} 个分镜</Tag>}
                </div>
              </div>

              <Button
                type="dashed"
                block
                onClick={handleGenerateClipPlan}
                loading={isPlanningClip}
                style={{ color: '#818cf8', borderColor: '#4f46e5', background: 'transparent', height: 32, borderRadius: 6 }}
              >
                🔄 重新评估剪辑方案
              </Button>
            </div>
          )}
        </Card>
      </Col>

      {/* Right: Render Monitoring Dashboard & final persistent video player */}
      <Col span={14} style={{ height: '100%' }}>
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><VideoCameraOutlined /> 渲染终端 & 最终预览大盘</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%', overflowY: 'auto' }}
        >
          {/* When rendering is active */}
          {isRenderingAll && (
            <div style={{ background: 'var(--input-bg)', padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 20 }}>
              <Progress type="circle" percent={renderProgress} strokeColor={{ '0%': '#10b981', '100%': '#6366f1' }} width={120} />
              <div style={{ marginTop: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{renderStatus}</div>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                后台 FFmpeg 与大声轨合成器正在飞速运作，请稍候片刻...
              </Text>
            </div>
          )}

          {/* Final Rendered Video Player */}
          {finalVideoUrl ? (
            <div>
              <div style={{ background: 'var(--input-bg)', padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: '4px solid #10b981' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>🎉 合成完毕：</span>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>最终高精度带货视频已妥善渲染在本地临时存储。</Text>
              </div>

              <div style={{
                width: '100%',
                background: '#000',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 24px -8px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 0'
              }}>
                <video src={finalVideoUrl} controls style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 4 }} />
              </div>

              <Row gutter={16} style={{ marginTop: 20 }}>
                <Col span={12}>
                  <Button
                    type="primary"
                    block
                    onClick={() => window.open(finalVideoUrl, '_blank')}
                    style={{ background: '#4f46e5', border: 'none', height: 40, borderRadius: 6 }}
                  >
                    📥 立即下载 MP4 高清带货视频
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    block
                    onClick={handlePublishVideo}
                    style={{ height: 40, borderRadius: 6, background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  >
                    🚀 一键分发至社交媒体
                  </Button>
                </Col>

              </Row>
            </div>
          ) : !isRenderingAll ? (
            <Empty
              description={<span style={{ color: '#888' }}>视频暂未开始合成。在左侧选择参数后，点击"一键合成"开启智能渲染！</span>}
              style={{ marginTop: 100 }}
            />
          ) : null}
        </Card>
      </Col>
    </Row>
  );
};

export default RenderTab;
