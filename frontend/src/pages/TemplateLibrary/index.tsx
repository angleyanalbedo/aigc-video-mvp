import React, { useEffect, useState } from 'react';
import {
  List, Card, Tag, Button, Input, Select, Space, Modal,
  Typography, Badge, Form, Row, Col, Checkbox, message, Alert, Spin
} from 'antd'
import {
  ThunderboltOutlined, SearchOutlined, AppstoreOutlined, FireOutlined,
  RobotOutlined, CheckSquareOutlined
} from '@ant-design/icons';
import { TemplateService, InspirationTemplate } from '../../services/template';
import { VideoLibraryService, VideoLibraryItem } from '../../services/videoLibrary';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const CATEGORIES = ['通用种草', '品质种草', '专业种草', '剧情种草', '测评种草', '教程种草'];

const TemplateLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InspirationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InspirationTemplate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [extractModalVisible, setExtractModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [extractVideos, setExtractVideos] = useState<VideoLibraryItem[]>([]);
  const [extractSelected, setExtractSelected] = useState<string[]>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [filterCategory, setFilterCategory] = useState<string>();
  const [filterKeyword, setFilterKeyword] = useState<string>();

  useEffect(() => {
    loadTemplates();
  }, [filterCategory, filterKeyword]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await TemplateService.getAll({
        category: filterCategory,
        keyword: filterKeyword,
        limit: 50,
      });
      if (result.success) setTemplates(result.data);
    } catch (err) {
      console.error('Load templates error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (template: InspirationTemplate) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  const handleCreateTemplate = async (values: any) => {
    setCreateSubmitting(true);
    try {
      const result = await TemplateService.create({
        name: values.name,
        description: values.description,
        category: values.category,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        strategy: values.strategy,
        factors: {
          opening: values.f_opening || '',
          closing: values.f_closing || '',
          visual: values.f_visual || '',
          voiceover: values.f_voiceover || '',
          bgm: values.f_bgm || '',
          color_tone: values.f_color_tone || ''
        },
        constraintRules: values.constraintRules
      });
      if (result.success) {
        message.success('模板创建成功');
        setCreateModalVisible(false);
        createForm.resetFields();
        loadTemplates();
      } else {
        message.error(result.error || '创建失败');
      }
    } catch (err: any) {
      message.error(err.message || '创建失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openExtractModal = async () => {
    setExtractModalVisible(true);
    setExtractLoading(true);
    setExtractSelected([]);
    try {
      const res = await VideoLibraryService.getAll({ limit: 100 });
      if (res.success) {
        setExtractVideos(res.data.filter((v: any) => v.status === 'analyzed'));
      }
    } catch {
      message.error('加载视频列表失败');
    } finally {
      setExtractLoading(false);
    }
  };

  const handleExtract = async () => {
    if (extractSelected.length < 2) {
      message.warning('请至少选择2个视频进行聚类提炼');
      return;
    }
    setExtracting(true);
    try {
      const result = await TemplateService.extractFromVideos(extractSelected);
      if (result.success) {
        message.success('模板提炼成功！');
        setExtractModalVisible(false);
        setExtractSelected([]);
        loadTemplates();
        if (result.data) {
          setSelectedTemplate(result.data);
          setDetailModalVisible(true);
        }
      } else {
        message.error(result.error || '提炼失败');
      }
    } catch (err: any) {
      message.error(err.message || '提炼失败');
    } finally {
      setExtracting(false);
    }
  };

  const useTemplate = () => {
    if (!selectedTemplate) return;
    navigate('/video-creation', {
      state: { templateId: selectedTemplate.id, template: selectedTemplate },
    });
    setDetailModalVisible(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>
            <ThunderboltOutlined style={{ color: '#722ed1', marginRight: 8 }} />
            灵感模板库
          </h1>
          <p style={{ color: '#666', margin: '8px 0 0 0' }}>
            提炼爆款视频方法论，策略 + 因子驱动创作
          </p>
        </div>
        <Space>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => setCreateModalVisible(true)}
            style={{ borderRadius: 8 }}
          >
            创建模板
          </Button>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={openExtractModal}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)' }}
          >
            从爆款视频聚类提炼
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space size="middle" wrap>
          <Input.Search
            placeholder="搜索模板名称、策略"
            style={{ width: 300 }}
            allowClear
            onSearch={setFilterKeyword}
          />
          <Select
            placeholder="筛选类目"
            style={{ width: 180 }}
            allowClear
            onChange={setFilterCategory}
          >
            {CATEGORIES.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
          <Button onClick={loadTemplates} icon={<SearchOutlined />}>刷新</Button>
        </Space>
      </Card>

      <List
        grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 5 }}
        dataSource={templates}
        loading={loading}
        locale={{ emptyText: '暂无模板，请先创建或从视频中提炼' }}
        renderItem={(template) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => openDetail(template)}
              actions={[
                <Button type="link" size="small" key="view" onClick={(e) => {
                  e.stopPropagation();
                  openDetail(template);
                }}>查看详情</Button>
              ]}
            >
              <div style={{ marginBottom: 12 }}>
                <Badge count={`${template.rating || 0}分`} style={{ backgroundColor: '#52c41a' }} />
                <Badge count={`${template.usageCount || 0}次`} style={{ backgroundColor: '#1890ff', marginLeft: 8 }} />
              </div>
              <Title level={4} style={{ fontSize: 16, marginBottom: 8 }}>
                {template.name}
              </Title>
              <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 13, color: '#666' }}>
                {template.description}
              </Paragraph>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12 }}>
                {template.category && <Tag color="purple" style={{ borderRadius: 4 }}>{template.category}</Tag>}
                {(template.tags || []).slice(0, 2).map(tag => (
                  <Tag key={tag} style={{ borderRadius: 4 }}>{tag}</Tag>
                ))}
              </div>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={
          <span>
            <AppstoreOutlined style={{ color: '#722ed1', marginRight: 8 }} />
            创建灵感模板
          </span>
        }
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateTemplate} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="例如：痛点前置+即时满足种草模板" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="类目" rules={[{ required: true, message: '请选择类目' }]}>
                <Select placeholder="选择类目">
                  {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="模板描述">
            <TextArea rows={2} placeholder="简要描述模板的适用场景和特点" />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="如：痛点营销, 种草, 快节奏" />
          </Form.Item>
          <Form.Item name="strategy" label="创作策略" rules={[{ required: true, message: '请输入创作策略' }]}>
            <TextArea rows={4} placeholder="描述模板的核心创作方法和叙事逻辑，如：痛点前置+即时满足是一种'先共情再种草'的创作策略..." />
          </Form.Item>

          <div style={{ background: '#f9f0ff', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#722ed1' }}>🎬 创作因子</div>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="f_opening" label="开场因子">
                  <TextArea rows={2} placeholder="开场手法，如：痛点场景直击..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="f_closing" label="退场因子">
                  <TextArea rows={2} placeholder="结尾收尾，如：促销信息收尾..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="f_visual" label="画面因子">
                  <TextArea rows={2} placeholder="视觉风格，如：产品卖点可视化..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="f_voiceover" label="旁白因子">
                  <TextArea rows={2} placeholder="旁白风格，如：简洁有力型..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="f_bgm" label="BGM因子">
                  <TextArea rows={2} placeholder="背景音乐风格，如：节奏感强的轻快BGM..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="f_color_tone" label="色调因子">
                  <TextArea rows={2} placeholder="整体色调，如：暖白/奶油白色调..." />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Form.Item name="constraintRules" label="约束规则">
            <TextArea rows={2} placeholder="使用模板时的注意事项和限制条件" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setCreateModalVisible(false); createForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={createSubmitting} style={{ borderRadius: 8 }}>
              创建模板
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <span>
            <RobotOutlined style={{ color: '#722ed1', marginRight: 8 }} />
            从爆款视频聚类提炼模板
          </span>
        }
        open={extractModalVisible}
        onCancel={() => { setExtractModalVisible(false); setExtractSelected([]); }}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => { setExtractModalVisible(false); setExtractSelected([]); }}>取消</Button>,
          <Button
            key="extract" type="primary"
            onClick={handleExtract}
            loading={extracting}
            disabled={extractSelected.length < 2}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)' }}
          >
            <RobotOutlined /> {extracting ? 'AI提炼中...' : `AI聚类提炼（已选${extractSelected.length}个）`}
          </Button>
        ]}
      >
        <Alert
          message="操作说明"
          description="选择2个或以上已分析的爆款视频，AI将自动分析它们的共同创作套路，提炼为结构化的灵感模板。建议选择同品类、同风格的视频进行提炼，效果更佳。"
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />

        {extractLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin /> <span style={{ marginLeft: 12, color: '#999' }}>加载视频列表...</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
              <CheckSquareOutlined style={{ marginRight: 6 }} />
              已选 {extractSelected.length} 个视频（需至少2个）
            </div>
            <div style={{ maxHeight: 400, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {extractVideos.map((video) => {
                const checked = extractSelected.includes(video.id);
                return (
                  <div
                    key={video.id}
                    onClick={() => {
                      setExtractSelected(prev =>
                        checked ? prev.filter(id => id !== video.id) : [...prev, video.id]
                      );
                    }}
                    style={{
                      borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: checked ? '2px solid #722ed1' : '1px solid #e2e8f0',
                      background: checked ? '#f9f0ff' : '#fff',
                      transition: 'all 0.2s',
                      display: 'flex', gap: 12, padding: 10
                    }}
                  >
                    <Checkbox checked={checked} style={{ marginTop: 20 }} />
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 80, height: 60, background: '#1a1a2e', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FireOutlined style={{ color: '#888' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        <Space size={4}>
                          <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', borderRadius: 3 }}>{video.category}</Tag>
                          <Tag color={video.status === 'analyzed' ? 'green' : 'default'} style={{ fontSize: 10, padding: '0 4px', borderRadius: 3 }}>{video.status === 'analyzed' ? '已分析' : '待分析'}</Tag>
                        </Space>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {extractVideos.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <FireOutlined style={{ fontSize: 48, marginBottom: 12, color: '#d9d9d9' }} />
                <div>暂无已分析的视频</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>请先在视频库中添加并分析视频</div>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        title={selectedTemplate?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          <Button key="use" type="primary" icon={<ThunderboltOutlined />} onClick={useTemplate} style={{ borderRadius: 8 }}>
            使用此模板创作
          </Button>,
        ]}
      >
        {selectedTemplate && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Badge count={`${selectedTemplate.rating || 0}分`} style={{ backgroundColor: '#52c41a' }} />
              <Badge count={`${selectedTemplate.usageCount || 0}次使用`} style={{ backgroundColor: '#1890ff' }} />
              {selectedTemplate.category && <Tag color="purple" style={{ borderRadius: 4 }}>{selectedTemplate.category}</Tag>}
            </div>

            <Paragraph style={{ fontSize: 14, color: '#444', marginBottom: 16 }}>{selectedTemplate.description}</Paragraph>

            <div style={{ background: '#f5f5ff', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>🎯 创作策略</div>
              <Text style={{ lineHeight: 1.8 }}>{selectedTemplate.strategy}</Text>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>🎬 创作因子</div>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Tag color="orange" style={{ borderRadius: 4, marginBottom: 4 }}>开场</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.opening || '-'}</Text>
                </div>
                <div>
                  <Tag color="blue" style={{ borderRadius: 4, marginBottom: 4 }}>画面</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.visual || '-'}</Text>
                </div>
                <div>
                  <Tag color="purple" style={{ borderRadius: 4, marginBottom: 4 }}>旁白</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.voiceover || '-'}</Text>
                </div>
                <div>
                  <Tag color="magenta" style={{ borderRadius: 4, marginBottom: 4 }}>BGM</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.bgm || '-'}</Text>
                </div>
                <div>
                  <Tag color="cyan" style={{ borderRadius: 4, marginBottom: 4 }}>色调</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.color_tone || '-'}</Text>
                </div>
                <div>
                  <Tag color="green" style={{ borderRadius: 4, marginBottom: 4 }}>退场</Tag>
                  <Text style={{ display: 'block', lineHeight: 1.8 }}>{selectedTemplate.factors?.closing || '-'}</Text>
                </div>
              </Space>
            </div>

            {selectedTemplate.constraintRules && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>⚠️ 约束规则</div>
                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 12 }}>
                  <Text style={{ lineHeight: 1.8 }}>{selectedTemplate.constraintRules}</Text>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplateLibraryPage;
