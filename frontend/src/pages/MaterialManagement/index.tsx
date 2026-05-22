import React, { useState, useEffect } from 'react';
import { Upload, Button, Card, List, Tag, Input, Select, Empty, Space, message, Descriptions } from 'antd';
import { UploadOutlined, SearchOutlined, PictureOutlined, VideoCameraOutlined } from '@ant-design/icons';

const { Option } = Select;

const MaterialManagementPage = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchTags, setSearchTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/materials`);
      const data = await response.json();
      if (data.success) {
        setMaterials(data.materials);
        // 收集所有标签
        const tags = new Set();
        data.materials.forEach(m => m.tags.forEach(t => tags.add(t)));
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
        setMaterials(data.results);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          url: URL.createObjectURL(file),
          content: file.name,
        }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('素材上传成功！');
        loadMaterials();
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
    }
    return false;
  };

  const handleDelete = async (id) => {
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

  const getIcon = (type) => {
    if (type.startsWith('image')) return <PictureOutlined />;
    if (type.startsWith('video')) return <VideoCameraOutlined />;
    return <PictureOutlined />;
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
          <p className="ant-upload-hint">支持图片和视频文件</p>
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
                  style={{ height: '100%' }}
                  cover={
                    item.type.startsWith('image') ? (
                      <img alt={item.filename} src={item.url} style={{ height: 160, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ height: 160, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <VideoCameraOutlined style={{ fontSize: 48, color: '#fff' }} />
                      </div>
                    )
                  }
                  actions={[
                    <Button type="text" danger size="small" onClick={() => handleDelete(item.id)}>删除</Button>
                  ]}
                  onClick={() => setSelectedMaterial(item)}
                >
                  <Card.Meta
                    avatar={getIcon(item.type)}
                    title={item.filename}
                    description={
                      <Space direction="vertical" size="small">
                        <Space wrap>
                          {item.tags.map(tag => (
                            <Tag key={tag} color="blue">{tag}</Tag>
                          ))}
                        </Space>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {new Date(item.createdAt).toLocaleString()}
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
        <Card
          title="📋 素材详情"
          style={{ marginTop: 16 }}
          extra={<Button type="text" onClick={() => setSelectedMaterial(null)}>关闭</Button>}
        >
          <Descriptions column={1}>
            <Descriptions.Item label="文件名">{selectedMaterial.filename}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedMaterial.type}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {selectedMaterial.tags.map(tag => <Tag key={tag} color="blue">{tag}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="上传时间">{new Date(selectedMaterial.createdAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 16 }}>
            {selectedMaterial.type.startsWith('image') ? (
              <img src={selectedMaterial.url} alt={selectedMaterial.filename} style={{ maxWidth: '100%' }} />
            ) : (
              <video src={selectedMaterial.url} controls style={{ maxWidth: '100%' }} />
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MaterialManagementPage;
