# 视频因子数据与A/B测试集成说明

## 概述

已为系统添加了完整的视频因子记录和A/B测试数据关联功能。现在每个视频生成后可以记录创作因子，并在发布时自动生成智能Mock效果数据。

## 新增功能

### 1. 视频因子记录表 (`video_factors`)
记录每个视频生成时使用的创作因子：
- 开场方式 (opening_style)
- BGM风格 (bgm_style)
- 旁白风格 (voiceover_style)
- 画面色调 (color_tone)
- 字幕样式 (subtitle_style)
- 画幅比例 (aspect_ratio)
- 视频时长 (duration)
- 分镜数量 (scene_count)

### 2. 视频发布记录表 (`video_publishing_records`)
记录视频发布和Mock效果数据：
- 播放量 (mock_views)
- 完播率 (mock_completion_rate)
- 点击率 (mock_click_rate)
- 转化率 (mock_conversion_rate)
- 点赞/评论/分享数
- 关联的A/B实验ID和变体ID

### 3. 智能Mock数据生成
基于创作因子智能生成效果数据：
- 不同因子组合会产生不同的效果权重
- 例如："痛点提问"开场比"直接展示"有更高的完播率和转化率
- "节奏感强BGM"比"无BGM"有更好的观看体验

## API接口

### 记录视频因子
```javascript
POST /api/video-factors/factors
{
  "projectId": "proj_xxx",
  "openingStyle": "痛点提问",
  "bgmStyle": "节奏感强",
  "voiceoverStyle": "活泼热情",
  "colorTone": "暖色调",
  "duration": 15,
  "productName": "羽绒服"
}
```

### 发布视频
```javascript
POST /api/video-factors/publish
{
  "projectId": "proj_xxx",
  "platform": "douyin",
  "productName": "羽绒服",
  "experimentId": "exp_xxx",  // 可选
  "variantId": "variant_a"     // 可选
}
```

### 获取项目发布记录
```javascript
GET /api/video-factors/publish/project/:projectId
```

### 获取实验发布记录
```javascript
GET /api/video-factors/publish/experiment/:experimentId
```

### 获取归因分析数据
```javascript
GET /api/video-factors/attribution/data
```

## 前端集成

### 在视频生成后记录因子
```typescript
import { recordVideoFactors, publishVideo } from '../utils/api';

// 视频生成完成后
const factors = {
  openingStyle: '痛点提问',
  bgmStyle: '节奏感强',
  voiceoverStyle: '活泼热情',
  colorTone: '暖色调',
  duration: 15,
  sceneCount: 3,
  productName: '轻薄羽绒服'
};

// 记录因子
await recordVideoFactors(projectId, factors);

// 发布视频并生成Mock数据
await publishVideo(projectId, {
  platform: 'douyin',
  productName: '轻薄羽绒服',
  experimentId: experimentId,  // 如果关联A/B实验
  variantId: variantId
});
```

## 数据初始化

运行初始化脚本生成示例数据：

```bash
cd server
node scripts/initVideoData.js
```

这将生成：
- 50个视频因子记录
- 50个发布记录
- 3个示例A/B测试实验
- 总播放量约100万
- 平均完播率约93%
- 平均转化率约15%

## 智能权重系统

系统内置了因子效果权重，例如：

### 开场方式影响
| 开场方式 | 完播率加成 | 转化率加成 |
|---------|----------|----------|
| 悬念引入 | +18% | +15% |
| 痛点提问 | +15% | +12% |
| 故事引入 | +14% | +11% |
| 场景代入 | +12% | +10% |
| 直接展示 | +5% | +8% |

### BGM风格影响
| BGM风格 | 完播率加成 | 转化率加成 |
|--------|----------|----------|
| 节奏感强 | +12% | +10% |
| 紧张 | +10% | +7% |
| 轻快 | +8% | +6% |
| 温馨 | +6% | +9% |
| 无BGM | -5% | -3% |

### 画面色调影响
| 色调 | 完播率加成 | 转化率加成 |
|-----|----------|----------|
| 高饱和 | +10% | +6% |
| 暖色调 | +8% | +7% |
| 中性 | +6% | +6% |
| 低饱和 | +4% | +5% |
| 冷色调 | +5% | +4% |

## 查看效果

启动服务器后访问：

1. **A/B测试页面**: 查看实验结果对比
2. **多因子归因分析页面**: 查看各因子对转化率的影响

## 注意事项

1. **数据持久化**: 所有数据存储在 `server/data/app.db` SQLite数据库中
2. **外键约束**: 发布记录需要关联有效的项目ID
3. **Mock数据**: 效果数据基于智能算法生成，仅用于演示目的
4. **实时更新**: 每次发布视频都会更新统计数据
