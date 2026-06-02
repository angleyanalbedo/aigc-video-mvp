import React from 'react';
import { useWorkbench } from '../useWorkbench';
import { SendOutlined, SaveOutlined, LoadingOutlined, AudioOutlined } from '@ant-design/icons';
import { Button, Input, Card, Row, Col, Tag, Typography, Empty } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const ScriptTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    chatHistory,
    chatInput,
    setChatInput,
    isChatting,
    chatBottomRef,
    handleSendChatMessage,
    script,
  } = workbench;

  return (
    <Row gutter={24} style={{ height: '100%' }}>
      {/* Left: Chat Copilot */}
      <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><AudioOutlined /> AI 创意导演 Copilot</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}
        >
          {/* Chat Message Lists */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
            {chatHistory.map((msg, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--hover-bg)',
                  color: 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  lineHeight: 1.5,
                  fontSize: 13.5
                }}>
                  <Paragraph style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</Paragraph>
                  <div style={{
                    fontSize: 10,
                    opacity: 0.6,
                    textAlign: 'right',
                    marginTop: 4
                  }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isChatting && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                <div style={{ background: 'var(--hover-bg)', padding: '10px 14px', borderRadius: '12px 12px 12px 2px' }}>
                  <span style={{ color: '#818cf8' }}><LoadingOutlined /> AI 导演正在深入构思中...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Controls */}
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
            <TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              placeholder="输入剧本创作想法...例如：'帮我制作一个破壁机的带货剧本，突出超静音特色'"
              autoSize={{ minRows: 2, maxRows: 3 }}
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={isChatting || !chatInput.trim()}
              onClick={handleSendChatMessage}
              style={{ height: 'auto', borderRadius: 8, background: '#4f46e5', border: 'none' }}
            />
          </div>
        </Card>
      </Col>

      {/* Right: Script Interactive Canvas */}
      <Col span={14} style={{ height: '100%' }}>
        <Card
          title={<span style={{ color: 'var(--text-primary)' }}><SaveOutlined /> 剧本画布预览</span>}
          bordered={false}
          style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%', overflowY: 'auto' }}
        >
          {script ? (
            <div>
              <div style={{ background: 'var(--input-bg)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <Title level={4} style={{ color: 'var(--text-primary)', margin: '0 0 8px 0' }}>📄 {script.title}</Title>
                <Paragraph style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>
                  <strong>核心创意创意:</strong> {script.description}
                </Paragraph>
              </div>

              <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 12 }}>📝 分镜场景时间线</Title>
              {script.scenes?.map((scene: any, index: number) => (
                <div key={index} style={{
                  display: 'flex',
                  background: 'var(--hover-bg)',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  borderLeft: '4px solid #6366f1'
                }}>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <Tag color="geekblue" style={{ borderRadius: 4 }}>镜 {index + 1}</Tag>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Paragraph style={{ color: 'var(--text-primary)', fontSize: 13, margin: '0 0 4px 0' }}>{scene.description}</Paragraph>
                    <Text style={{ color: '#6366f1', fontSize: 11 }}>旁白: {scene.voiceover}</Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description={<span style={{ color: 'var(--text-secondary)' }}>暂无剧本，请先与 AI 导演沟通生成</span>} />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default ScriptTab;
