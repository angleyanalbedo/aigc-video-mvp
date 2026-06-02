import React from 'react';
import { useWorkbench } from '../useWorkbench';
import { DeleteOutlined } from '@ant-design/icons';
import { Modal, Form, Input, Select, Button, Divider, Row, Col, Typography } from 'antd';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type WorkbenchProps = ReturnType<typeof useWorkbench>;

const SceneEditModal: React.FC<WorkbenchProps> = (workbench) => {
  const {
    isModalOpen,
    currentEditSceneIndex,
    closeEditModal,
    saveSceneEdit,
    form,
    script,
    uploadFrameImage,
    clearSceneImage,
  } = workbench;

  return (
    <Modal
      title={
        <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
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
        content: { background: 'var(--card-bg)', border: '1px solid var(--border-color)' },
        header: { borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)' },
        footer: { borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)' }
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
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>分镜视觉提示词</span>}
            >
              <TextArea
                rows={3}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="voiceover"
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>旁白配音</span>}
            >
              <TextArea
                rows={2}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="duration"
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>时长（秒）</span>}
            >
              <Input
                type="number"
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="shot_type"
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>镜头类型</span>}
            >
              <Select style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
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
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>转场</span>}
            >
              <Select style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                <Option value="fade">渐入渐出</Option>
                <Option value="cut">硬切</Option>
                <Option value="flash">闪白</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="cameraAngle"
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>拍摄角度</span>}
            >
              <Select placeholder="选择角度" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
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
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>光线类型</span>}
            >
              <Select placeholder="选择光线" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
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
              label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>色调</span>}
            >
              <Select placeholder="选择色调" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
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
            <Divider style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />
            <Text style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 12 }}>
              首尾帧预览（点击图片可重新上传）
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{
                  height: 100,
                  background: 'var(--page-bg)',
                  border: '1px dashed var(--border-color)',
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
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>点击上传首帧</span>
                  )}
                </div>
              </Col>
              <Col span={12}>
                <div style={{
                  height: 100,
                  background: 'var(--page-bg)',
                  border: '1px dashed var(--border-color)',
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
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>点击上传尾帧</span>
                  )}
                </div>
              </Col>
            </Row>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default SceneEditModal;
