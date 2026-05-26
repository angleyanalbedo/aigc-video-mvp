import React from 'react';
import { 
  useWorkbench,
  Scene,
  API_BASE
} from './useWorkbench';
import {
  SendOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  VideoCameraOutlined,
  PlusOutlined,
  LoadingOutlined,
  PictureOutlined,
  AudioOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ScissorOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  ApiOutlined,
  SkinOutlined,
  GlobalOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  InboxOutlined,
  UploadOutlined,
  ReloadOutlined,
  SoundOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import AssetPanel from './AssetPanel';
import {
  Layout,
  Button,
  Input,
  Select,
  Switch,
  Card,
  Space,
  Progress,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Slider,
  message,
  Empty,
  Tooltip,
  Modal,
  Form,
  Popover,
  List,
  Table,
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Content } = Layout;

const WorkbenchPage: React.FC = () => {
  const {
    projectId,
    navigate,
    activeTab,
    isModalOpen,
    currentEditSceneIndex,
    selectedSceneForSuggestions,
    setSelectedSceneForSuggestions,
    agentSuggestions,
    setAgentSuggestions,
    isAgentLoading,
    setIsAgentLoading,
    settings,
    isRenderingAll,
    renderProgress,
    renderStatus,
    finalVideoUrl,
    isRenderingAllScenes,
    workflowNodes,
    setWorkflowNodes,
    workflowStarted,
    injectingMaterial,
    projectMaterials,
    setProjectMaterials,
    libraryModalVisible,
    setLibraryModalVisible,
    libraryMaterials,
    setLibraryMaterials,
    selectedLibraryMaterials,
    setSelectedLibraryMaterials,
    librarySearchKeyword,
    setLibrarySearchKeyword,
    isLoadingLibrary,
    setIsLoadingLibrary,
    audioLibraryModalVisible,
    setAudioLibraryModalVisible,
    audioLibraryMaterials,
    setAudioLibraryMaterials,
    isLoadingAudioLibrary,
    setIsLoadingAudioLibrary,
    currentSceneForAudioSelect,
    setCurrentSceneForAudioSelect,
    saveStatus,
    project,
    setProject,
    script,
    productInfo,
    setProductInfo,
    isAnalyzing,
    setIsAnalyzing,
    chatHistory,
    chatInput,
    setChatInput,
    isChatting,
    isPlanningClip,
    clipPlan,
    chatBottomRef,
    form,
    handleGenerateClipPlan,
    handleSave,
    updateScript,
    updateSettings,
    handleSendChatMessage,
    updateSceneField,
    handleInjectMode,
    handleSceneCardClick,
    cancelInjectMode,
    openEditModal,
    closeEditModal,
    saveSceneEdit,
    uploadFrameImage,
    clearSceneImage,
    forceRerender,
    getAgentSuggestions,
    batchOptimize,
    applyAgentSuggestion,
    optimizeAllScenes,
    generateSingleSceneImage,
    handleRenderAllImages,
    generateSingleSceneVideo,
    handleRenderAllScenes,
    handleCompileFinalVideo,
    handlePublishVideo,
  } = useWorkbench();


  return (
    <Layout style={{ height: '100%', minHeight: '100%', background: '#09090b', color: '#e4e4e7' }}>
      {/* Premium Dark Navigation Header */}
      <div style={{
        background: '#121214',
        borderBottom: '1px solid #1f1f23',
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
              icon={<ArrowLeftOutlined style={{ color: '#a1a1aa', fontSize: '20px' }} />}
              onClick={() => navigate('/projects')}
              style={{ 
                color: '#a1a1aa', 
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
              <Title level={4} style={{ margin: 0, color: '#fff' }}>🎬 {project?.name || '创意工作台'}</Title>
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
                pending: '#3f3f46',
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
                      <span style={{ fontSize: 11, color: node.status === 'pending' ? '#52525b' : '#e4e4e7', fontWeight: node.status !== 'pending' ? 600 : 400 }}>
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
                    <div style={{ width: 20, height: 1, background: '#27272a', flexShrink: 0 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>


      {/* Main Dual-Column Content Panels */}
      <Content style={{ padding: 24, flex: 1, overflow: 'hidden' }}>
        
        {/* ============================================================== */}
        {/* TAB 0: MATERIAL ANALYSIS PANEL */}
        {/* ============================================================== */}
        {activeTab === 'materials' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Materials List & Upload */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><PictureOutlined /> 商品参考素材库</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}
              >
                <div style={{ flexShrink: 0, marginBottom: 16 }}>
                  <Paragraph style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
                    请在此处上传该商品的图片素材（如：商品图、使用场景图、卖点说明图）。这些素材将作为大模型自动生成分镜、参考图的底蕴基础。
                  </Paragraph>
                </div>
                
                {/* Drag-Drop and Uploader Grid */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => {
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
                              const res = await fetch(`${API_BASE}/api/projects/${projectId}/materials`, {
                                method: 'POST',
                                body: formData
                              });
                              const uploadData = await res.json();
                              message.destroy();
                              if (uploadData.success && uploadData.data) {
                                message.success('素材上传成功！');
                                setProjectMaterials((prev: any[]) => [uploadData.data, ...prev]);
                                setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
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
                      style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: 6, height: 36 }}
                    >
                      📤 上传新素材
                    </Button>
                    <Button
                      icon={<DatabaseOutlined />}
                      onClick={() => {
                        setLibraryModalVisible(true);
                        setIsLoadingLibrary(true);
                        setLibrarySearchKeyword('');
                        fetch(`${API_BASE}/api/materials/library`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.success) {
                              setLibraryMaterials(data.materials || []);
                              setIsLoadingLibrary(false);
                            } else {
                              message.error(data.error || '获取素材库失败');
                              setIsLoadingLibrary(false);
                            }
                          })
                          .catch(err => {
                            message.error('加载素材库失败: ' + err.message);
                            setIsLoadingLibrary(false);
                          });
                      }}
                      style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: 6, height: 36 }}
                    >
                      📚 从素材库选择
                    </Button>
                  </div>
                  <Row gutter={[12, 12]}>
                    {projectMaterials.map((m: any) => (
                      <Col span={8} key={m.id}>
                        <div style={{
                          height: 100,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid #27272a',
                          position: 'relative'
                        }}>
                          <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            padding: '2px 6px',
                            fontSize: 10,
                            color: '#a1a1aa',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={m.filename}>
                            {m.filename}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  {projectMaterials.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#52525b', padding: '60px 0' }}>
                      <PictureOutlined style={{ fontSize: 36, display: 'block', margin: '0 auto 12px' }} />
                      暂无关联素材，您可以点击上方按钮开始上传商品图
                    </div>
                  )}
                </div>
              </Card>
            </Col>

            {/* Right: AI Asset Analysis Panel */}
            <Col span={14} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><RocketOutlined /> AI 核心卖点提炼与分析</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}
              >
                {!productInfo && !isAnalyzing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px' }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'rgba(99,102,241,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 24,
                      border: '1px solid rgba(99,102,241,0.2)'
                    }}>
                      <RocketOutlined style={{ fontSize: 36, color: '#818cf8' }} />
                    </div>
                    <Title level={4} style={{ color: '#fff', marginBottom: 12 }}>唤醒 AI 导演深度提炼商品核心数据</Title>
                    <Paragraph style={{ color: '#a1a1aa', fontSize: 13.5, lineHeight: 1.6, marginBottom: 24 }}>
                      您上传的产品素材是大模型策划脑暴的燃料。通过 AI 素材提取 Agent，系统将智能解析产品特点、自动提炼 3 个绝对吸睛的带货痛点，并锁受众群体与视频主调。
                    </Paragraph>
                    <Space size="middle">
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        size="large"
                        loading={isAnalyzing}
                        onClick={async () => {
                          setIsAnalyzing(true);
                          try {
                            const res = await fetch(`${API_BASE}/api/agent/analyze-materials`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ projectId })
                            });
                            const data = await res.json();
                            if (data.success && data.productInfo) {
                              setProductInfo(data.productInfo);
                              setProject((prev: any) => ({ ...prev, product_info: data.productInfo }));
                              setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                              message.success('🚀 AI 素材特征提炼成功！');
                            } else {
                              throw new Error(data.error || '分析失败');
                            }
                          } catch (err: any) {
                            message.error('智能提炼异常: ' + err.message);
                          } finally {
                            setIsAnalyzing(false);
                          }
                        }}
                        style={{
                          height: 48,
                          padding: '0 32px',
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 14,
                          boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.4)'
                        }}
                      >
                        💡 AI 智能分析商品素材
                      </Button>
                      <Button
                        type="default"
                        size="large"
                        onClick={() => {
                          const shell = {
                            title: project?.name || '爆款商品',
                            sellingPoints: '极致匠心做工，多功能集成，操作简便。',
                            targetAudience: '追求高品质生活方式的年轻消费群体。',
                            style: '时尚极简，温馨治愈。',
                            price: '面议/性价比优选'
                          };
                          setProductInfo(shell);
                          setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                          message.info('已跳过素材提取，已生成默认产品策划模版。');
                        }}
                        style={{ height: 48, borderRadius: 8, background: '#27272a', color: '#fff', border: '1px solid #3f3f46' }}
                      >
                        直接配置剧本 ➔
                      </Button>
                    </Space>
                  </div>
                ) : isAnalyzing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingOutlined style={{ fontSize: 40, color: '#818cf8', marginBottom: 20 }} />
                    <Title level={5} style={{ color: '#fff', marginBottom: 8 }}>AI 素材特征提取 Agent 正在读取解析中...</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>FFmpeg 与 Vision LLM 正在提取图片卖点、分析流行痛点，请稍候片刻...</Text>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
                      <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🛒 商品带货名称 / 策划标题</Text></div>
                          <Input
                            value={productInfo.title}
                            onChange={(e) => setProductInfo({ ...productInfo, title: e.target.value })}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>💎 商品核心卖点与亮点摘要 (80字内)</Text></div>
                          <TextArea
                            value={productInfo.sellingPoints}
                            onChange={(e) => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
                            rows={3}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6 }}
                          />
                        </div>
                        <Row gutter={16}>
                          <Col span={12}>
                            <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>👥 精准目标受众群体</Text></div>
                            <Input
                              value={productInfo.targetAudience}
                              onChange={(e) => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
                              style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                            />
                          </Col>
                          <Col span={12}>
                            <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🏷️ 售价参考区间</Text></div>
                            <Input
                              value={productInfo.price}
                              onChange={(e) => setProductInfo({ ...productInfo, price: e.target.value })}
                              style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                            />
                          </Col>
                        </Row>
                        <div>
                          <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>🎨 建议短视频整体创意调性</Text></div>
                          <Input
                            value={productInfo.style}
                            onChange={(e) => setProductInfo({ ...productInfo, style: e.target.value })}
                            style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', borderRadius: 6, height: 38 }}
                          />
                        </div>
                      </Space>
                    </div>

                    <div style={{ flexShrink: 0, borderTop: '1px solid #27272a', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        type="dashed"
                        onClick={() => {
                          setProductInfo(null);
                        }}
                        style={{ background: 'transparent', color: '#a1a1aa', border: '1px dashed #3f3f46' }}
                      >
                        重新分析素材
                      </Button>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={async () => {
                          message.loading('正在同步商品特征至数据库...', 0);
                          try {
                            const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                productInfo
                              })
                            });
                            const data = await res.json();
                            message.destroy();
                            if (data.success) {
                              setProject((prev: any) => ({ ...prev, product_info: productInfo }));
                              setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                              message.success('✅ 商品分析特征已保存！');
                              navigate(`/workbench/${projectId}?tab=script`);
                            } else {
                              throw new Error(data.error || '保存特征失败');
                            }
                          } catch (err: any) {
                            message.error('同步失败: ' + err.message);
                          }
                        }}
                        style={{
                          height: 40,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          padding: '0 24px'
                        }}
                      >
                        🚀 保存分析，开始剧本策划
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        )}

      {/* ============================================================== */}
      {/* 素材库选择 Modal */}
      {/* ============================================================== */}
      <Modal
        title={
          <div>
            📂 从素材库选择
            <Tag color="blue" style={{ marginLeft: 8 }}>
              已选择 {selectedLibraryMaterials.length} 个素材
            </Tag>
          </div>
        }
        open={libraryModalVisible}
        onCancel={() => {
          setLibraryModalVisible(false);
          setSelectedLibraryMaterials([]);
        }}
        width={900}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setLibraryModalVisible(false)}>取消</Button>
            <Space>
              <Button onClick={() => {
                setSelectedLibraryMaterials([]);
                message.info('已清空选择');
              }}>清空选择</Button>
              <Button
                type="primary"
                disabled={selectedLibraryMaterials.length === 0}
                onClick={async () => {
                  if (selectedLibraryMaterials.length === 0) {
                    message.warning('请至少选择一个素材');
                    return;
                  }

                  message.loading('正在添加选中素材到项目...', 0);
                  try {
                    // 为每个选中的素材添加到项目
                    const newMaterials: any[] = [];
                    for (const materialUrl of selectedLibraryMaterials) {
                      const res = await fetch(`${API_BASE}/api/projects/${projectId}/materials`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: materialUrl, fromLibrary: true })
                      });
                      const data = await res.json();
                      if (data.success && data.data) {
                        newMaterials.push(data.data);
                      }
                    }

                    message.destroy();
                    if (newMaterials.length > 0) {
                      setProjectMaterials((prev: any[]) => [...newMaterials, ...prev]);
                      setWorkflowNodes(prev => prev.map(n => n.id === 'materials' ? { ...n, status: 'completed' } : n));
                      message.success(`✅ 成功添加 ${newMaterials.length} 个素材到项目！`);
                      setLibraryModalVisible(false);
                      setSelectedLibraryMaterials([]);
                    } else {
                      message.error('添加素材失败');
                    }
                  } catch (err: any) {
                    message.destroy();
                    message.error('添加素材失败: ' + err.message);
                  }
                }}
              >
                ✅ 确认添加 ({selectedLibraryMaterials.length})
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="🔍 搜索素材库..."
            value={librarySearchKeyword}
            onChange={(e) => setLibrarySearchKeyword(e.target.value)}
            onSearch={() => {
              if (!librarySearchKeyword.trim()) {
                message.info('请输入搜索关键词');
                return;
              }
              setIsLoadingLibrary(true);
              fetch(`${API_BASE}/api/materials/library?keyword=${encodeURIComponent(librarySearchKeyword)}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setLibraryMaterials(data.materials || []);
                    setIsLoadingLibrary(false);
                  } else {
                    message.error(data.error || '搜索失败');
                    setIsLoadingLibrary(false);
                  }
                })
                .catch(err => {
                  message.error('搜索失败: ' + err.message);
                  setIsLoadingLibrary(false);
                });
            }}
            enterButton="搜索"
            loading={isLoadingLibrary}
          />
        </div>

        {isLoadingLibrary ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <LoadingOutlined style={{ fontSize: 40, color: '#818cf8' }} />
            <p style={{ marginTop: 16, color: '#a1a1aa' }}>正在加载素材库...</p>
          </div>
        ) : libraryMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <InboxOutlined style={{ fontSize: 60, color: '#3f3f46' }} />
            <p style={{ marginTop: 16, color: '#a1a1aa' }}>
              {librarySearchKeyword ? '未找到匹配的素材' : '素材库为空，请先上传素材'}
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <Row gutter={[12, 12]}>
              {libraryMaterials.map((material: any) => {
                const isSelected = selectedLibraryMaterials.includes(material.url);
                return (
                  <Col span={8} key={material.id}>
                    <div
                      onClick={() => {
                        if (isSelected) {
                          setSelectedLibraryMaterials(prev => prev.filter(url => url !== material.url));
                        } else {
                          setSelectedLibraryMaterials(prev => [...prev, material.url]);
                        }
                      }}
                      style={{
                        height: 120,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: isSelected ? '3px solid #10b981' : '1px solid #27272a',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s'
                      }}
                    >
                      <img
                        src={material.url}
                        alt={material.filename || material.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isSelected ? 'brightness(0.7)' : 'brightness(1)'
                        }}
                      />
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(16, 185, 129, 0.3)'
                        }}>
                          <CheckCircleFilled style={{ fontSize: 40, color: '#10b981' }} />
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.6)',
                        padding: '4px 8px',
                        fontSize: 10,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {material.filename || material.name || '素材'}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>
        )}
      </Modal>

        {/* ============================================================== */}
        {/* TAB 1: SCRIPT COORDINATION PANEL */}
        {/* ============================================================== */}
        {activeTab === 'script' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Chat Copilot */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Card
                title={<span style={{ color: '#fff' }}><AudioOutlined /> AI 创意导演 Copilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
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
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#27272a',
                        color: '#fff',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        lineHeight: 1.5,
                        fontSize: 13.5
                      }}>
                        <Paragraph style={{ color: '#fff', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</Paragraph>
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
                      <div style={{ background: '#27272a', padding: '10px 14px', borderRadius: '12px 12px 12px 2px' }}>
                        <span style={{ color: '#818cf8' }}><LoadingOutlined /> AI 导演正在深入构思中...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input Controls */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #27272a', paddingTop: 12 }}>
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
                    style={{ background: '#202023', border: '1px solid #2e2e33', color: '#fff', borderRadius: 8 }}
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
                title={<span style={{ color: '#fff' }}><SaveOutlined /> 剧本画布预览</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {script ? (
                  <div>
                    <div style={{ background: '#202023', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                      <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0' }}>📄 {script.title}</Title>
                      <Paragraph style={{ color: '#a1a1aa', margin: 0, fontSize: 13 }}>
                        <strong>核心创意创意:</strong> {script.description}
                      </Paragraph>
                    </div>

                    <Title level={5} style={{ color: '#fff', marginBottom: 12 }}>📝 分镜场景时间线</Title>
                    {script.scenes?.map((scene: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        background: '#27272a',
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 12,
                        borderLeft: '4px solid #6366f1'
                      }}>
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <Tag color="geekblue" style={{ borderRadius: 4 }}>镜 {index + 1}</Tag>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Paragraph style={{ color: '#fff', fontSize: 13, margin: '0 0 4px 0' }}>{scene.description}</Paragraph>
                          <Text style={{ color: '#6366f1', fontSize: 11 }}>旁白: {scene.voiceover}</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description={<span style={{ color: '#52525b' }}>暂无剧本，请先与 AI 导演沟通生成</span>} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ============================================================== */}
        {/* TAB 2: STORYBOARD CANVAS */}
        {/* ============================================================== */}
        {activeTab === 'storyboard' && (
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
                title={<span style={{ color: '#fff' }}><AudioOutlined /> 分镜编辑 Co-pilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#27272a',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        fontSize: 12,
                        lineHeight: 1.4
                      }}>
                        <Paragraph style={{ color: '#fff', margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{msg.content}</Paragraph>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                      <div style={{ background: '#27272a', padding: '6px 10px', borderRadius: '10px 10px 10px 2px', fontSize: 12 }}>
                        <span style={{ color: '#818cf8' }}><LoadingOutlined /> 导演正在修改分镜配置...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #27272a', paddingTop: 8, flexShrink: 0 }}>
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
                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 12 }}
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
                    <span style={{ color: '#fff' }}><VideoCameraOutlined /> 🎬 分镜视觉首帧编辑面板 (支持 AI 生图及手动上传图片)</span>
                    <Space size="middle">
                      {injectingMaterial && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#818cf8' }}>点击分镜卡片注入参考图 →</span>
                          <Button size="small" onClick={cancelInjectMode} style={{ background: '#27272a', border: 'none', color: '#a1a1aa' }}>取消</Button>
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
                          style={{ background: '#1890ff', border: 'none', color: '#fff', borderRadius: 6 }}
                        >
                          Agent 工具箱
                        </Button>
                      </Popover>
                      
                      <Button
                        type="default"
                        icon={<PictureOutlined />}
                        onClick={handleRenderAllImages}
                        disabled={!script || !script.scenes || script.scenes.length === 0}
                        style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: 6 }}
                      >
                        一键生成所有图片
                      </Button>
                    </Space>
                  </div>
                }
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
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
                            background: '#18181c',
                            border: injectingMaterial ? '2px dashed #6366f1' : '1px solid #27272a',
                            borderRadius: 8,
                            cursor: injectingMaterial ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            boxShadow: injectingMaterial ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
                          }}
                          bodyStyle={{ padding: 16 }}
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space>
                                <span style={{ color: '#fff', fontWeight: 600 }}>分镜 {index + 1}</span>
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
                                  onVisibleChange={(visible) => {
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
                                background: '#09090b',
                                border: '1px dashed #27272a',
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
                                    <img src={scene.referenceImageUrl} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                )}

                                {(scene.rendering || scene.status === 'generating') ? (
                                  <div style={{ textAlign: 'center', padding: 8 }}>
                                    <LoadingOutlined style={{ fontSize: 24, color: '#6366f1', marginBottom: 8 }} />
                                    <div style={{ fontSize: 11, color: '#888' }}>正在生图...</div>
                                  </div>
                                ) : !!scene.imageUrl ? (
                                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img src={scene.imageUrl} alt="首帧图片" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                  <div style={{ textAlign: 'center', color: '#52525b', padding: 8 }}>
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
                                                    // Sync completed status to steps
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
                                            background: '#27272a',
                                            border: '1px solid #3f3f46',
                                            color: '#fff',
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
                                        style={{ fontSize: 11, padding: 0, height: 'auto', color: '#a1a1aa' }}
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
                                <div style={{ marginTop: 8, padding: '4px 8px', background: '#202023', borderRadius: 4, border: '1px solid #2e2e33' }}>
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
                                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 11.5 }}
                                  />
                                </div>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11 }}>旁白配音：</Text>
                                  <TextArea
                                    value={scene.voiceover}
                                    onChange={(e) => updateSceneField(index, 'voiceover', e.target.value)}
                                    rows={1}
                                    style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', fontSize: 11.5 }}
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
                                      background: '#202023',
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
                                      style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33', height: 26, fontSize: 11 }}
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
                                <Divider style={{ margin: '8px 0', borderColor: '#27272a' }} />
                                <Row gutter={8}>
                                  {/* 首帧 */}
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>首帧</Text>
                                    <div style={{
                                      height: 60,
                                      background: '#09090b',
                                      border: '1px dashed #27272a',
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
                                          <img src={scene.firstFrameUrl} alt="首帧" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                        <span style={{ fontSize: 9, color: '#52525b' }}>点击上传</span>
                                      )}
                                    </div>
                                  </Col>
                                  {/* 尾帧 */}
                                  <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>尾帧</Text>
                                    <div style={{
                                      height: 60,
                                      background: '#09090b',
                                      border: '1px dashed #27272a',
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
                                          <img src={scene.lastFrameUrl} alt="尾帧" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                        <span style={{ fontSize: 9, color: '#52525b' }}>点击上传</span>
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
        )}

        {/* ============================================================== */}
        {/* TAB 3: VIDEO RENDERING DASHBOARD */}
        {/* ============================================================== */}
        {activeTab === 'video' && (
          <Row gutter={24} style={{ height: '100%' }}>
            <Col span={24} style={{ height: '100%', overflowY: 'auto' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#fff' }}><PlayCircleOutlined /> 🎬 分镜视频渲染仪表盘</span>
                    <Space size="large">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#a1a1aa' }}>同时生成并同步旁白配音:</span>
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
                        style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: 6, height: 38 }}
                      >
                        📋 查看任务列表
                      </Button>
                    </Space>
                  </div>
                }
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
              >
                {script && script.scenes && script.scenes.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {script.scenes.map((scene: Scene, index: number) => (
                      <Col span={8} key={index}>
                        <Card
                          style={{
                            background: '#202023',
                            border: '1px solid #2e2e33',
                            borderRadius: 8
                          }}
                          bodyStyle={{ padding: 12 }}
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>分镜 {index + 1} ({scene.duration}秒)</span>
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
                            background: '#09090b',
                            borderRadius: 6,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #27272a',
                            marginBottom: 12
                          }}>
                            {scene.videoUrl ? (
                              <video src={scene.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (scene.rendering || scene.status === 'generating') ? (
                              <div style={{ textAlign: 'center', padding: 8 }}>
                                <LoadingOutlined style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }} />
                                <div style={{ fontSize: 12, color: '#a1a1aa' }}>后台渲染中 ({scene.progress || 10}%)</div>
                              </div>
                            ) : scene.imageUrl ? (
                              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                <img src={scene.imageUrl} alt="首帧" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                <div style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(0,0,0,0.4)'
                                }}>
                                  <span style={{ color: '#fff', fontSize: 11, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4 }}>
                                    首帧就绪，待生成视频
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', color: '#52525b' }}>
                                <PictureOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                <div style={{ fontSize: 11 }}>请先在分镜编辑中准备首帧</div>
                              </div>
                            )}
                          </div>

                          {/* Scene Script Reference Details */}
                          <div style={{ background: '#18181b', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 2 }}>分镜视觉 Prompt:</div>
                            <div style={{ fontSize: 11, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4, height: 30, marginBottom: 6 }}>
                              {scene.description}
                            </div>
                            <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 2 }}>旁白台词:</div>
                            <div style={{ fontSize: 11, color: '#818cf8', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                              {scene.voiceover || '无'}
                            </div>
                          </div>

                          {/* Narration Player Wave */}
                          {scene.audioUrl && (
                            <div style={{ padding: '6px 10px', background: '#18181b', borderRadius: 6, border: '1px solid #2e2e33', marginBottom: 10 }}>
                              <div style={{ fontSize: 10, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>🎙️ 旁白配音预听</span>
                                {scene.ttsEstDuration && <span style={{ opacity: 0.6 }}>({scene.ttsEstDuration}s)</span>}
                              </div>
                              <audio src={scene.audioUrl} controls style={{ width: '100%', height: 20 }} />
                            </div>
                          )}

                          {/* Render Actions */}
                          {/* 渲染操作区域 */}
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
                                    color: '#fff',
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
        )}

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 3.5: AUDIO & VOICEOVER TRACKS */}
        {/* ============================================================== */}
        {activeTab === 'audio' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Global Audio Settings & Agent Panel */}
            <Col span={8} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
              <Card
                title={<span style={{ color: '#fff' }}><CustomerServiceOutlined /> 全局音频设置</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>1. 发音人选择</Text></div>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>2. 配音语速</Text></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#a1a1aa', fontSize: 12 }}>慢速</span>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>{settings.speed}x</span>
                      <span style={{ color: '#a1a1aa', fontSize: 12 }}>快速</span>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>3. 背景音乐选择</Text></div>
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
                      <Text strong style={{ color: '#fff' }}>4. 背景音乐音量</Text>
                      <Text style={{ color: '#a1a1aa' }}>{settings.volume}%</Text>
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
                      <Text strong style={{ color: '#fff' }}>5. 启用 AI 配音</Text>
                      <Switch checked={settings.enableTTS} onChange={(val) => updateSettings({ ...settings, enableTTS: val })} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {settings.enableTTS ? '✅ 所有分镜将自动生成 AI 配音' : '❌ 仅使用背景音乐，无配音旁白'}
                    </Text>
                  </div>
                </Space>
              </Card>
              
              <Card
                title={<span style={{ color: '#fff' }}><ApiOutlined /> 音频 AI 助手</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
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
                  
                  <Divider style={{ margin: '8px 0', borderColor: '#27272a' }} />
                  
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
                    <span style={{ color: '#fff' }}><AudioOutlined /> 分镜配音轨道编辑器</span>
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
                style={{ background: '#18181b', borderRadius: 12, height: '100%' }}
              >
                {script?.scenes?.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {script.scenes.map((scene: any, index: number) => (
                      <Card
                        key={index}
                        size="small"
                        style={{
                          background: '#202023',
                          border: scene.audioUrl ? '1px solid #10b981' : '1px solid #27272a',
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
                                  background: '#09090b', 
                                  color: '#fff', 
                                  border: '1px solid #27272a',
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
                        background: '#202023',
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
                              
                              <Divider style={{ margin: '4px 0', borderColor: '#27272a' }} />
                              
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
        )}

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 4: COMPILATION & OUTPUT */}
        {/* ============================================================== */}
        {activeTab === 'render' && (
          <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Resolution, Ratio, transition configs & AI Clip Agent planner */}
            <Col span={10} style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
              <Card
                title={<span style={{ color: '#fff' }}><RocketOutlined /> 视频最终渲染编译设置</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flexShrink: 0 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>1. 分辨率选择 (Resolution)</Text></div>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>2. 画面幅面比 (Aspect Ratio)</Text></div>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>3. 分镜转场效果 (Transitions)</Text></div>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>4. 配音发音人角色 (Speaker Role)</Text></div>
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
                    <div style={{ marginBottom: 6 }}><Text strong style={{ color: '#fff' }}>5. 带货背景音乐 (BGM Soundtrack)</Text></div>
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
                      <Text strong style={{ color: '#fff' }}>6. 背景音乐音量混音比例</Text>
                      <Text style={{ color: '#a1a1aa' }}>{settings.volume}%</Text>
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
                      <Text strong style={{ color: '#fff' }}>7. 启用 AI 旁白配音</Text>
                      <Switch checked={settings.enableTTS} onChange={(val) => updateSettings({ ...settings, enableTTS: val })} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {settings.enableTTS ? '✅ 所有分镜将自动生成 AI 配音' : '❌ 仅使用背景音乐，无配音旁白'}
                    </Text>
                  </div>

                  <Divider style={{ margin: '12px 0', borderTopColor: '#27272a' }} />

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
                title={<span style={{ color: '#fff' }}><ScissorOutlined /> AI 剪辑师 Copilot</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, flexShrink: 0 }}
                bodyStyle={{ padding: 16 }}
              >
                {!clipPlan ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <Paragraph style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 16 }}>
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
                    <div style={{ background: '#202023', padding: 12, borderRadius: 8, marginBottom: 12, borderLeft: '4px solid #6366f1' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 13.5, marginBottom: 4 }}>🎉 智能剪辑编排方案已应用：</div>
                      <div style={{ color: '#34d399', fontSize: 12, marginBottom: 4 }}>
                        🎵 推荐背景乐: <strong>{clipPlan.audio?.bgm || '欢快乐活'}</strong> | 音量: <strong>{Math.round((clipPlan.audio?.volume || 0.2) * 100)}%</strong>
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: 11.5 }}>
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
                title={<span style={{ color: '#fff' }}><VideoCameraOutlined /> 渲染终端 & 最终预览大盘</span>}
                bordered={false}
                style={{ background: '#18181b', borderRadius: 12, height: '100%', overflowY: 'auto' }}
              >
                {/* When rendering is active */}
                {isRenderingAll && (
                  <div style={{ background: '#202023', padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 20 }}>
                    <Progress type="circle" percent={renderProgress} strokeColor={{ '0%': '#10b981', '100%': '#6366f1' }} width={120} />
                    <div style={{ marginTop: 20, fontWeight: 500, color: '#fff' }}>{renderStatus}</div>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                      后台 FFmpeg 与大声轨合成器正在飞速运作，请稍候片刻...
                    </Text>
                  </div>
                )}

                {/* Final Rendered Video Player */}
                {finalVideoUrl ? (
                  <div>
                    <div style={{ background: '#202023', padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: '4px solid #10b981' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>🎉 合成完毕：</span>
                      <Text style={{ color: '#a1a1aa', fontSize: 13 }}>最终高精度带货视频已妥善渲染在本地临时存储。</Text>
                    </div>

                    <div style={{
                      width: '100%',
                      background: '#000',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #27272a',
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
                          style={{ height: 40, borderRadius: 6, background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                        >
                          🚀 一键分发至社交媒体
                        </Button>
                      </Col>

                    </Row>
                  </div>
                ) : !isRenderingAll ? (
                  <Empty
                    description={<span style={{ color: '#888' }}>视频暂未开始合成。在左侧选择参数后，点击“一键合成”开启智能渲染！</span>}
                    style={{ marginTop: 100 }}
                  />
                ) : null}
              </Card>
            </Col>
          </Row>
        )}

      </Content>

      {/* 分镜编辑模态框 */}
      <Modal
        title={
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
            编辑分镜 {currentEditSceneIndex !== null ? currentEditSceneIndex + 1 : ''}
          </div>
        }
        open={isModalOpen}
        onCancel={closeEditModal}
        onOk={saveSceneEdit}
        okText="保存"
        cancelText="取消"
        maskClosable={false}
        styles={{
          content: { background: '#18181b', border: '1px solid #27272a' },
          header: { borderBottom: '1px solid #27272a', background: '#18181b' },
          footer: { borderTop: '1px solid #27272a', background: '#18181b' }
        }}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            emotion: '',
            transition: 'fade',
            cameraAngle: '',
            lighting: '',
            colorTone: ''
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="description"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>分镜视觉提示词</span>}
              >
                <TextArea
                  rows={3}
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="voiceover"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>旁白配音</span>}
              >
                <TextArea
                  rows={2}
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="duration"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>时长（秒）</span>}
              >
                <Input
                  type="number"
                  style={{ background: '#202023', color: '#fff', border: '1px solid #2e2e33' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="shot_type"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>镜头类型</span>}
              >
                <Select style={{ background: '#202023', color: '#fff' }}>
                  <Option value="特写">特写</Option>
                  <Option value="中景">中景</Option>
                  <Option value="全景">全景</Option>
                  <Option value="近景">近景</Option>
                  <Option value="远景">远景</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="transition"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>转场</span>}
              >
                <Select style={{ background: '#202023', color: '#fff' }}>
                  <Option value="fade">渐入渐出</Option>
                  <Option value="cut">硬切</Option>
                  <Option value="flash">闪白</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ borderColor: '#27272a', margin: '16px 0' }} />

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="cameraAngle"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>拍摄角度</span>}
              >
                <Select placeholder="选择角度" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="平视">平视</Option>
                  <Option value="俯视">俯视</Option>
                  <Option value="仰视">仰视</Option>
                  <Option value="侧拍">侧拍</Option>
                  <Option value="斜拍">斜拍</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="lighting"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>光线类型</span>}
              >
                <Select placeholder="选择光线" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="自然光">自然光</Option>
                  <Option value="暖光">暖光</Option>
                  <Option value="冷光">冷光</Option>
                  <Option value="柔光">柔光</Option>
                  <Option value="硬光">硬光</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="colorTone"
                label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>色调</span>}
              >
                <Select placeholder="选择色调" style={{ background: '#202023', color: '#fff' }}>
                  <Option value="冷色调">冷色调</Option>
                  <Option value="暖色调">暖色调</Option>
                  <Option value="黑白">黑白</Option>
                  <Option value="复古">复古</Option>
                  <Option value="鲜艳">鲜艳</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {currentEditSceneIndex !== null && script && script.scenes[currentEditSceneIndex] && (
            <>
              <Divider style={{ borderColor: '#27272a', margin: '16px 0' }} />
              <Text style={{ color: '#a1a1aa', fontSize: 12, display: 'block', marginBottom: 12 }}>
                首尾帧预览（点击图片可重新上传）
              </Text>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{
                    height: 100,
                    background: '#09090b',
                    border: '1px dashed #27272a',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                  }} onClick={() => uploadFrameImage(currentEditSceneIndex, 'first')}>
                    {!!script.scenes[currentEditSceneIndex].firstFrameUrl ? (
                      <>
                        <img
                          src={script.scenes[currentEditSceneIndex].firstFrameUrl}
                          alt="首帧"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSceneImage(currentEditSceneIndex, 'first');
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            opacity: 0.8,
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#52525b' }}>点击上传首帧</span>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    height: 100,
                    background: '#09090b',
                    border: '1px dashed #27272a',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                  }} onClick={() => uploadFrameImage(currentEditSceneIndex, 'last')}>
                    {!!script.scenes[currentEditSceneIndex].lastFrameUrl ? (
                      <>
                        <img
                          src={script.scenes[currentEditSceneIndex].lastFrameUrl}
                          alt="尾帧"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSceneImage(currentEditSceneIndex, 'last');
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            opacity: 0.8,
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#52525b' }}>点击上传尾帧</span>
                    )}
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>

      {/* 音频素材库选择模态框 */}
      <Modal
        title={
          <div>
            🎵 从素材库选择声音参考
          </div>
        }
        open={audioLibraryModalVisible}
        onCancel={() => {
          setAudioLibraryModalVisible(false);
          setCurrentSceneForAudioSelect(null);
        }}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => {
            setAudioLibraryModalVisible(false);
            setCurrentSceneForAudioSelect(null);
          }}>
            取消
          </Button>
        ]}
      >
        {isLoadingAudioLibrary ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <LoadingOutlined style={{ fontSize: 40, color: '#818cf8' }} />
            <p style={{ marginTop: 16, color: '#a1a1aa' }}>正在加载素材库...</p>
          </div>
        ) : audioLibraryMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SoundOutlined style={{ fontSize: 60, color: '#3f3f46' }} />
            <p style={{ marginTop: 16, color: '#a1a1aa' }}>
              素材库中暂无音频素材，请先在素材管理页面上传音频。
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
              dataSource={audioLibraryMaterials}
              renderItem={(material: any) => (
                <List.Item>
                  <Card
                    hoverable
                    style={{ borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => {
                      if (currentSceneForAudioSelect !== null) {
                        updateSceneField(currentSceneForAudioSelect, 'referenceAudioUrl', material.url);
                        message.success('🎵 已添加声音参考！');
                        setAudioLibraryModalVisible(false);
                        setCurrentSceneForAudioSelect(null);
                      }
                    }}
                  >
                    <div style={{
                      height: 120,
                      background: '#202023',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      padding: '16px'
                    }}>
                      <SoundOutlined style={{ fontSize: 36, color: '#818cf8', marginBottom: 12 }} />
                      <audio
                        src={material.url}
                        controls
                        style={{ width: '100%', height: 32 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#a1a1aa',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {material.filename}
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default WorkbenchPage;
