import React, { useState, useRef, useMemo } from 'react';
import { Tooltip, message as antdMessage, Spin, Input } from 'antd';
import {
  PlusOutlined,
  PictureOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface Material {
  id: string;
  filename: string;
  url: string;
  type: string;
}

interface AssetPanelProps {
  projectId: string;
  materials: Material[];
  /** 选择注入模式时触发，传入 materialId 和 materialUrl */
  onInjectMode?: (materialId: string, materialUrl: string) => void;
  /** 新素材上传成功后回调 */
  onMaterialUploaded?: (material: Material) => void;
  /** 是否正在"选择注入目标"模式（此时面板高亮提示） */
  injectingMaterialId?: string | null;
}

const AssetPanel: React.FC<AssetPanelProps> = ({
  projectId,
  materials,
  onInjectMode,
  onMaterialUploaded,
  injectingMaterialId,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMaterials = useMemo(() => {
    if (!searchKeyword.trim()) {
      return materials;
    }
    const keyword = searchKeyword.toLowerCase();
    return materials.filter(m => 
      m.filename.toLowerCase().includes(keyword) ||
      (m.type && m.type.toLowerCase().includes(keyword))
    );
  }, [materials, searchKeyword]);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      antdMessage.error('仅支持图片格式（jpg/png/gif/webp）');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/materials`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        antdMessage.success(`✅ 素材 "${file.name}" 上传成功`);
        onMaterialUploaded?.(data.data);
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (err: any) {
      antdMessage.error('上传失败: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          background: '#18181b',
          borderRadius: 12,
          border: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 12,
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'width 0.2s ease',
        }}
        onClick={() => setCollapsed(false)}
        title="展开资产面板"
      >
        <RightOutlined style={{ color: '#6366f1', fontSize: 14 }} />
        {materials.slice(0, 4).map((m) => (
          <Tooltip key={m.id} title={m.filename} placement="right">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid #27272a',
                flexShrink: 0,
              }}
            >
              <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </Tooltip>
        ))}
        {materials.length > 4 && (
          <div style={{ fontSize: 9, color: '#52525b' }}>+{materials.length - 4}</div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 192,
        flexShrink: 0,
        background: '#18181b',
        borderRadius: 12,
        border: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>
          <PictureOutlined style={{ marginRight: 6, color: '#6366f1' }} />
          商品素材
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#52525b',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
          title="收起面板"
        >
          <LeftOutlined style={{ fontSize: 11 }} />
        </button>
      </div>

      {/* 注入模式提示条 */}
      {injectingMaterialId && (
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid #6366f1',
            borderRadius: 8,
            margin: '8px 8px 0',
            padding: '6px 12px',
            fontSize: 11,
            color: '#818cf8',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          点击右侧分镜注入参考图
        </div>
      )}

      {/* 搜索框 */}
      <div style={{ padding: '8px', flexShrink: 0 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#52525b', fontSize: 12 }} />}
          placeholder="搜索素材..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{
            background: '#202023',
            border: '1px solid #2e2e33',
            color: '#fff',
            fontSize: 11,
            height: 28,
          }}
          allowClear
        />
      </div>

      {/* 素材网格 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filteredMaterials.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#3f3f46',
              fontSize: 11,
              padding: '20px 8px',
            }}
          >
            <PictureOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            {searchKeyword ? '未找到匹配的素材' : '暂无素材'}
            <br />
            {!searchKeyword && '点击下方上传'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            {filteredMaterials.map((m) => {
              const isInjecting = injectingMaterialId === m.id;
              const isHovered = hoveredId === m.id;
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: isInjecting
                      ? '2px solid #6366f1'
                      : '1px solid #27272a',
                    cursor: 'pointer',
                    height: 72,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <img
                    src={m.url}
                    alt={m.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />

                  {/* 悬停遮罩 + 注入按钮 */}
                  {(isHovered || isInjecting) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => onInjectMode?.(m.id, m.url)}
                    >
                      {isInjecting ? (
                        <CheckCircleFilled style={{ fontSize: 20, color: '#6366f1' }} />
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#fff',
                            background: '#6366f1',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          注入分镜
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 上传区域 */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid #27272a',
          flexShrink: 0,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = '';
          }}
        />
        <button
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            height: 36,
            background: uploading ? '#18181b' : 'rgba(99,102,241,0.12)',
            border: '1px dashed #4f46e5',
            borderRadius: 8,
            color: uploading ? '#52525b' : '#818cf8',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'background 0.15s',
          }}
        >
          {uploading ? (
            <>
              <Spin size="small" />
              <span>上传中...</span>
            </>
          ) : (
            <>
              <PlusOutlined />
              <span>上传商品图</span>
            </>
          )}
        </button>
        <div style={{ fontSize: 9, color: '#3f3f46', textAlign: 'center', marginTop: 4 }}>
          支持 jpg/png/webp，最大 20MB
        </div>
      </div>
    </div>
  );
};

export default AssetPanel;
