import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Upload,
  Progress,
  Steps,
  message,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Tag,
  Modal,
  Result,
  Link,
} from 'antd';
import {
  ThunderboltOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  RocketOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { OneClickService, OneClickStatus } from '../services/oneClick';
import { VideoLibraryService, VideoLibraryItem } from '../services/videoLibrary';
import { TemplateService, InspirationTemplate } from '../services/template';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const OneClickPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<OneClickStatus | null>(null);
  const [taskId, setTaskId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [templates, setTemplates] = useState<InspirationTemplate[]>([]);

  const initialState = location.state as any;
  const mode = initialState?.templateId ? 'template' : initialState?.referenceVideoId ? 'copywriting' : 'auto';

  useEffect(() => {
    if (mode === 'copywriting') {
      form.setFieldsValue({ referenceVideoId: initialState?.referenceVideoId });
    } else if (mode === 'template') {
      form.setFieldsValue({ templateId: initialState?.templateId });
    }
    loadData();
  }, []);

  const loadData = async () => {
    const videoResult = await VideoLibraryService.getAll({ limit: 10 });
    if (videoResult.success) setVideos(videoResult.data);

    const templateResult = await TemplateService.getAll({ limit: 10 });
    if (templateResult.success) setTemplates(templateResult.data);
  };

  const handleStart = async (values: any) => {
    setLoading(true);
    try {
      const result = await OneClickService.generate(values);
      if (!result.success) {
        message.error(result.error || '启动失败');
        return;
      }
      setTaskId(result.taskId);
      setStep(1);
      if (result.taskId) {
        const unsubscribeFn = await OneClickService.subscribe(result.taskId, setStatus);
        setUnsubscribe(() => unsubscribeFn);
      }
    } catch (err) {
      console.error(err);
      message.error('启动失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      setStep(status.status === 'completed' ? 2 : 3);
      if (unsubscribe) unsubscribe();
    }
  }, [status]);

  const productInfoHelp = `请提供：
- 商品名称
- 主要卖点
- 目标人群
- 价格信息`;

  return (
    <div className="one-click-page" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ThunderboltOutlined style={{ color: '#722ed1', marginRight: 12 }} />
          一键成片
        </Title>
        <Text type="secondary">商品信息 → AI 剧本 → AI 视频 → 配音合成 → 导出成品</Text>
      </div>

      <Steps current={step} style={{ marginBottom: 32 }}>
        <Step title="填写商品信息" icon={<FileTextOutlined />} />
        <Step title="AI 生成中" icon={<RocketOutlined spin={step === 1} />} />
        <Step title="成片完成" icon={<PlayCircleOutlined />} />
      </Steps>

      {step === 0 && (
        <Card title="商品信息" extra={
          <Space>
            <Tag color={mode === 'auto' ? 'blue' : 'default'}>自动生成</Tag>
            <Tag color={mode === 'template' ? 'purple' : 'default'}>模板模式</Tag>
            <Tag color={mode === 'copywriting' ? 'orange' : 'default'}>爆款仿写</Tag>
          </Space>
        }>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleStart}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="productLink"
                  label="商品链接"
                >
                  <Input prefix={<LinkOutlined />} placeholder="粘贴商品链接（可选）" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="productImage"
                  label="商品主图"
                >
                  <Upload maxCount={1} listType="picture">
                    <Button icon={<UploadOutlined />}>上传主图</Button>
                  </Upload>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="productInfo"
              label="商品信息"
              rules={[{ required: true, message: '请填写商品信息' }]}
              extra={<pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#888', margin: 0 }}>{productInfoHelp}</pre>}
            >
              <TextArea
                rows={4}
                placeholder='例如：{"title": "口红", "sellingPoints": "持久不脱色", "targetAudience": "女性用户"}'
              />
            </Form.Item>

            {mode !== 'template' && (
              <Form.Item
                name="templateId"
                label="灵感模板（可选）"
              >
                <Select placeholder="选择灵感模板（可选）">
                  {templates.map((t) => (
                    <Option key={t.id} value={t.id}>{t.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {mode !== 'copywriting' && (
              <Form.Item
                name="referenceVideoId"
                label="爆款参考视频（可选）"
              >
                <Select placeholder="选择爆款视频（可选）">
                  {videos.map((v) => (
                    <Option key={v.id} value={v.id}>{v.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Divider />

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name={['options', 'resolution']} label="分辨率" initialValue="720p">
                  <Select>
                    <Option value="480p">480p</Option>
                    <Option value="720p">720p</Option>
                    <Option value="1080p">1080p</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['options', 'ratio']} label="比例" initialValue="9:16">
                  <Select>
                    <Option value="9:16">9:16 竖版</Option>
                    <Option value="16:9">16:9 横版</Option>
                    <Option value="1:1">1:1 方形</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['options', 'transition']} label="转场" initialValue="fade">
                  <Select>
                    <Option value="fade">淡入淡出</Option>
                    <Option value="cut">硬切</Option>
                    <Option value="dissolve">溶解</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button type="primary" size="large" htmlType="submit" loading={loading} block>
                开始一键成片
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {step === 1 && status && (
        <Card title="生成进度">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress
              type="circle"
              percent={status.progress}
              width={160}
              format={(percent) => `${percent}%`}
              style={{ marginBottom: 24 }}
            />
            <Title level={4} style={{ marginBottom: 8 }}>{status.phase}</Title>
            <Text type="secondary">{status.message}</Text>
          </div>
        </Card>
      )}

      {step === 2 && status && (
        <Card title="🎉 成片完成">
          <Result
            status="success"
            title="视频生成成功！"
            subTitle="总时长约 15 秒"
            extra={
              <Space>
                <Button type="primary" size="large" onClick={() => {
                  window.open(status.videoUrl, '_blank');
                }}>
                  播放/下载视频
                </Button>
                <Button size="large" onClick={() => {
                  navigate('/video-creation');
                }}>
                  进入创作页面编辑
                </Button>
              </Space>
            }
          />
        </Card>
      )}

      {step === 3 && (
        <Card title="生成失败">
          <Result
            status="error"
            title="视频生成失败"
            subTitle={status?.error || '请稍后重试'}
            extra={[
              <Button key="retry" type="primary" onClick={() => {
                setStep(0);
                setStatus(null);
              }}>
                重新尝试
              </Button>,
            ]}
          />
        </Card>
      )}

      <Card style={{ marginTop: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Link onClick={() => navigate('/video-library')}>
                爆款视频库
              </Link>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>找到灵感</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Link onClick={() => navigate('/template-library')}>
                灵感模板
              </Link>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>方法论驱动</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Link onClick={() => navigate('/video-creation')}>
                创作工作台
              </Link>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>高级编辑</Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default OneClickPage;
