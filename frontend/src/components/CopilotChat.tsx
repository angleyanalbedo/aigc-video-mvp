import React, { useState, useRef, useEffect } from 'react';
import {
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RobotOutlined,
  UserOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Button, Input, Spin, List, Card, Tag, Typography } from 'antd';
import {
  sendMessage,
  executePlan,
  cancelPlan,
  getChatHistory,
  createChatSession,
  connectWebSocket,
  type Message,
  type Plan
} from '../utils/copilotApi';
import './CopilotChat.css';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface CopilotChatProps {
  projectId: string;
  onNodesChanged?: (nodes: any[]) => void;
  onConnectionsChanged?: (connections: any[]) => void;
}

const CopilotChat: React.FC<CopilotChatProps> = ({ projectId, onNodesChanged, onConnectionsChanged }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<Plan & { planNodeId: string, sessionId: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const init = async () => {
      const session = await createChatSession(projectId, '新对话');
      if (session.success) {
        setSessionId(session.sessionId);
        const history = await getChatHistory(session.sessionId);
        if (history.success) {
          setMessages(history.messages);
        }
      }
    };

    init();

    wsRef.current = connectWebSocket(projectId, {
      onConnected: () => console.log('✅ WebSocket connected'),
      onDisconnected: () => console.log('🔌 WebSocket disconnected'),
      onCanvasEvent: (event) => {
        console.log('🎨 Canvas event:', event);
      },
      onOperationProgress: (progress) => {
        console.log('⚙️ Operation progress:', progress);
      },
      onError: (error) => console.error('❌ WebSocket error:', error)
    });

    return () => {
      wsRef.current?.close();
    };
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      type: 'text',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendMessage(projectId, inputValue, sessionId);
      
      if (response.success) {
        if (response.type === 'plan_confirmation') {
          setPendingPlan({
            ...response.plan!,
            planNodeId: response.planNodeId!,
            sessionId: response.sessionId!
          });
          
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            type: 'plan_confirmation',
            content: response.message!,
            timestamp: Date.now(),
            metadata: {
              planNodeId: response.planNodeId,
              intentNodeId: response.intentNodeId
            }
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            type: response.type as any,
            content: response.message || '操作完成！',
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else {
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          type: 'error',
          content: response.error || '请求失败，请稍后重试',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('❌ Send message error:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        type: 'error',
        content: '请求失败，请稍后重试',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingPlan) return;
    
    const executingMessage: Message = {
      id: `system_${Date.now()}`,
      role: 'system',
      type: 'operation_log',
      content: '🚀 开始执行计划...',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, executingMessage]);
    setPendingPlan(null);
    setIsLoading(true);

    try {
      const response = await executePlan(pendingPlan.planNodeId, projectId, pendingPlan.sessionId);
      
      if (response.success) {
        const successMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          type: 'text',
          content: response.summary || '执行完成！',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, successMessage]);
      } else {
        const errorMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          type: 'error',
          content: response.error || '执行失败',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('❌ Execute plan error:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        type: 'error',
        content: '执行失败，请稍后重试',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingPlan) return;
    
    const cancelingMessage: Message = {
      id: `system_${Date.now()}`,
      role: 'system',
      type: 'operation_log',
      content: '取消执行...',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, cancelingMessage]);
    
    try {
      await cancelPlan(pendingPlan.planNodeId, projectId, pendingPlan.sessionId);
      const canceledMessage: Message = {
        id: `system_${Date.now()}`,
        role: 'system',
        type: 'operation_log',
        content: '❌ 已取消执行',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, canceledMessage]);
    } catch (error) {
      console.error('❌ Cancel plan error:', error);
    }
    
    setPendingPlan(null);
  };

  return (
    <div className="copilot-chat">
      <div className="chat-header">
        <RobotOutlined className="chat-icon" />
        <div className="chat-title">
          <Text strong>Copilot Agent</Text>
          <Text type="secondary">智能助手</Text>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <InfoCircleOutlined className="empty-icon" />
            <Paragraph>
              你好！我是你的智能视频创作助手。告诉我你想要什么，我来帮你完成！
            </Paragraph>
            <div className="suggestions">
              <Tag color="blue" onClick={() => setInputValue('帮我生成一个破壁机的短视频')}>
                帮我生成一个破壁机的短视频
              </Tag>
              <Tag color="green" onClick={() => setInputValue('现在状态如何')}>
                现在状态如何
              </Tag>
              <Tag color="orange" onClick={() => setInputValue('把第2个分镜改成特写')}>
                把第2个分镜改成特写
              </Tag>
            </div>
          </div>
        )}

        <div className="messages-list">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {pendingPlan && (
        <div className="plan-confirmation">
          <Card
            size="small"
            className="plan-card"
            title={
              <div className="plan-header">
                <RobotOutlined /> 执行计划确认
              </div>
            }
          >
            <Paragraph>
              <Text>我将执行以下 {pendingPlan.steps.length} 个操作：</Text>
            </Paragraph>
            <List
              size="small"
              dataSource={pendingPlan.steps}
              renderItem={(step, index) => (
                <List.Item>
                  <Tag color="blue">{index + 1}</Tag>
                  <Text>{step.description}</Text>
                  <Tag>{step.agent}</Tag>
                </List.Item>
              )}
            />
            <Paragraph>
              <Text type="secondary">
                预计耗时: {Math.ceil(pendingPlan.estimatedDuration / 60)} 分钟
              </Text>
            </Paragraph>
            <div className="plan-actions">
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleConfirm}
                loading={isLoading}
              >
                确认执行
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleCancel}
                disabled={isLoading}
              >
                取消
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="input-area">
        <TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入指令，如：帮我生成一个破壁机的短视频"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={isLoading}
          showCount
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          loading={isLoading}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const getIcon = () => {
    switch (message.role) {
      case 'user':
        return <UserOutlined />;
      case 'assistant':
        return <RobotOutlined />;
      case 'system':
        return <LoadingOutlined />;
    }
  };

  const getClassName = () => {
    let cls = `message ${message.role}`;
    if (message.type === 'error') cls += ' error';
    if (message.type === 'operation_log') cls += ' operation';
    if (message.type === 'plan_confirmation') cls += ' plan';
    return cls;
  };

  return (
    <div className={getClassName()}>
      <div className="message-icon">{getIcon()}</div>
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        {message.metadata?.videoUrl && (
          <div className="message-attachment">
            <video src={message.metadata.videoUrl} controls width="100%" height="150" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotChat;
