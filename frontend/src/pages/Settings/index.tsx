import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Switch, Divider, Space, message, Tabs, Tag, Modal, Descriptions, Alert } from 'antd';
import { SettingOutlined, ApiOutlined, VideoCameraOutlined, DatabaseOutlined, InfoCircleOutlined, SaveOutlined, ReloadOutlined, DeleteOutlined, ExperimentOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface SystemConfig {
  apiKey: string;
  apiEndpoint: string;
  defaultAspectRatio: string;
  defaultDuration: number;
  defaultResolution: string;
  autoSave: boolean;
  autoSaveInterval: number;
}

interface CreativeDefaults {
  openingStyle: string;
  bgmStyle: string;
  voiceoverStyle: string;
  colorTone: string;
  subtitleStyle: string;
  aspectRatio: string;
  duration: number;
  sceneCount: number;
}

const defaultSystemConfig: SystemConfig = {
  apiKey: '',
  apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/bots',
  defaultAspectRatio: '9:16',
  defaultDuration: 15,
  defaultResolution: '720p',
  autoSave: true,
  autoSaveInterval: 30
};

const defaultCreativeDefaults: CreativeDefaults = {
  openingStyle: '悬念引入',
  bgmStyle: '节奏感强',
  voiceoverStyle: '活泼热情',
  colorTone: '暖色调',
  subtitleStyle: '大字醒目',
  aspectRatio: '9:16',
  duration: 15,
  sceneCount: 3
};

const SettingsPage: React.FC = () => {
  const [systemForm] = Form.useForm();
  const [creativeForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 加载配置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    // 从 localStorage 加载配置
    const savedSystemConfig = localStorage.getItem('systemConfig');
    const savedCreativeDefaults = localStorage.getItem('creativeDefaults');

    if (savedSystemConfig) {
      systemForm.setFieldsValue(JSON.parse(savedSystemConfig));
    } else {
      systemForm.setFieldsValue(defaultSystemConfig);
    }

    if (savedCreativeDefaults) {
      creativeForm.setFieldsValue(JSON.parse(savedCreativeDefaults));
    } else {
      creativeForm.setFieldsValue(defaultCreativeDefaults);
    }
  };

  const saveSystemSettings = async (values: SystemConfig) => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('systemConfig', JSON.stringify(values));
      message.success('系统配置已保存');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      message.error('保存失败');
      setSaveStatus('idle');
    }
  };

  const saveCreativeDefaults = async (values: CreativeDefaults) => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('creativeDefaults', JSON.stringify(values));
      message.success('创作默认值已保存');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      message.error('保存失败');
      setSaveStatus('idle');
    }
  };

  const resetSettings = () => {
    Modal.confirm({
      title: '确认重置',
      content: '确定要重置所有设置为默认值吗？',
      okText: '确认重置',
      cancelText: '取消',
      onOk: () => {
        localStorage.removeItem('systemConfig');
        localStorage.removeItem('creativeDefaults');
        systemForm.setFieldsValue(defaultSystemConfig);
        creativeForm.setFieldsValue(defaultCreativeDefaults);
        message.success('设置已重置为默认值');
      }
    });
  };

  const clearCache = () => {
    Modal.confirm({
      title: '确认清除缓存',
      content: '确定要清除浏览器缓存吗？这将清除临时数据和本地存储。',
      okText: '确认清除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        localStorage.clear();
        sessionStorage.clear();
        message.success('缓存已清除，请刷新页面');
      }
    });
  };

  const initSampleData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/scripts/init-sample-data`, {
        method: 'POST'
      });
      if (response.ok) {
        message.success('示例数据初始化成功');
      } else {
        message.info('示例数据初始化接口不可用');
      }
    } catch (error) {
      console.error('初始化失败:', error);
      message.error('初始化失败');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'system',
      label: (
        <span>
          <SettingOutlined />
          系统配置
        </span>
      ),
      children: (
        <Card title="系统配置" style={{ maxWidth: 800 }}>
          <Form
            form={systemForm}
            layout="vertical"
            onFinish={saveSystemSettings}
            initialValues={defaultSystemConfig}
          >
            <Divider orientation="left">API 配置</Divider>
            
            <Form.Item
              name="apiKey"
              label="API 密钥"
              extra="火山方舟 API 密钥，用于调用大模型服务"
            >
              <Input.Password placeholder="请输入 API 密钥" />
            </Form.Item>

            <Form.Item
              name="apiEndpoint"
              label="API 端点"
              extra="火山方舟 API 端点地址"
            >
              <Input placeholder="https://ark.cn-beijing.volces.com/api/v3/bots" />
            </Form.Item>

            <Divider orientation="left">视频生成默认值</Divider>

            <Space size="large" style={{ width: '100%' }}>
              <Form.Item
                name="defaultAspectRatio"
                label="默认画幅比例"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="9:16">竖版 9:16</Option>
                  <Option value="16:9">横版 16:9</Option>
                  <Option value="1:1">方形 1:1</Option>
                  <Option value="4:3">4:3</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="defaultDuration"
                label="默认时长（秒）"
                style={{ width: 120 }}
              >
                <Select>
                  <Option value={5}>5秒</Option>
                  <Option value={10}>10秒</Option>
                  <Option value={15}>15秒</Option>
                  <Option value={20}>20秒</Option>
                  <Option value={30}>30秒</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="defaultResolution"
                label="默认分辨率"
                style={{ width: 120 }}
              >
                <Select>
                  <Option value="480p">480p</Option>
                  <Option value="720p">720p</Option>
                </Select>
              </Form.Item>
            </Space>

            <Divider orientation="left">自动保存设置</Divider>

            <Form.Item
              name="autoSave"
              label="启用自动保存"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="autoSaveInterval"
              label="自动保存间隔（秒）"
              style={{ width: 200 }}
            >
              <Select disabled={!systemForm.getFieldValue('autoSave')}>
                <Option value={15}>15秒</Option>
                <Option value={30}>30秒</Option>
                <Option value={60}>60秒</Option>
                <Option value={120}>120秒</Option>
              </Select>
            </Form.Item>

            <Divider />

            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saveStatus === 'saving'}
              >
                {saveStatus === 'saved' ? '已保存' : '保存配置'}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'creative',
      label: (
        <span>
          <VideoCameraOutlined />
          创作默认值
        </span>
      ),
      children: (
        <Card title="创作因子默认值" style={{ maxWidth: 800 }}>
          <Alert
            message="这些设置将作为生成视频时的默认创作因子"
            description="您可以在创建视频时修改这些默认值，也可以在项目设置中针对特定项目进行调整。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          
          <Form
            form={creativeForm}
            layout="vertical"
            onFinish={saveCreativeDefaults}
            initialValues={defaultCreativeDefaults}
          >
            <Divider orientation="left">开场与叙事</Divider>

            <Space size="large" style={{ width: '100%' }}>
              <Form.Item
                name="openingStyle"
                label="开场方式"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="直接展示">直接展示商品</Option>
                  <Option value="痛点提问">痛点提问引入</Option>
                  <Option value="悬念引入">悬念引入</Option>
                  <Option value="场景代入">场景代入</Option>
                  <Option value="故事引入">故事引入</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="voiceoverStyle"
                label="旁白风格"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="活泼热情">活泼热情</Option>
                  <Option value="知性优雅">知性优雅</Option>
                  <Option value="专业权威">专业权威</Option>
                  <Option value="亲切自然">亲切自然</Option>
                </Select>
              </Form.Item>
            </Space>

            <Divider orientation="left">视觉风格</Divider>

            <Space size="large" style={{ width: '100%' }}>
              <Form.Item
                name="colorTone"
                label="画面色调"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="暖色调">暖色调</Option>
                  <Option value="冷色调">冷色调</Option>
                  <Option value="高饱和">高饱和</Option>
                  <Option value="低饱和">低饱和</Option>
                  <Option value="中性">中性</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="subtitleStyle"
                label="字幕样式"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="大字醒目">大字醒目</Option>
                  <Option value="底部标准">底部标准</Option>
                  <Option value="动感字幕">动感字幕</Option>
                  <Option value="无字幕">无字幕</Option>
                </Select>
              </Form.Item>
            </Space>

            <Divider orientation="left">音频与节奏</Divider>

            <Space size="large" style={{ width: '100%' }}>
              <Form.Item
                name="bgmStyle"
                label="BGM 风格"
                style={{ width: 200 }}
              >
                <Select>
                  <Option value="节奏感强">节奏感强</Option>
                  <Option value="轻快">轻快</Option>
                  <Option value="温馨">温馨</Option>
                  <Option value="紧张">紧张</Option>
                  <Option value="科技">科技</Option>
                  <Option value="无BGM">无BGM</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="duration"
                label="视频时长（秒）"
                style={{ width: 150 }}
              >
                <Select>
                  <Option value={5}>5秒</Option>
                  <Option value={10}>10秒</Option>
                  <Option value={15}>15秒</Option>
                  <Option value={20}>20秒</Option>
                  <Option value={30}>30秒</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="sceneCount"
                label="分镜数量"
                style={{ width: 150 }}
              >
                <Select>
                  <Option value={1}>1个</Option>
                  <Option value={2}>2个</Option>
                  <Option value={3}>3个</Option>
                  <Option value={5}>5个</Option>
                  <Option value={8}>8个</Option>
                </Select>
              </Form.Item>
            </Space>

            <Divider />

            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saveStatus === 'saving'}
              >
                {saveStatus === 'saved' ? '已保存' : '保存默认值'}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => creativeForm.resetFields()}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'data',
      label: (
        <span>
          <DatabaseOutlined />
          数据管理
        </span>
      ),
      children: (
        <Card title="数据管理" style={{ maxWidth: 800 }}>
          <Divider orientation="left">本地数据</Divider>

          <Descriptions column={1} bordered>
            <Descriptions.Item label="系统配置">
              <Tag color="blue">已保存到 localStorage</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创作默认值">
              <Tag color="blue">已保存到 localStorage</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="项目草稿">
              <Tag color="green">自动保存</Tag>
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={initSampleData}
              loading={loading}
            >
              初始化示例数据
            </Button>

            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={clearCache}
            >
              清除浏览器缓存
            </Button>

            <Button
              icon={<SettingOutlined />}
              onClick={resetSettings}
            >
              重置所有设置为默认值
            </Button>
          </Space>

          <Divider orientation="left">数据库</Divider>

          <Alert
            message="数据库操作"
            description="数据库位于 server/data/app.db，包含项目、素材、任务等业务数据。"
            type="info"
            showIcon
          />

          <Space style={{ marginTop: 16 }}>
            <Button
              onClick={() => window.open(`${API_BASE}/api/dashboard/stats`, '_blank')}
            >
              查看数据库统计
            </Button>
          </Space>
        </Card>
      )
    },
    {
      key: 'about',
      label: (
        <span>
          <InfoCircleOutlined />
          关于系统
        </span>
      ),
      children: (
        <Card title="关于电商AIGC带货视频系统" style={{ maxWidth: 800 }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="系统名称">
              电商AIGC带货视频生成系统
            </Descriptions.Item>
            <Descriptions.Item label="版本">
              <Tag color="green">v1.0.0</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="技术栈">
              React + Ant Design + Node.js + SQLite
            </Descriptions.Item>
            <Descriptions.Item label="AI 模型">
              火山方舟（豆包）大模型
            </Descriptions.Item>
            <Descriptions.Item label="视频生成">
              Seedance Video API
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">功能模块</Divider>

          <Space size="middle" wrap>
            <Tag icon={<VideoCameraOutlined />} color="blue">视频生成</Tag>
            <Tag icon={<ExperimentOutlined />} color="green">A/B测试</Tag>
            <Tag icon={<ApiOutlined />} color="purple">多因子归因</Tag>
            <Tag icon={<SettingOutlined />} color="orange">智能Copilot</Tag>
            <Tag icon={<DatabaseOutlined />} color="cyan">素材管理</Tag>
            <Tag icon={<SettingOutlined />} color="red">合规审核</Tag>
          </Space>

          <Divider orientation="left">参赛信息</Divider>

          <Alert
            message="AI全栈挑战赛"
            description="本系统为 AI全栈挑战赛 参赛作品，实现了完整的电商带货视频AIGC解决方案。"
            type="success"
            showIcon
          />

          <Card style={{ marginTop: 24 }} type="inner" title="核心技术亮点">
            <ul>
              <li>✅ 基于大模型的智能剧本生成</li>
              <li>✅ AI驱动的视频素材创作</li>
              <li>✅ 多因子归因分析，量化创作因子效果</li>
              <li>✅ A/B自动出片对比，数据驱动优化</li>
              <li>✅ 智能Copilot辅助创作</li>
              <li>✅ 实时视频预览与编辑</li>
              <li>✅ 全流程合规审核</li>
            </ul>
          </Card>
        </Card>
      )
    }
  ];

  return (
    <div className="content-area">
      <div className="page-title">⚙️ 系统设置</div>
      <div className="page-subtitle">配置系统参数、创作默认值和数据管理</div>

      <Tabs items={tabItems} type="card" style={{ marginTop: 16 }} />
    </div>
  );
};

export default SettingsPage;
