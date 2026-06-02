import React from 'react';
import { useWorkbench } from '../useWorkbench';
import { LoadingOutlined, SoundOutlined } from '@ant-design/icons';
import { Modal, Button, List, Card, message } from 'antd';

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const AudioLibraryModal: React.FC<WorkbenchProps> = (workbench) => {
  const {
    audioLibraryModalVisible,
    setAudioLibraryModalVisible,
    audioLibraryMaterials,
    isLoadingAudioLibrary,
    currentSceneForAudioSelect,
    setCurrentSceneForAudioSelect,
    updateSceneField,
  } = workbench;

  return (
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
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>正在加载素材库...</p>
        </div>
      ) : audioLibraryMaterials.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SoundOutlined style={{ fontSize: 60, color: 'var(--text-secondary)' }} />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
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
                    background: 'var(--input-bg)',
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
                      color: 'var(--text-secondary)',
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
  );
};

export default AudioLibraryModal;
