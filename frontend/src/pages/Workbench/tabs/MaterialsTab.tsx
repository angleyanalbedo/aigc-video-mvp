import React from 'react';
import { useWorkbench, API_BASE } from '../useWorkbench';
import {
  PictureOutlined,
  RocketOutlined,
  UploadOutlined,
  DatabaseOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  InboxOutlined,
} from '@ant-design/icons';
import { Button, Card, Row, Col, Space, Typography, Input, Modal, Tag, message } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const MaterialsTab: React.FC<WorkbenchProps> = (workbench) => {
  const {
    projectId,
    projectMaterials,
    setProjectMaterials,
    setWorkflowNodes,
    productInfo,
    setProductInfo,
    isAnalyzing,
    setIsAnalyzing,
    project,
    setProject,
    navigate,
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
  } = workbench;

  return (
    <>
      <Row gutter={24} style={{ height: '100%' }}>
        {/* Left: Materials List & Upload */}
        <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Card
            title={<span style={{ color: 'var(--text-primary)' }}><PictureOutlined /> 商品参考素材库</span>}
            bordered={false}
            style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}
          >
            <div style={{ flexShrink: 0, marginBottom: 16 }}>
              <Paragraph style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
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
                  style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6, height: 36 }}
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
                  style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6, height: 36 }}
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
                      border: '1px solid var(--border-color)',
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
                        color: 'var(--text-primary)',
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
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
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
            title={<span style={{ color: 'var(--text-primary)' }}><RocketOutlined /> AI 核心卖点提炼与分析</span>}
            bordered={false}
            style={{ background: 'var(--card-bg)', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
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
                <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 12 }}>唤醒 AI 导演深度提炼商品核心数据</Title>
                <Paragraph style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 24 }}>
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
                    style={{ height: 48, borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  >
                    直接配置剧本 ➔
                  </Button>
                </Space>
              </div>
            ) : isAnalyzing ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingOutlined style={{ fontSize: 40, color: '#818cf8', marginBottom: 20 }} />
                <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 8 }}>AI 素材特征提取 Agent 正在读取解析中...</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>FFmpeg 与 Vision LLM 正在提取图片卖点、分析流行痛点，请稍候片刻...</Text>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>🛒 商品带货名称 / 策划标题</Text></div>
                      <Input
                        value={productInfo.title}
                        onChange={(e) => setProductInfo({ ...productInfo, title: e.target.value })}
                        style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, height: 38 }}
                      />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>💎 商品核心卖点与亮点摘要 (80字内)</Text></div>
                      <TextArea
                        value={productInfo.sellingPoints}
                        onChange={(e) => setProductInfo({ ...productInfo, sellingPoints: e.target.value })}
                        rows={3}
                        style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6 }}
                      />
                    </div>
                    <Row gutter={16}>
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>👥 精准目标受众群体</Text></div>
                        <Input
                          value={productInfo.targetAudience}
                          onChange={(e) => setProductInfo({ ...productInfo, targetAudience: e.target.value })}
                          style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, height: 38 }}
                        />
                      </Col>
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>🏷️ 售价参考区间</Text></div>
                        <Input
                          value={productInfo.price}
                          onChange={(e) => setProductInfo({ ...productInfo, price: e.target.value })}
                          style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, height: 38 }}
                        />
                      </Col>
                    </Row>
                    <div>
                      <div style={{ marginBottom: 6 }}><Text strong style={{ color: 'var(--text-primary)' }}>🎨 建议短视频整体创意调性</Text></div>
                      <Input
                        value={productInfo.style}
                        onChange={(e) => setProductInfo({ ...productInfo, style: e.target.value })}
                        style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, height: 38 }}
                      />
                    </div>
                  </Space>
                </div>

                <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    type="dashed"
                    onClick={() => {
                      setProductInfo(null);
                    }}
                    style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}
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

      {/* 素材库选择 Modal */}
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
            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>正在加载素材库...</p>
          </div>
        ) : libraryMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <InboxOutlined style={{ fontSize: 60, color: 'var(--text-secondary)' }} />
            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
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
                        border: isSelected ? '3px solid #10b981' : '1px solid var(--border-color)',
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
                        color: 'var(--text-primary)',
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
    </>
  );
};

export default MaterialsTab;
