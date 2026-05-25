import React, { useEffect, useState } from 'react';
import {
  List,
  Card,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Divider,
  Modal,
  Typography,
  Badge,
} from 'antd';
import {
  ThunderboltOutlined,
  SearchOutlined,
  PlusOutlined,
  FireOutlined,
  LikeOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { TemplateService, InspirationTemplate } from '../../services/template';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Search } = Input;
const { Title, Text, Paragraph } = Typography;

const TemplateLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InspirationTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InspirationTemplate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [filterCategory, setFilterCategory] = useState<string>();
  const [filterKeyword, setFilterKeyword] = useState<string>();

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [filterCategory, filterKeyword]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await TemplateService.getAll({
        category: filterCategory,
        keyword: filterKeyword,
        limit: 20,
      });
      if (result.success) setTemplates(result.data);
    } catch (err) {
      console.error('Load templates error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await TemplateService.getCategories();
      if (result.success) setCategories(result.data);
    } catch (err) {
      console.error('Load categories error:', err);
    }
  };

  const openDetail = (template: InspirationTemplate) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  const useTemplate = () => {
    if (!selectedTemplate) return;
    navigate('/video-creation', {
      state: { templateId: selectedTemplate.id },
    });
    setDetailModalVisible(false);
  };

  return (
    <div className="template-library-page" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
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
          <Button icon={<PlusOutlined />}>创建模板</Button>
          <Button type="primary">从爆款视频聚类提炼</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <Search
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
            {categories.map((cat) => (
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
        renderItem={(template) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => openDetail(template)}
              actions={[
                <Button type="link" size="small" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTemplate(template);
                  setDetailModalVisible(true);
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
                {template.category && <Tag color="purple">{template.category}</Tag>}
                {(template.tags || []).slice(0, 2).map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={selectedTemplate?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          <Button key="use" type="primary" onClick={useTemplate}>
            使用此模板创作
          </Button>,
        ]}
      >
        {selectedTemplate && (
          <div>
            <Divider orientation="left">策略</Divider>
            <Card size="small" style={{ marginBottom: 16, background: '#f5f5ff' }}>
              <Paragraph style={{ fontSize: 15, fontWeight: 500 }}>{selectedTemplate.strategy}</Paragraph>
            </Card>

            <Divider orientation="left">创作因子</Divider>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Card size="small" title="开场">
                <Text>{selectedTemplate.factors?.opening}</Text>
              </Card>
              <Card size="small" title="画面">
                <Text>{selectedTemplate.factors?.visual}</Text>
              </Card>
              <Card size="small" title="旁白">
                <Text>{selectedTemplate.factors?.voiceover}</Text>
              </Card>
              <Card size="small" title="BGM">
                <Text>{selectedTemplate.factors?.bgm}</Text>
              </Card>
              <Card size="small" title="色调">
                <Text>{selectedTemplate.factors?.color_tone}</Text>
              </Card>
              <Card size="small" title="退场">
                <Text>{selectedTemplate.factors?.closing}</Text>
              </Card>
            </Space>

            {selectedTemplate.constraintRules && (
              <>
                <Divider orientation="left">约束规则</Divider>
                <Card size="small">
                  <Text>{selectedTemplate.constraintRules}</Text>
                </Card>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplateLibraryPage;
