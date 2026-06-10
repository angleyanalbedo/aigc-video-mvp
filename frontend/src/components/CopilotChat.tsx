import React, { useState, useRef, useEffect } from 'react';
import {
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RobotOutlined,
  UserOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
  FileOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  RightOutlined,
  HistoryOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Input, Spin, List, Card, Tag, Typography, Upload, message, Timeline, Image } from 'antd';
import {
  sendMessage,
  executePlan,
  cancelPlan,
  getChatHistory,
  getChatSessions,
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
  activeSessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
  onNodesChanged?: (nodes: any[]) => void;
  onConnectionsChanged?: (connections: any[]) => void;
}

const mergeMessage = (prev: Message[], newMsg: Message): Message[] => {
  // 1. Check if exact ID already exists
  if (prev.some(m => m.id === newMsg.id)) {
    return prev;
  }

  // 2. Check for content + role duplicates (especially with temp IDs)
  const duplicateIdx = prev.findIndex(m => 
    m.role === newMsg.role && 
    m.content === newMsg.content && 
    (m.id.startsWith('user_') || m.id.startsWith('assistant_') || m.id.startsWith('system_'))
  );

  if (duplicateIdx !== -1) {
    // Replace the temporary message with the official broadcasted one
    const updated = [...prev];
    updated[duplicateIdx] = newMsg;
    return updated;
  }

  // Also check if there's any identical content/role that was just added recently (e.g. within 8 seconds)
  const timeDifferenceThreshold = 8000; // 8 seconds
  const recentDuplicate = prev.some(m =>
    m.role === newMsg.role &&
    m.content === newMsg.content &&
    Math.abs(m.timestamp - newMsg.timestamp) < timeDifferenceThreshold
  );

  if (recentDuplicate) {
    return prev;
  }

  return [...prev, newMsg];
};

// Define types for grouping consecutive logs
type GroupedMessageItem =
  | {
      type: 'single';
      message: Message;
    }
  | {
      type: 'trace';
      id: string;
      steps: Message[];
      status: 'executing' | 'completed' | 'failed';
    };

// Grouping consecutive operation logs and error messages
const groupMessages = (msgs: Message[], isLoading: boolean): GroupedMessageItem[] => {
  const grouped: GroupedMessageItem[] = [];
  let currentTrace: Message[] = [];

  const pushCurrentTrace = (isLastGroup: boolean) => {
    if (currentTrace.length > 0) {
      let status: 'executing' | 'completed' | 'failed' = 'completed';

      const hasError = currentTrace.some(m => m.type === 'error' || m.content.includes('失败') || m.content.includes('❌'));

      // 只有最后一组 trace 且仍在加载中才显示 executing，其余一律 completed
      if (hasError) {
        status = 'failed';
      } else if (isLastGroup && isLoading) {
        status = 'executing';
      } else {
        status = 'completed';
      }

      grouped.push({
        type: 'trace',
        id: `trace_${currentTrace[0].id}`,
        steps: [...currentTrace],
        status
      });
      currentTrace = [];
    }
  };

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    const isLog = msg.type === 'operation_log' || msg.type === 'error' || msg.role === 'system';

    if (isLog) {
      currentTrace.push(msg);
    } else {
      pushCurrentTrace(false);
      grouped.push({
        type: 'single',
        message: msg
      });
    }
  }

  pushCurrentTrace(true);
  return grouped;
};

