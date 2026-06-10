import { useState, useEffect } from 'react';
import { Upload, Button, Card, List, Tag, Input, Select, Empty, Space, message, Descriptions, Modal } from 'antd';
import { UploadOutlined, SearchOutlined, PictureOutlined, VideoCameraOutlined, SoundOutlined } from '@ant-design/icons';
import { API_BASE } from '../../services/config';

const { Option } = Select;

// 辅助函数：处理素材 URL，确保相对路径能正确解析
const getMaterialUrl = (url: string): string => {
  if (!url) return '';
  // 如果已经是完整 URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // 如果是相对路径，拼接 API_BASE
  if (url.startsWith('/')) {
    return `${API_BASE}${url}`;
  }
  return url;
};

interface Material {
  id: string;
  filename: string;
  url: string;
  type: string;
  tags?: string[];
  content?: string;
  createdAt?: string;
}

const MaterialManagementPage = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/materials`);
      const data = await response.json();
      if (data.success && data.data) {
        setMaterials(data.data);
        // 收集所有标签
        const tags = new Set<string>();
        data.data.forEach((m: Material) => {
          if (m.tags && Array.isArray(m.tags)) {
            m.tags.forEach((t: string) => tags.add(t));
          }
        });
        setAllTags([...tags]);
      }
    } catch (error) {
      console.error('加载素材失败:', error);
      message.error('加载素材失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword && searchTags.length === 0) {
      loadMaterials();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/materials/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchKeyword, tags: searchTags, topK: 50 }),
      });
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data || data.results || []);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: any) => {
    try {
      // 1. 先使用 FormData 将真实文件上传到服务器 /api/upload
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败，HTTP 状态: ${uploadResponse.status}`);
      }
      
      const uploadData = await uploadResponse.json();
      const serverFileUrl = uploadData.url || uploadData.data?.url;
      
      if (!serverFileUrl) {
        throw new Error('未获取到服务器返回的有效素材链接');
      }

      // 2. 将服务器返回的持久化素材链接登记到 /api/materials 数据库
      const response = await fetch(`${API_BASE}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          url: serverFileUrl,
          type: file.type,
          content: file.name,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('素材上传并分析成功！');
        loadMaterials();
      } else {
        throw new Error(data.error || '素材分析失败');
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error(`上传失败: ${error.message}`);
    }
    return false;
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/materials/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        message.success('素材删除成功');
        loadMaterials();
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSaveTags = async (id: string, updatedTags: string[]) => {
    try {
      const response = await fetch(`${API_BASE}/api/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('标签更新成功');
        // 更新本地状态中的素材列表和当前选中素材
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, tags: updatedTags } : m));
        setSelectedMaterial((prev: Material | null) => prev && prev.id === id ? { ...prev, tags: updatedTags } : prev);
        // 动态更新可选的全量标签列表
        const newAllTags = new Set(allTags);
        updatedTags.forEach(t => newAllTags.add(t));
        setAllTags([...newAllTags]);
      } else {
        message.error('标签更新失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('更新标签失败:', error);
      message.error('更新标签失败');
    }
  };

  const getIcon = (type: string | null | undefined) => {
    if (type && type.startsWith('image')) return <PictureOutlined />;
    if (type && type.startsWith('video')) return <VideoCameraOutlined />;
    if (type && type.startsWith('audio')) return <SoundOutlined />;
    // 根据文件名推断类型
    if (type === null || type === undefined) return <PictureOutlined />;
    return <PictureOutlined />;
  };

  // 根据文件名推断 MIME 类型
  const inferMediaType = (filename: string, type: string | null | undefined) => {
    if (type && (type.startsWith('image') || type.startsWith('video') || type.startsWith('audio'))) {
      return type;
    }
    const lowerFilename = (filename || '').toLowerCase();
    if (lowerFilename.match(/\.(mp4|mov|avi|mkv|webm)$/)) {
      return 'video/mp4';
    } else if (lowerFilename.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
      return 'audio/mpeg';
    } else if (lowerFilename.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
      return 'image/jpeg';
    }
    return type || 'image/jpeg';
  };

  return (
    <div className="content-area">
      <div className="page-title">📂 素材管理</div>
      <div className="page-subtitle">素材标签、Embedding 检索与智能管理</div>

      <Card title="🔍 素材搜索" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Search
            placeholder="按关键词搜索"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
            style={{ marginBottom: 12 }}
          />
          <Select
            mode="multiple"
            placeholder="按标签筛选"
            style={{ width: '100%', marginBottom: 12 }}
            value={searchTags}
            onChange={setSearchTags}
          >
            {allTags.map(tag => (
              <Option key={tag} value={tag}>{tag}</Option>
            ))}
          </Select>
          <Space>
            <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>搜索</Button>
            <Button onClick={() => { setSearchKeyword(''); setSearchTags([]); loadMaterials(); }}>重置</Button>
          </Space>
        </Space>
      </Card>

      <Card title="📤 上传素材" style={{ marginBottom: 16 }}>
        <Upload.Dragger
          name="file"
          beforeUpload={handleUpload}
          fileList={[]}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持图片、视频和音频文件</p>
        </Upload.Dragger>
      </Card>

      <Card title="📦 素材列表">
        {materials.length === 0 ? (
          <Empty description="暂无素材" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            loading={loading}
            dataSource={materials}
            renderItem={(item) => (
              <List.Item>
                <Card
                  hoverable
                  style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}
                  cover={
                    inferMediaType(item.filename, item.type).startsWith('image') ? (
                      <img alt={item.filename} src={getMaterialUrl(item.url)} style={{ height: 160, objectFit: 'cover' }} />
                    ) : inferMediaType(item.filename, item.type).startsWith('video') ? (
                      <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
                        <video
                          src={getMaterialUrl(item.url)}
                          muted
                          loop
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onMouseEnter={(e) => e.currentTarget.play()}
                          onMouseLeave={(e) => e.currentTarget.pause()}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: '50%',
                          width: 48,
                          height: 48,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <VideoCameraOutlined style={{ fontSize: 24, color: 'var(--text-primary)' }} />
                        </div>
                      </div>
                    ) : inferMediaType(item.filename, item.type).startsWith('audio') ? (
                      <div style={{ height: 160, backgroundColor: 'var(--section-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <SoundOutlined style={{ fontSize: 40, color: '#818cf8', marginBottom: 8 }} />
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', wordBreak: 'break-word', padding: '0 16px' }}>
                          {item.filename}
                        </div>
                      </div>
                    ) : (
                      <img alt={item.filename} src={getMaterialUrl(item.url)} style={{ height: 160, objectFit: 'cover' }} />
                    )
                  }
                  actions={[
                    <Button type="text" danger size="small" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>删除</Button>
                  ]}
                  onClick={() => {
                    setSelectedMaterial(item);
                    setEditingTags(item.tags || []);
                  }}
                >
                  <Card.Meta
                    avatar={getIcon(item.type)}
                    title={item.filename}
                    description={
                      <Space direction="vertical" size="small">
                        <Space wrap>
                          {item.tags && item.tags.map((tag: string) => (
                            <Tag key={tag} color="blue">{tag}</Tag>
                          ))}
                        </Space>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </div>
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      {selectedMaterial && (
        <Modal
          title={
            <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>
              {getIcon(selectedMaterial.type)} 素材预览与编辑
            </div>
          }
          open={!!selectedMaterial}
          onCancel={() => setSelectedMaterial(null)}
          footer={[
            <Button key="close" type="primary" onClick={() => setSelectedMaterial(null)}>
              关闭
            </Button>
          ]}
          width={800}
          styles={{
            body: { background: 'var(--card-bg)', color: 'var(--text-primary)', padding: '24px 12px 12px 12px' }
          }}
          style={{ top: 40 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Media Preview Window */}
            <div style={{
              background: 'var(--page-bg)',
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 320,
              maxHeight: 480,
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid var(--border-color)'
            }}>
              {inferMediaType(selectedMaterial.filename, selectedMaterial.type).startsWith('image') ? (
                <img
                  src={getMaterialUrl(selectedMaterial.url)}
                  alt={selectedMaterial.filename}
                  style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain' }}
                />
              ) : inferMediaType(selectedMaterial.filename, selectedMaterial.type).startsWith('video') ? (
                <video
                  src={getMaterialUrl(selectedMaterial.url)}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain' }}
                />
              ) : inferMediaType(selectedMaterial.filename, selectedMaterial.type).startsWith('audio') ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <SoundOutlined style={{ fontSize: 80, color: '#818cf8', marginBottom: 24 }} />
                  <audio
                    src={getMaterialUrl(selectedMaterial.url)}
                    controls
                    autoPlay
                    style={{ width: '100%', maxWidth: 400 }}
                  />
                </div>
              ) : (
                <img
                  src={getMaterialUrl(selectedMaterial.url)}
                  alt={selectedMaterial.filename}
                  style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain' }}
                />
              )}
            </div>

            {/* Metadata and Edit Tags Panel */}
            <Card style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <Descriptions column={2} labelStyle={{ color: 'var(--text-secondary)' }} contentStyle={{ color: 'var(--text-primary)' }}>
                <Descriptions.Item label="文件名" span={2}>
                  <div style={{ wordBreak: 'break-all', fontWeight: 500 }}>{selectedMaterial.filename}</div>
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag color="cyan">{selectedMaterial.type || '未知'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="上传时间">
                  {selectedMaterial.createdAt ? new Date(selectedMaterial.createdAt).toLocaleString() : ''}
                </Descriptions.Item>
              </Descriptions>

              {/* Tag Editing Section */}
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  🏷️ 标签管理（输入新标签后按回车键即可创建）
                </div>
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="选择或输入添加新标签"
                  value={editingTags}
                  onChange={(newTags) => {
                    setEditingTags(newTags);
                    handleSaveTags(selectedMaterial.id, newTags);
                  }}
                  tokenSeparators={[',', ' ']}
                  dropdownStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                >
                  {allTags.map(tag => (
                    <Option key={tag} value={tag}>{tag}</Option>
                  ))}
                </Select>
              </div>
            </Card>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MaterialManagementPage;
