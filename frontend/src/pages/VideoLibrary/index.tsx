import React, { useEffect, useState } from 'react';
import {
  List, Card, Tag, Button, Input, Select, Space, Row, Col,
  Modal, message, Divider, Descriptions, Form, Popconfirm
} from 'antd';
import {
  PlayCircleOutlined, SearchOutlined, EyeOutlined, PlusOutlined,
  LikeOutlined, FireOutlined, DeleteOutlined, ThunderboltOutlined,
  RobotOutlined, SyncOutlined
} from '@ant-design/icons';
import { VideoLibraryService, VideoLibraryItem } from '../../services/videoLibrary';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;

const PLATFORMS = ['抖音', '小红书', '快手', 'B站', '微信视频号', '淘宝直播', '其他'];
const CATEGORIES = ['美妆护肤', '食品饮料', '家电数码', '服饰内衣', '家居好物', '母婴育儿', '运动户外', '其他'];

const VideoLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoLibraryItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>();
  const [filterKeyword, setFilterKeyword] = useState<string>();

  useEffect(() => {
    loadVideos();
  }, [filterCategory, filterKeyword]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const result = await VideoLibraryService.getAll({
        category: filterCategory,
        keyword: filterKeyword,
        limit: 50,
      });
      if (result.success) setVideos(result.data);
    } catch (err) {
      console.error('Load videos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (video: VideoLibraryItem) => {
    setSelectedVideo(video);
    setDetailModalVisible(true);
  };

  const handleAddVideo = async (values: any) => {
    setAddSubmitting(true);
    try {
      const result = await VideoLibraryService.create({
        title: values.title,
        platform: values.platform,
        category: values.category,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        sourceUrl: values.sourceUrl,
        videoUrl: values.videoUrl,
        thumbnailUrl: values.thumbnailUrl,
        sourceDeclaration: values.sourceDeclaration || '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
        status: 'pending'
      });
      if (result.success) {
        message.success('视频入库成功');
        setAddModalVisible(false);
        addForm.resetFields();
        loadVideos();
      } else {
        message.error(result.error || '入库失败');
      }
    } catch (err: any) {
      message.error(err.message || '入库失败');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await VideoLibraryService.delete(id);
      message.success('删除成功');
      loadVideos();
    } catch {
      message.error('删除失败');
    }
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const result = await VideoLibraryService.analyze(id);
      if (result.success) {
        message.success('AI分析完成');
        loadVideos();
        if (selectedVideo?.id === id) {
          setSelectedVideo(result.data);
        }
      } else {
        message.error(result.error || '分析失败');
      }
    } catch (err: any) {
      message.error(err.message || '分析失败');
    } finally {
      setAnalyzingId(null);
    }
  };

  const useAsReference = () => {
    if (!selectedVideo) return;
    navigate('/video-creation', {
      state: { referenceVideoId: selectedVideo.id, referenceVideo: selectedVideo },
    });
    setDetailModalVisible(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalVisible(true)}
          style={{ borderRadius: 8 }}
        >
          添加入库
        </Button>
      </div>

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space size="middle" wrap>
          <Input.Search
            placeholder="搜索视频标题、标签"
            style={{ width: 300 }}
            allowClear
            onSearch={setFilterKeyword}
          />
          <Select
            placeholder="筛选类目"
            style={{ width: 160 }}
            allowClear
            onChange={setFilterCategory}
          >
            {CATEGORIES.map(cat => (
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
        locale={{ emptyText: '暂无视频，请先添加入库' }}
        renderItem={(video) => (
          <List.Item>
            <Card
              hoverable
              cover={
                video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} style={{ height: 160, objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    height: 160, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#888', fontSize: 48,
                  }}>
                    <PlayCircleOutlined />
                  </div>
                )
              }
              actions={[
                <Button type="text" size="small" key="view" icon={<EyeOutlined />} onClick={() => openDetail(video)}>查看</Button>,
                <Button
                  type="text" size="small" key="analyze"
                  icon={analyzingId === video.id ? <SyncOutlined spin /> : <RobotOutlined />}
                  onClick={() => handleAnalyze(video.id)}
                  disabled={analyzingId === video.id}
                >
                  {video.status === 'analyzed' ? '重分析' : 'AI分析'}
                </Button>
              ]}
            >
              <Card.Meta
                title={<div style={{ fontSize: 14, fontWeight: 500 }}>{video.title}</div>}
                description={
                  <div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {video.category && <Tag color="blue" style={{ borderRadius: 4 }}>{video.category}</Tag>}
                      {video.platform && <Tag color="cyan" style={{ borderRadius: 4 }}>{video.platform}</Tag>}
                      <Tag color={video.status === 'analyzed' ? 'green' : 'default'} style={{ borderRadius: 4 }}>
                        {video.status === 'analyzed' ? '已分析' : '待分析'}
                      </Tag>
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      <Space>
                        <LikeOutlined /> {video.likeCount || 0}
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
        title={
          <span>
            <PlusOutlined style={{ color: '#faad14', marginRight: 8 }} />
            添加爆款视频
          </span>
        }
        open={addModalVisible}
        onCancel={() => { setAddModalVisible(false); addForm.resetFields(); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddVideo} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="视频标题" rules={[{ required: true, message: '请输入视频标题' }]}>
            <Input placeholder="例如：韩束水光面膜15秒种草模板" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="platform" label="平台" rules={[{ required: true, message: '请选择平台' }]}>
                <Select placeholder="选择平台">
                  {PLATFORMS.map(p => <Option key={p} value={p}>{p}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="类目" rules={[{ required: true, message: '请选择类目' }]}>
                <Select placeholder="选择类目">
                  {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="如：面膜, 种草, 护肤" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="videoUrl" label="视频URL">
                <Input placeholder="视频直链（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="thumbnailUrl" label="封面图URL">
                <Input placeholder="封面图片链接（可选）" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="sourceUrl" label="来源链接">
            <Input placeholder="原视频链接（可选）" />
          </Form.Item>
          <Form.Item name="sourceDeclaration" label="来源声明" initialValue="视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除">
            <TextArea rows={2} />
          </Form.Item>
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <RobotOutlined style={{ color: '#faad14', marginRight: 6 }} />
            <span style={{ color: '#8c8c8c', fontSize: 13 }}>
              添加后可点击「AI分析」让系统自动提取视频的爆款结构（Hook手法、卖点呈现、分镜结构等）
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddModalVisible(false); addForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={addSubmitting} style={{ borderRadius: 8 }}>
              确认入库
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={selectedVideo?.title}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          <Popconfirm key="delete" title="确定删除此视频？" onConfirm={() => { handleDelete(selectedVideo!.id); setDetailModalVisible(false); }}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>,
          <Button
            key="analyze" type="primary"
            icon={analyzingId === selectedVideo?.id ? <SyncOutlined spin /> : <RobotOutlined />}
            onClick={() => selectedVideo && handleAnalyze(selectedVideo.id)}
            disabled={analyzingId === selectedVideo?.id}
          >
            {selectedVideo?.status === 'analyzed' ? '重新AI分析' : 'AI分析'}
          </Button>,
          <Button key="use" type="primary" icon={<ThunderboltOutlined />} onClick={useAsReference}>
            作为参考视频创作
          </Button>,
        ]}
      >
        {selectedVideo && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="类目">{selectedVideo.category}</Descriptions.Item>
              <Descriptions.Item label="平台">{selectedVideo.platform}</Descriptions.Item>
              <Descriptions.Item label="点赞数">{selectedVideo.likeCount?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedVideo.status === 'analyzed' ? 'green' : 'default'}>
                  {selectedVideo.status === 'analyzed' ? '已分析' : '待分析'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源声明" span={2}>{selectedVideo.sourceDeclaration}</Descriptions.Item>
            </Descriptions>

            {selectedVideo.status === 'analyzed' ? (
              <>
                <Divider orientation="left">🎣 Hook手法</Divider>
                <Card size="small" style={{ marginBottom: 16, background: '#f5f5ff', borderRadius: 8 }}>
                  <p style={{ margin: 0, lineHeight: 1.8 }}>{selectedVideo.hookTechnique}</p>
                </Card>

                <Divider orientation="left">💡 卖点呈现</Divider>
                <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                  <p style={{ margin: 0, lineHeight: 1.8 }}>{selectedVideo.sellingPoints}</p>
                </Card>

                <Divider orientation="left">🎬 分镜分析</Divider>
                <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                  <p style={{ margin: 0, lineHeight: 1.8 }}>{selectedVideo.shotAnalysis}</p>
                </Card>

                <Divider orientation="left">✨ 风格分析</Divider>
                <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                  <p style={{ margin: 0, lineHeight: 1.8 }}>{selectedVideo.styleAnalysis}</p>
                </Card>

                <Divider orientation="left">📐 结构分析</Divider>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <p style={{ margin: 0, lineHeight: 1.8 }}>{selectedVideo.structureAnalysis}</p>
                </Card>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 12, color: '#d9d9d9' }} />
                <div style={{ fontSize: 15, marginBottom: 8 }}>该视频尚未分析</div>
                <div style={{ fontSize: 13 }}>点击右上角「AI分析」提取爆款结构</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VideoLibraryPage;