const CopilotChat: React.FC<CopilotChatProps> = ({ 
  projectId, 
  activeSessionId, 
  onSessionCreated, 
  onNodesChanged, 
  onConnectionsChanged 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const [pendingPlan, setPendingPlan] = useState<Plan & { planNodeId: string, sessionId: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(activeSessionId || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Upload state management
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    type: 'image' | 'video' | 'file';
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // History panel state
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const result = await getChatSessions(projectId);
      if (result.success) {
        setSessions(result.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSwitchSession = async (newSessionId: string) => {
    if (newSessionId === sessionId) {
      setShowHistory(false);
      return;
    }
    setSessionId(newSessionId);
    setMessages([]);
    isLoadingRef.current = false;
    setIsLoading(false);
    setPendingPlan(null);
    setShowHistory(false);

    const history = await getChatHistory(newSessionId);
    if (history.success) {
      const normalizedHistory = history.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        type: m.type || m.messageType || 'text',
        content: m.content,
        timestamp: m.timestamp || m.createdAt || Date.now(),
        metadata: m.metadata
      }));
      setMessages(normalizedHistory);
    }

    if (onSessionCreated) {
      onSessionCreated(newSessionId);
    }
  };

  const handleNewSession = async () => {
    const session = await createChatSession(projectId, '新对话');
    if (session.success) {
      setSessionId(session.sessionId);
      setMessages([]);
      setPendingPlan(null);
      setShowHistory(false);
      if (onSessionCreated) {
        onSessionCreated(session.sessionId);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      let currentSessionId = activeSessionId;
      
      if (!currentSessionId) {
        const session = await createChatSession(projectId, '新对话');
        if (session.success) {
          currentSessionId = session.sessionId;
          if (onSessionCreated) {
            onSessionCreated(session.sessionId);
          }
        }
      }

      if (currentSessionId) {
        setSessionId(currentSessionId);
        const history = await getChatHistory(currentSessionId);
        if (history.success) {
          const normalizedHistory = history.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            type: m.type || m.messageType || 'text',
            content: m.content,
            timestamp: m.timestamp || m.createdAt || Date.now(),
            metadata: m.metadata
          }));
          setMessages(normalizedHistory);
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
      onChatMessage: (message) => {
        console.log('💬 WS Chat message received:', message);
        const normalizedMsg: Message = {
          id: message.id,
          role: message.role as any,
          type: (message.type || (message as any).messageType || 'text') as any,
          content: message.content,
          timestamp: message.timestamp || (message as any).createdAt || Date.now(),
          metadata: message.metadata
        };

        setMessages(prev => mergeMessage(prev, normalizedMsg));

        // assistant 的 text 类型消息是最终回答 → 结束 loading
        if (normalizedMsg.role === 'assistant' && normalizedMsg.type === 'text') {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      },
      onError: (error) => console.error('❌ WebSocket error:', error)
    });

    return () => {
      wsRef.current?.close();
    };
  }, [projectId, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle uploading change
  const handleUploadChange = (info: any) => {
    if (info.file.status === 'uploading') {
      setUploading(true);
      return;
    }
    if (info.file.status === 'done') {
      setUploading(false);
      const response = info.file.response;
      if (response && response.success) {
        const fileUrl = response.url;
        const fileName = info.file.name;
        let fileType: 'image' | 'video' | 'file' = 'file';
        if (info.file.type?.startsWith('image/')) {
          fileType = 'image';
        } else if (info.file.type?.startsWith('video/')) {
          fileType = 'video';
        }
        setUploadedFile({ url: fileUrl, name: fileName, type: fileType });
        message.success('文件上传成功！');
      } else {
        message.error('文件上传失败，服务器错误');
      }
    } else if (info.file.status === 'error') {
      setUploading(false);
      message.error('文件上传失败，网络错误');
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !uploadedFile) || isLoadingRef.current || !sessionId) return;

    const userMetadata = uploadedFile
      ? {
          fileUrl: uploadedFile.url,
          fileName: uploadedFile.name,
          fileType: uploadedFile.type
        }
      : undefined;

    const tempContent = inputValue.trim() || `[已上传${uploadedFile ? (uploadedFile.type === 'image' ? '图片' : uploadedFile.type === 'video' ? '视频' : '文件') : '附件'}]`;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      type: 'text',
      content: tempContent,
      timestamp: Date.now(),
      metadata: userMetadata
    };

    setMessages(prev => mergeMessage(prev, userMessage));
    setInputValue('');
    setUploadedFile(null);
    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const response = await sendMessage(projectId, tempContent, sessionId, userMetadata);

      if (response.success) {
        if (response.type === 'plan_confirmation') {
          // 计划确认需要用户交互，结束 loading
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
          setMessages(prev => mergeMessage(prev, assistantMessage));
          isLoadingRef.current = false;
          setIsLoading(false);
        }
        // 普通 chat 消息：不清 loading，等 WebSocket 推送最终回答时再清
      } else {
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          type: 'error',
          content: response.error || '请求失败，请稍后重试',
          timestamp: Date.now()
        };
        setMessages(prev => mergeMessage(prev, errorMessage));
        isLoadingRef.current = false;
        setIsLoading(false);
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
      setMessages(prev => mergeMessage(prev, errorMessage));
      isLoadingRef.current = false;
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
    setMessages(prev => mergeMessage(prev, executingMessage));
    setPendingPlan(null);
    isLoadingRef.current = true;
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
        setMessages(prev => mergeMessage(prev, successMessage));
      } else {
        const errorMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          type: 'error',
          content: response.error || '执行失败',
          timestamp: Date.now()
        };
        setMessages(prev => mergeMessage(prev, errorMessage));
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
      setMessages(prev => mergeMessage(prev, errorMessage));
    } finally {
      isLoadingRef.current = false;
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
    setMessages(prev => mergeMessage(prev, cancelingMessage));
    
    try {
      await cancelPlan(pendingPlan.planNodeId, projectId, pendingPlan.sessionId);
      const canceledMessage: Message = {
        id: `system_${Date.now()}`,
        role: 'system',
        type: 'operation_log',
        content: '❌ 已取消执行',
        timestamp: Date.now()
      };
      setMessages(prev => mergeMessage(prev, canceledMessage));
    } catch (error) {
      console.error('❌ Cancel plan error:', error);
    }
    
    setPendingPlan(null);
  };

  const groupedItems = groupMessages(messages, isLoading);

  return (
    <div className="copilot-chat">
      <div className="chat-header">
        <RobotOutlined className="chat-icon" />
        <div className="chat-title">
          <Text strong>Copilot Agent</Text>
          <Text type="secondary">智能创作助手</Text>
        </div>
        <Button
          type="text"
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => {
            if (!showHistory) loadSessions();
            setShowHistory(!showHistory);
          }}
          style={{ marginLeft: 'auto', color: showHistory ? '#6366f1' : 'var(--text-secondary)' }}
          title="历史对话"
        />
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="history-panel" style={{
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-color)',
          maxHeight: 280,
          overflowY: 'auto',
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12, color: 'var(--text-secondary)' }}>历史对话</Text>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleNewSession}
              style={{ fontSize: 11, height: 24, background: '#6366f1', border: 'none' }}
            >
              新对话
            </Button>
          </div>
          {loadingSessions ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin size="small" />
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>
              暂无历史对话
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleSwitchSession(s.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: s.id === sessionId ? 'rgba(99,102,241,0.12)' : 'transparent',
                    border: s.id === sessionId ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (s.id !== sessionId) e.currentTarget.style.background = 'var(--hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    if (s.id !== sessionId) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: s.id === sessionId ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.title || '未命名对话'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {new Date(s.updatedAt).toLocaleDateString()} {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {s.id === sessionId && (
                    <CheckCircleOutlined style={{ fontSize: 12, color: '#6366f1', flexShrink: 0, marginLeft: 8 }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <InfoCircleOutlined className="empty-icon" />
            <Paragraph>
              你好！我是你的智能视频创作助手。上传商品图、写段脚本或者上传素材，我都能全自动为您进行深度创作与编辑！
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
          {groupedItems.map(item => {
            if (item.type === 'single') {
              return <MessageBubble key={item.message.id} message={item.message} />;
            } else {
              return <TracePanel key={item.id} trace={item} />;
            }
          })}
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

      {uploadedFile && (
        <div className="pending-upload-bar">
          <div className="pending-upload-item">
            {uploadedFile.type === 'image' && <PictureOutlined className="file-icon img" />}
            {uploadedFile.type === 'video' && <PlayCircleOutlined className="file-icon video" />}
            {uploadedFile.type === 'file' && <FileOutlined className="file-icon file" />}
            <span className="file-name" title={uploadedFile.name}>{uploadedFile.name}</span>
            <Button
              type="text"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              size="small"
              className="delete-upload"
              onClick={() => setUploadedFile(null)}
            />
          </div>
        </div>
      )}

      <div className="input-area">
        <Upload
          action="/api/upload"
          name="file"
          showUploadList={false}
          disabled={isLoading || uploading}
          onChange={handleUploadChange}
          className="chat-uploader"
        >
          <Button
            shape="circle"
            icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
            disabled={isLoading || uploading}
            title="上传素材 (图片/视频/文件)"
          />
        </Upload>
        <TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入创作指令，或直接发送文件上传..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={isLoading || uploading}
          showCount
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={(!inputValue.trim() && !uploadedFile) || isLoading || uploading}
          loading={isLoading}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

// Unified step-by-step collapse trace renderer
const TracePanel: React.FC<{
  trace: { id: string; steps: Message[]; status: 'executing' | 'completed' | 'failed' };
}> = ({ trace }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusHeader = () => {
    switch (trace.status) {
      case 'failed':
        return {
          text: '创作遇到一些小问题',
          color: '#ff4d4f',
          icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          tagColor: 'error'
        };
      case 'executing':
        return {
          text: 'AI 正在自主思考并执行创作任务',
          color: '#1890ff',
          icon: <LoadingOutlined style={{ color: '#1890ff' }} />,
          tagColor: 'processing'
        };
      case 'completed':
      default:
        return {
          text: 'AI 已成功执行相关步骤',
          color: '#52c41a',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          tagColor: 'success'
        };
    }
  };

  const header = getStatusHeader();

  return (
    <div className={`message system trace-message ${trace.status}`}>
      <div className="message-icon system-icon">
        <RobotOutlined style={{ color: header.color }} />
      </div>
      <div className="message-content trace-content">
        <div className="trace-header" onClick={() => setIsExpanded(!isExpanded)}>
          <span className="trace-header-icon">{header.icon}</span>
          <span className="trace-header-text">{header.text}</span>
          <Tag color={header.tagColor} className="trace-header-count">
            {trace.steps.length} 步
          </Tag>
          <RightOutlined className={`trace-toggle-arrow ${isExpanded ? 'expanded' : ''}`} />
        </div>

        {isExpanded && (
          <div className="trace-steps-container">
            <Timeline className="trace-timeline">
              {trace.steps.map((step, idx) => {
                let dotIcon = <InfoCircleOutlined />;
                let dotColor = 'blue';

                if (step.type === 'error' || step.content.includes('失败') || step.content.includes('❌')) {
                  dotIcon = <CloseCircleOutlined style={{ fontSize: '14px', color: '#ff4d4f' }} />;
                  dotColor = 'red';
                } else if (step.content.includes('思考') || step.content.includes('🧠')) {
                  dotIcon = <RobotOutlined style={{ fontSize: '14px', color: '#1890ff' }} />;
                  dotColor = 'blue';
                } else if (step.content.includes('📋')) {
                  // 工具结果 — 有 ✅ 则绿色，否则蓝色（已完成但无明确状态）
                  if (step.content.includes('✅') || step.content.includes('成功') || step.content.includes('完成')) {
                    dotIcon = <CheckCircleOutlined style={{ fontSize: '14px', color: '#52c41a' }} />;
                    dotColor = 'green';
                  } else {
                    dotIcon = <CheckCircleOutlined style={{ fontSize: '14px', color: '#1890ff' }} />;
                    dotColor = 'blue';
                  }
                } else if (step.content.includes('⚙️')) {
                  // 工具调用 — 如果后面已经有 📋 结果了就显示对勾，否则转圈
                  const hasResultAfter = trace.steps.slice(idx + 1).some(s => s.content.includes('📋'));
                  if (hasResultAfter) {
                    dotIcon = <CheckCircleOutlined style={{ fontSize: '14px', color: '#52c41a' }} />;
                    dotColor = 'green';
                  } else {
                    dotIcon = <LoadingOutlined style={{ fontSize: '14px', color: '#1890ff' }} />;
                    dotColor = 'blue';
                  }
                }

                return (
                  <Timeline.Item key={step.id} dot={dotIcon} color={dotColor}>
                    <div className="timeline-step-content">
                      <div className="step-text">{step.content}</div>
                      <div className="step-time">
                        {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </div>
        )}
      </div>
    </div>
  );
};

// Rich bubble message rendering with visual attachments card
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

  const meta = message.metadata;

  return (
    <div className={getClassName()}>
      <div className="message-icon">{getIcon()}</div>
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        
        {/* Render Image Attachment */}
        {meta?.fileUrl && meta?.fileType === 'image' && (
          <div className="message-attachment image-attachment">
            <Image
              src={meta.fileUrl}
              alt={meta.fileName || '图片附件'}
              style={{ borderRadius: '8px', maxHeight: '180px', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Render Video Attachment (from direct uploads or metadata.videoUrl) */}
        {((meta?.fileUrl && meta?.fileType === 'video') || meta?.videoUrl) && (
          <div className="message-attachment video-attachment">
            <video
              src={meta?.fileUrl || meta?.videoUrl}
              controls
              style={{ borderRadius: '8px', maxWidth: '100%', maxHeight: '200px', background: '#000' }}
            />
          </div>
        )}

        {/* Render Document/General File Attachment */}
        {meta?.fileUrl && meta?.fileType === 'file' && (
          <div className="message-attachment file-card">
            <FileOutlined className="file-card-icon" />
            <div className="file-card-details">
              <span className="file-card-name" title={meta.fileName}>
                {meta.fileName}
              </span>
              <a
                href={meta.fileUrl}
                download={meta.fileName}
                className="file-card-download"
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadOutlined /> 下载文件
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotChat;
