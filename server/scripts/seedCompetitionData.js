const db = require('../db');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedVideoLibrary() {
  const count = db.prepare('SELECT COUNT(*) as c FROM video_library').get().c;
  if (count > 0) {
    console.log(`✅ 优质视频库已有 ${count} 条数据，跳过种子`);
    return;
  }

  const videos = [
    {
      title: '美妆口红试色短视频 - 第一人称沉浸式',
      platform: 'TikTok',
      category: '美妆',
      tags: ['口红', '试色', '第一人称', '沉浸式'],
      hookTechnique: '第一人称视角直接展示上嘴效果，3秒内展示前后对比',
      sellingPoints: '持久不脱色、滋润不拔干、多色号可选',
      shotAnalysis: '特写→中景→特写，3秒一个节奏点，快速切换色号',
      styleAnalysis: '暖色调、近距离拍摄、自然光线、轻快节奏',
      structureAnalysis: '开场Hook(3s)→色号展示(6s)→效果对比(3s)→CTA(3s)',
      duration: 15,
      viewCount: 580000,
      likeCount: 45000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    },
    {
      title: '家居收纳神器展示 - 痛点对比反转',
      platform: 'Instagram',
      category: '家居',
      tags: ['收纳', '家居', '痛点对比', '反转'],
      hookTechnique: '展示杂乱场景引发共鸣，3秒后展示收纳后效果形成强烈对比',
      sellingPoints: '一秒收纳、节省空间、美观实用',
      shotAnalysis: '远景→特写→中景→远景，对比镜头为主，展示使用过程',
      styleAnalysis: '冷色调高级感、快节奏剪辑、ASMR音效',
      structureAnalysis: '痛点展示(3s)→产品引入(3s)→使用演示(5s)→效果对比(2s)→CTA(2s)',
      duration: 15,
      viewCount: 320000,
      likeCount: 28000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    },
    {
      title: '运动鞋开箱 - 悬念揭秘式',
      platform: 'Facebook',
      category: '运动',
      tags: ['运动鞋', '开箱', '悬念', '揭秘'],
      hookTechnique: '只露鞋盒不露鞋，用"你绝对猜不到"制造悬念',
      sellingPoints: '轻量化设计、缓震科技、限量配色',
      shotAnalysis: '中景→特写→全景→特写，慢动作展示细节',
      styleAnalysis: '动感节奏、暗色调+霓虹灯光、快慢交替剪辑',
      structureAnalysis: '悬念开场(3s)→开箱过程(4s)→细节展示(5s)→上脚效果(3s)',
      duration: 15,
      viewCount: 450000,
      likeCount: 38000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    },
    {
      title: '零食测评 - 真实反应式',
      platform: 'TikTok',
      category: '食品',
      tags: ['零食', '测评', '真实反应', '吃货'],
      hookTechnique: '夸张的第一口反应+音效，引发好奇心',
      sellingPoints: '口感酥脆、多种口味、性价比高',
      shotAnalysis: '近景→特写→中景→特写，以人物表情和食物特写为主',
      styleAnalysis: '明亮色调、自然光、轻松愉快、真实不做作',
      structureAnalysis: '第一口反应(3s)→产品展示(3s)→口味逐一测评(6s)→推荐总结(3s)',
      duration: 15,
      viewCount: 720000,
      likeCount: 56000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    },
    {
      title: '数码产品极简展示 - 高级感氛围',
      platform: 'Instagram',
      category: '数码',
      tags: ['数码', '极简', '高级感', '氛围'],
      hookTechnique: '纯黑背景+产品旋转出场，极简高级感瞬间抓住眼球',
      sellingPoints: '超薄设计、高清屏幕、长续航',
      shotAnalysis: '全景→特写→中景→特写，慢速运镜，大量留白',
      styleAnalysis: '极简风格、黑白灰主色调、电影级打光、BGM氛围感',
      structureAnalysis: '产品出场(3s)→细节特写(5s)→功能展示(4s)→品牌定格(3s)',
      duration: 15,
      viewCount: 280000,
      likeCount: 22000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    },
    {
      title: '服装穿搭变装 - 节奏卡点式',
      platform: 'TikTok',
      category: '服装',
      tags: ['穿搭', '变装', '卡点', '时尚'],
      hookTechnique: '音乐卡点瞬间变装，视觉冲击力极强',
      sellingPoints: '百搭款式、舒适面料、多场景适用',
      shotAnalysis: '中景→中景→中景，每个卡点切换一套穿搭，节奏感强',
      styleAnalysis: '时尚感、音乐驱动、快速剪辑、色彩丰富',
      structureAnalysis: '初始造型(2s)→卡点变装×3(9s)→最终造型展示(2s)→CTA(2s)',
      duration: 15,
      viewCount: 890000,
      likeCount: 72000,
      sourceDeclaration: '公开平台热门视频结构化分析，仅保存分析结果'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO video_library (id, title, source_url, platform, category, tags, thumbnail_url, video_url,
      hook_technique, selling_points, shot_analysis, style_analysis, structure_analysis, full_analysis,
      duration, view_count, like_count, source_declaration, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const v of videos) {
    const id = generateId('vl');
    insert.run(
      id, v.title, null, v.platform, v.category,
      JSON.stringify(v.tags), null, null,
      v.hookTechnique, v.sellingPoints, v.shotAnalysis, v.styleAnalysis, v.structureAnalysis,
      JSON.stringify({
        hookTechnique: v.hookTechnique,
        sellingPoints: v.sellingPoints,
        shotAnalysis: v.shotAnalysis,
        styleAnalysis: v.styleAnalysis,
        structureAnalysis: v.structureAnalysis
      }),
      v.duration, v.viewCount, v.likeCount, v.sourceDeclaration, 'analyzed'
    );
  }

  console.log(`✅ 已插入 ${videos.length} 条优质视频库种子数据`);
}

function seedTemplates() {
  const count = db.prepare('SELECT COUNT(*) as c FROM inspiration_templates').get().c;
  if (count > 0) {
    console.log(`✅ 灵感模板已有 ${count} 条数据，跳过种子`);
    return;
  }

  const templates = [
    {
      name: '第一人称BGM氛围沉浸',
      description: '以第一人称视角展示产品使用过程，配合氛围BGM营造沉浸感，适合美妆、食品等体验型产品',
      category: '美妆',
      tags: ['第一人称', '沉浸式', 'BGM驱动', '体验感'],
      strategy: '第一人称BGM氛围沉浸：以用户视角直接展示产品使用效果，配合氛围音乐营造身临其境的体验感',
      factors: {
        opening: '第一人称视角直接展示使用效果，3秒内展示前后对比',
        closing: '黑屏品牌名+CTA弹窗',
        visual: '近距离特写为主，自然光线，暖色调',
        voiceover: '优雅知性，轻声细语',
        bgm: '轻柔氛围音乐，节奏舒缓',
        color_tone: '暖色调，自然光感'
      },
      constraintRules: '总时长≤15秒；必须第一人称视角；BGM音量不超过旁白；画面必须展示真实使用效果',
      usageCount: 156,
      rating: 4.8
    },
    {
      name: '痛点对比反转',
      description: '先展示痛点场景引发共鸣，再展示产品解决方案形成强烈对比，适合功能性产品',
      category: '家居',
      tags: ['痛点对比', '反转', '功能展示', '共鸣'],
      strategy: '痛点对比反转：先展示用户痛点场景引发共鸣，再通过产品使用展示解决方案，形成强烈视觉对比',
      factors: {
        opening: '展示杂乱/不便场景，引发"我也是这样"的共鸣',
        closing: '完美效果展示+限时优惠弹窗',
        visual: '对比镜头为主，Before/After强烈反差',
        voiceover: '亲切自然，像朋友推荐',
        bgm: '前半段低沉，后半段轻快，配合反转',
        color_tone: '前半段冷灰调，后半段明亮暖调'
      },
      constraintRules: '总时长≤15秒；痛点展示不超过3秒；必须展示真实对比效果；禁止夸大宣传',
      usageCount: 203,
      rating: 4.6
    },
    {
      name: '节奏卡点变装',
      description: '利用音乐节拍卡点切换造型/场景，视觉冲击力强，适合服装、配饰等视觉型产品',
      category: '服装',
      tags: ['卡点', '变装', '节奏感', '视觉冲击'],
      strategy: '节奏卡点变装：利用音乐节拍精准卡点，瞬间切换造型或场景，制造强烈视觉冲击和节奏感',
      factors: {
        opening: '初始造型展示2秒，音乐渐强',
        closing: '最终造型定格+品牌Logo',
        visual: '每个卡点切换一套穿搭，中景为主',
        voiceover: '无旁白，纯音乐驱动',
        bgm: '节奏感强的电子/流行音乐，有明显节拍点',
        color_tone: '色彩丰富，每套穿搭独立色调'
      },
      constraintRules: '总时长≤15秒；至少3个卡点切换；音乐必须与画面同步；每套造型展示时间≥1秒',
      usageCount: 312,
      rating: 4.9
    },
    {
      name: '极简高级感氛围',
      description: '纯色背景+慢速运镜+电影级打光，营造高端品牌感，适合数码、奢侈品等高端产品',
      category: '数码',
      tags: ['极简', '高级感', '电影级', '氛围'],
      strategy: '极简高级感氛围：纯色背景+慢速运镜+电影级打光，用留白和质感营造高端品牌调性',
      factors: {
        opening: '纯黑/纯白背景，产品旋转/滑入出场',
        closing: '品牌Logo定格+极简Slogan',
        visual: '大量留白，慢速运镜，细节特写',
        voiceover: '低沉磁性男声或无旁白',
        bgm: '电影级氛围配乐，低频为主',
        color_tone: '黑白灰主色调，单色点缀'
      },
      constraintRules: '总时长≤15秒；画面留白≥30%；禁止花哨特效；产品必须居中构图；BGM音量柔和',
      usageCount: 89,
      rating: 4.7
    },
    {
      name: '悬念揭秘式',
      description: '用悬念开场制造好奇心，逐步揭示产品全貌，适合新品发布、限量款等',
      category: '运动',
      tags: ['悬念', '揭秘', '好奇心', '新品'],
      strategy: '悬念揭秘式：用"你绝对猜不到"等悬念话术开场，逐步揭示产品全貌，利用好奇心驱动完播率',
      factors: {
        opening: '只展示产品局部/包装，配悬念话术',
        closing: '完整产品亮相+购买引导',
        visual: '局部→全景，逐步揭示，慢动作展示细节',
        voiceover: '兴奋期待，语速偏快',
        bgm: '悬疑感前奏→高潮爆发',
        color_tone: '暗色调+霓虹点缀，科技感'
      },
      constraintRules: '总时长≤15秒；悬念部分不超过5秒；必须展示完整产品；禁止虚假悬念',
      usageCount: 145,
      rating: 4.5
    }
  ];

  const insert = db.prepare(`
    INSERT INTO inspiration_templates (id, name, description, category, tags, strategy, factors,
      constraint_rules, source_video_ids, usage_count, rating, thumbnail_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of templates) {
    const id = generateId('tpl');
    insert.run(
      id, t.name, t.description, t.category,
      JSON.stringify(t.tags), t.strategy, JSON.stringify(t.factors),
      t.constraintRules, JSON.stringify([]),
      t.usageCount, t.rating, null
    );
  }

  console.log(`✅ 已插入 ${templates.length} 条灵感模板种子数据`);
}

console.log('🌱 开始初始化赛题核心模块种子数据...');
seedVideoLibrary();
seedTemplates();
console.log('🎉 种子数据初始化完成！');
