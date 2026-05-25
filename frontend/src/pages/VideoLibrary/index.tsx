import React, { useEffect, useState } from 'react';
import {
  List,
  Card,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Statistic,
  Row,
  Col,
  Modal,
  message,
  Divider,
  Descriptions,
} from 'antd';
import {
  PlayCircleOutlined,
  SearchOutlined,
  EyeOutlined,
  PlusOutlined,
  LikeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { VideoLibraryService, VideoLibraryItem, VideoLibraryStats } from '../../services/videoLibrary';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Search } = Input;

const VideoLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [stats, setStats] = useState<VideoLibraryStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoLibraryItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [filterCategory, setFilterCategory] = useState<string>();
  const [filterKeyword, setFilterKeyword] = useState<string>();

  useEffect(() => {
    loadVideos();
    loadStats();
    loadCategories();
  }, [filterCategory, filterKeyword]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const result = await VideoLibraryService.getAll({
        category: filterCategory,
        keyword: filterKeyword,
        limit: 20,
      });
      if (result.success) setVideos(result.data);
    } catch (err) {
      console.error('Load videos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await VideoLibraryService.getStats();
      if (result.success) setStats(result.data);
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await VideoLibraryService.getCategories();
      if (result.success) setCategories(result.data);
    } catch (err) {
      console.error('Load categories error:', err);
    }
  };

  const openDetail = async (video: VideoLibraryItem) => {
    setSelectedVideo(video);
    setDetailModalVisible(true);
  };

  const useAsReference = () => {
    if (!selectedVideo) return;
    navigate('/video-creation', {
      state: { referenceVideoId: selectedVideo.id },
    });
    setDetailModalVisible(false);
  };

  return (
    <div className="video-library-page" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>
            <FireOutlined style={{ color: '#faad14', marginRight: 8 }} />
            优质视频库
          </h1>
          <p style={{ color: '#666', margin: '8px 0 0 0' }}>
            爆款电商视频结构化分析，为你的创作提供灵感
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          添加入库
        </Button>
      </div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总爆款视频" value={stats.total} prefix={<PlayCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已分析" value={stats.analyzed} valueStyle={{ color: '#3f8600' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="类目数" value={Object.keys(stats.byCategory || {}).length} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="平台数" value={Object.keys(stats.byPlatform || {}).length} />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <Search
            placeholder="搜索视频标题、标签"
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
          <Button onClick={loadVideos} icon={<SearchOutlined />}>刷新</Button>
        </Space>
      </Card>

      <List
        grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 5 }}
        dataSource={videos}
        loading={loading}
        renderItem={(video) => (
          <List.Item>
            <Card
              hoverable
              cover={
                <div style={{
                  height: 160,
                  background: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                  fontSize: 48,
                }}>
                  <PlayCircleOutlined />
                </div>
              }
              actions={[
                <EyeOutlined key="view" onClick={() => openDetail(video)} />
              ]}
            >
              <Card.Meta
                title={<div style={{ fontSize: 14, fontWeight: 500 }}>{video.title}</div>}
                description={
                  <div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {video.category && <Tag color="blue">{video.category}</Tag>}
                      {video.platform && <Tag color="cyan">{video.platform}</Tag>}
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      <Space>
                        <LikeOutlined /> {video.likeCount}
                      </Space>
                    </div>
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={selectedVideo?.title}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          <Button key="use" type="primary" onClick={useAsReference}>
            作为参考视频仿写
          </Button>,
        ]}
      >
        {selectedVideo && (
          <div>
            <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="类目">{selectedVideo.category}</Descriptions.Item>
              <Descriptions.Item label="平台">{selectedVideo.platform}</Descriptions.Item>
              <Descriptions.Item label="来源声明">{selectedVideo.sourceDeclaration}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">结构化分析</Divider>

            <Card size="small" title="🎣 Hook手法" style={{ marginBottom: 16 }}>
              <p>{selectedVideo.hookTechnique}</p>
            </Card>

            <Card size="small" title="💡 卖点呈现" style={{ marginBottom: 16 }}>
              <p>{selectedVideo.sellingPoints}</p>
            </Card>

            <Card size="small" title="🎬 分镜分析" style={{ marginBottom: 16 }}>
              <p>{selectedVideo.shotAnalysis}</p>
            </Card>

            <Card size="small" title="✨ 风格分析" style={{ marginBottom: 16 }}>
              <p>{selectedVideo.styleAnalysis}</p>
            </Card>

            <Card size="small" title="📐 结构分析">
              <p>{selectedVideo.structureAnalysis}</p>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VideoLibraryPage;
