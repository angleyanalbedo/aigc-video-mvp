const db = require('../db');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const videoLibraryData = [
  {
    title: '【爆款】韩束水光面膜15秒种草模板',
    platform: '抖音',
    category: '美妆护肤',
    tags: JSON.stringify(['面膜', '韩束', '水光肌', '急救护肤', '种草']),
    hook_technique: '强光+素颜对比：开篇用手机闪光灯直打素颜暗沉脸，3秒内切换同角度上妆后水光透亮皮肤，形成强烈视觉冲击。配合快节奏BGM和"哒哒哒"的剪辑节奏，前3秒抓住注意力。',
    selling_points: '核心卖点：韩束大品牌背书 + 15分钟急救焕亮 + 敷完即刻上妆不搓泥。呈现方式：Before/After对比贯穿全程，产品挤出、质地展示、上脸涂抹、清水冲洗全流程展示，配文"敷完皮肤水当当，上妆超服帖"。',
    shot_analysis: '分镜节奏极快（每镜2-3秒），镜头语言：① 素颜状态（近景，脸部稍有瑕疵） ② 产品挤出特写（珍珠白质地，流动性强） ③ 上脸涂抹（中景，手法展示） ④ 静置等待（远景+特写混合） ⑤ 冲洗后水光肌（近景，光泽感） ⑥ Before/After同屏对比 ⑦ 产品展示（贴面膜状态） ⑧ 上妆服帖效果 ⑨ 品牌露出+促销信息。',
    style_analysis: '整体风格：韩系清新+快节奏种草风。色调偏暖白，高光充足，营造"水光肌"质感。节奏紧凑，全程无废话，BGM选择节奏感强的电子乐或K-pop片段。字幕风格：白色描边大字+emoji表情，符合抖音平台调性。',
    structure_analysis: '标准"痛点-方案-效果-行动"四段式结构：① 痛点钩子（0-3s）：素颜暗沉不敢出门 ② 方案引入（3-6s）：韩束水光面膜急救 ③ 效果展示（6-12s）：质地+使用+效果全程展示 ④ 行动号召（12-15s）：品牌露出+促销信息。',
    duration: 15,
    view_count: 2850000,
    like_count: 158000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/skincare1/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    title: '三顿半咖啡-沉浸式冲泡ASMR模板',
    platform: '小红书',
    category: '食品饮料',
    tags: JSON.stringify(['咖啡', '三顿半', '精品咖啡', '冲泡教程', '生活方式']),
    hook_technique: '特写+声音：开篇直接是咖啡豆研磨的特写镜头，ASMR音效（研磨声、水流声、冰块碰撞声）先声夺人，0-3秒纯声音铺垫制造"耳朵怀孕"的感觉，3秒后才出现产品。适合追求品质感的25-35岁精致生活人群。',
    selling_points: '核心卖点：迷你咖啡杯高颜值 + 精品咖啡品质 + 3种冲泡方式（冰水/牛奶/苏打水）。呈现方式：全程无口播，纯视觉+听觉享受，突出"仪式感"和"品质生活"调性。',
    shot_analysis: '分镜以特写和中景为主，节奏舒缓（每镜3-5秒）：① 咖啡豆研磨特写（声音先行） ② 迷你咖啡杯展示（360度旋转） ③ 冰块落入杯中特写 ④ 倒入液体慢动作 ⑤ 咖啡粉倒入特写 ⑥ 整体效果展示（自然光环境） ⑦ 产品陈列全家福。全部使用自然光或柔光箱，避免强光破坏质感。',
    style_analysis: '整体风格：极简北欧风+ASMR沉浸感。色调偏冷白或莫兰迪色系，避免过度饱和。高对比度但柔和，突出产品质感和生活美学。BGM：环境白噪音+轻音乐或无BGM纯ASMR音效。字幕：无或极简纯文字。',
    structure_analysis: '"感官优先-品质展示-生活方式"三段式：① 感官钩子（0-3s）：ASMR音效+特写 ② 品质展示（3-10s）：产品颜值+冲泡过程全程展示 ③ 生活方式（10-15s）：最终成品展示+生活场景暗示。整体基调：慢、精致、有品质。',
    duration: 15,
    view_count: 1280000,
    like_count: 89000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/coffee1/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    title: '【引流款】小熊加湿器场景化种草',
    platform: '抖音',
    category: '家电数码',
    tags: JSON.stringify(['加湿器', '小熊电器', '家居好物', '办公室神器', '秋冬必备']),
    hook_technique: '问题+解决方案：开篇直接展示"皮肤干燥起皮"、"嗓子不舒服"等秋冬痛点场景，配合皱眉表情，3秒内让目标用户产生代入感。然后"咔嗒"一声加湿器启动，雾气升腾，问题解决。痛点前置+即时满足是核心。',
    selling_points: '核心卖点：静音设计（图书馆级）+ 4L大容量（8小时不用加水）+ 小熊萌系颜值。呈现方式：痛点场景开场→产品展示→使用效果全程记录，口播简洁有力，配合字幕强调核心卖点数字。',
    shot_analysis: '分镜节奏适中（每镜2-4秒）：① 痛点场景（皮肤干燥特写 or 办公室场景） ② 产品开箱（配件展示） ③ 加湿器组装（中景） ④ 加水特写（4L大容量可视化） ⑤ 开机展示（静音效果可视化：安静看书） ⑥ 雾气升腾慢镜头 ⑦ 产品外观展示（萌系颜值） ⑧ 办公室/卧室场景应用 ⑨ 促销信息。',
    style_analysis: '整体风格：温馨家居风+场景化种草。色调偏暖黄或奶油白，营造"舒适生活"氛围。使用家庭/办公室真实场景，非纯白背景，增加可信度。BGM选择轻柔钢琴曲或轻爵士，符合家居调性。字幕：大字+卖点数字突出。',
    structure_analysis: '"痛点-方案-信任-行动"四段式：① 痛点钩子（0-3s）：皮肤干/嗓子难受 ② 解决方案（3-6s）：小熊加湿器 ③ 信任构建（6-12s）：产品卖点+使用效果 ④ 行动号召（12-15s）：促销信息。强调"静音""大容量""颜值"三大差异化卖点。',
    duration: 15,
    view_count: 3560000,
    like_count: 212000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/humidifier1/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    title: '蕉内501S内衣-体感种草+尺码科普',
    platform: '小红书',
    category: '服饰内衣',
    tags: JSON.stringify(['内衣', '蕉内', '无尺码', '舒适穿搭', '女性用品']),
    hook_technique: '反常识+科普：开篇抛出"你穿的内衣可能选错尺码了"这个反常识认知，配合尺码测量教程，3秒内吸引关注。不同于纯效果展示，通过"知识价值"建立专业感，适合追求舒适和高品质的女性用户。',
    selling_points: '核心卖点：蕉内大品牌 + 无尺码设计（一件适合所有体型）+ 裸感舒适。呈现方式：前半段尺码科普建立专业感，后半段产品上身效果展示，结尾"闭眼入不踩雷"行动号召。',
    shot_analysis: '分镜分两段式（每镜3-4秒）：科普段：① 错误选码问题展示 ② 正确测量方法（软尺使用） ③ 尺码对照表展示。产品段：④ 产品展示（裸感质感） ⑤-⑥ 模特上身效果（多色展示） ⑦ 产品叠放全家福 ⑧ 品牌露出。模特选择多样化身材，增加代入感。',
    style_analysis: '整体风格：品质生活+女性友好。色调温暖但不过于粉嫩，强调"舒适""自在"的品牌调性。使用柔光箱打造通透感。字幕：科普部分用图表化字幕方便理解。BGM：节奏舒缓的女声轻音乐。',
    structure_analysis: '"认知重构-产品价值-信任背书"三段式：① 认知钩子（0-4s）：选错尺码的问题 ② 产品价值（4-10s）：无尺码+舒适感展示 ③ 信任背书（10-15s）：品牌+行动号召。知识点+产品结合是最大亮点。',
    duration: 15,
    view_count: 980000,
    like_count: 67000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/lingerie1/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    title: '【食品】溜溜梅-天然健康青梅零食种草',
    platform: '抖音',
    category: '食品饮料',
    tags: JSON.stringify(['零食', '溜溜梅', '青梅', '健康零食', '酸甜口感']),
    hook_technique: '馋嘴开篇：开篇直接是青梅特写，酸到皱眉的表情特写，配合咽口水的声音，0-2秒直接勾起食欲。然后"咔嚓"一声咬下，多汁感特写，让人瞬间想下单。食欲驱动是食品类爆款的核心。',
    selling_points: '核心卖点：天然青梅 + 酸甜好口感 + 健康零食定位。呈现方式：全程食欲可视化——梅子特写、咬开多汁、表情反应、口水流涎暗示。配合"健康0添加"的文案强调。',
    shot_analysis: '分镜食欲导向（每镜1.5-3秒，快节奏）：① 青梅特写（挂在枝头 or 产品包装） ② 咬开特写（多汁感慢动作） ③ 表情反应（酸到皱眉 or 好吃到眯眼） ④ 产品陈列（多种口味） ⑤ 场景植入（办公室/追剧） ⑥ 健康配料表展示 ⑦ 促销信息。使用微距镜头展示梅子表面质感。',
    style_analysis: '整体风格：食欲诱惑+天然健康。色调偏自然清新（绿色为主色），但食欲镜头会局部提亮饱和度，让梅子看起来更有食欲。字幕：口语化+emoji（流口水/馋哭了）。BGM：节奏轻快的零食类BGM。',
    structure_analysis: '"食欲钩子-产品展示-场景植入-行动号召"四段式：① 食欲钩子（0-2s）：酸到表情特写 ② 产品展示（2-6s）：梅子特写+质感展示 ③ 场景植入（6-12s）：追剧/办公室/野餐场景 ④ 行动号召（12-15s）：促销+品牌。"酸甜开胃"是核心记忆点。',
    duration: 15,
    view_count: 4200000,
    like_count: 285000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/snack1/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    title: '极简护肤三部曲-早C晚A科学护肤模板',
    platform: '小红书',
    category: '美妆护肤',
    tags: JSON.stringify(['护肤', '早C晚A', '科学护肤', '精华', '抗老']),
    hook_technique: '知识科普+效果承诺：开篇直接抛出"早C晚A是什么"，用简单的比喻（白天抗氧化=给皮肤撑伞，晚上修护=给皮肤充电）让用户快速理解复杂的护肤原理。2-3秒内建立"这是一个有价值内容"的预期。',
    selling_points: '核心卖点：科学护肤理念 + 早C（抗氧化）+ 晚A（抗老修护）+ 简化护肤步骤。呈现方式：护肤步骤可视化 + 产品成分科普 + Before/After效果展示，专业但不失亲和力。',
    shot_analysis: '分镜分知识段+产品段（每镜3-4秒）：知识段：① 早C晚A概念图解（动画字幕） ② 白天/晚上护肤对比图。产品段：③ C类精华产品展示 ④ 早上使用手法 ⑤ A类精华产品展示 ⑥ 晚上使用手法 ⑦ 成分科普（动画字幕） ⑧ 最终效果展示 ⑨ 产品陈列。',
    style_analysis: '整体风格：专业护肤+极简美学。色调以白色和浅灰为主，突出"科学"和"极简"。产品拍摄使用专业柔光箱。字幕：图表化+重点词高亮，兼顾专业性和可读性。BGM：节奏平稳的轻音乐。',
    structure_analysis: '"认知建立-产品价值-效果背书"三段式：① 认知建立（0-4s）：早C晚A概念科普 ② 产品价值（4-10s）：产品展示+使用手法 ③ 效果背书（10-15s）：效果展示+行动号召。知识+产品结合是核心竞争力。',
    duration: 15,
    view_count: 1650000,
    like_count: 112000,
    source_declaration: '视频来源于公开网络，仅供学习研究使用，如有侵权请联系删除',
    status: 'analyzed',
    thumbnail_url: 'https://picsum.photos/seed/skincare2/400/300',
    video_url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  }
];

const templateData = [
  {
    name: '痛点前置+即时满足种草模板',
    description: '以目标用户的痛点场景开篇，快速建立代入感，随后立即展示产品解决方案，形成"痛点-解决-效果"的闭环。适合美妆、家电、家居等生活消费品类。',
    category: '通用种草',
    tags: JSON.stringify(['痛点营销', '种草', '抖音', '快节奏']),
    strategy: '痛点前置+即时满足是一种"先共情再种草"的创作策略。通过精准捕捉目标用户的日常痛点（皮肤干、嗓子难受、睡眠差等），在前3秒建立强烈的情感共鸣和代入感。一旦用户觉得"说的就是我"，立即给出简单直接的解决方案——产品。整个视频围绕"这个痛点，这个产品，解决！"这一核心逻辑展开，节奏快、信息密度高、转化路径短。',
    factors: JSON.stringify({
      opening: '痛点场景直击：开篇用近景或特写镜头展示目标用户的真实痛点场景（如皮肤干燥特写、产品效果对比），配合皱眉/叹气等表情反应，0-3秒内建立代入感。背景音可用环境音（空调房干燥的嗡嗡声等）增强真实感。',
      closing: '促销信息收尾：结尾用大字字幕+促销信息（限时XX元/买X送X等）形成行动号召，通常配合产品包装和品牌logo露出，10-15秒内完成从种草到下单的转化。',
      visual: '产品卖点可视化：将抽象卖点转化为可感知的视觉画面——静音=安静看书场景，大容量=装满水的容器，大品牌=专柜/明星代言等。使用近景和特写镜头展示产品细节和质感。',
      voiceover: '简洁有力型旁白：口播通常3-5句话，每句8-12个字，直击痛点和卖点。如"皮肤干到起皮？用它就够了！"、"嗓子不舒服？来一颗润润喉！"节奏与BGM卡点，避免拖沓。',
      bgm: '节奏感强的轻快BGM：选择抖音热门BGM片段（前奏或副歌部分），节奏与画面剪辑点卡合，营造"洗脑"效果。电子乐或K-pop片段为主。',
      color_tone: '暖白/奶油白色调：整体色调偏暖白或奶油色，营造温馨舒适的生活氛围。使用柔光箱或自然窗光，避免强光直射产生硬阴影。'
    }),
    constraint_rules: '① 痛点必须精准对应目标用户，避免过于宽泛（如"皮肤干"不如"化妆卡粉"具体） ② 痛点到产品的切换要干脆，3秒内完成 ③ 卖点展示要可视化，每个卖点对应一个画面 ④ 全程节奏要快，每镜2-4秒，避免拖沓 ⑤ 行动号召要明确，促销信息要清晰。',
    usage_count: 23,
    rating: 4.8,
    thumbnail_url: 'https://picsum.photos/seed/template1/400/300'
  },
  {
    name: 'ASMR沉浸式产品展示模板',
    description: '以声音和视觉特写为核心，营造"沉浸式"使用体验。适合食品饮料、咖啡、香薰等需要感官体验的产品。通过ASMR音效（研磨声、水流声、咀嚼声等）先声夺人，让用户产生代入感和购买欲。',
    category: '品质种草',
    tags: JSON.stringify(['ASMR', '沉浸感', '小红书', '质感']),
    strategy: 'ASMR沉浸式是一种"感官优先"的创作策略。不同于传统的口播或字幕驱动，这种模板让声音和视觉成为主角。通过精细的声音设计（咖啡研磨、冰块碰撞、产品拆封等）和高质量的特写镜头，让用户在观看视频时产生"身临其境"的感觉。一旦用户感觉"我也想喝/吃/闻"，转化就自然而然发生了。适合追求品质感和生活美学的25-40岁人群。',
    factors: JSON.stringify({
      opening: '声音先行建立氛围：开篇先出声音（2-3秒纯声音），如咖啡研磨声、冰块落入杯中的声音、香薰点燃的噼啪声等。声音先行能快速抓住注意力，同时暗示产品品类，建立"听觉预期"。',
      closing: '产品陈列+生活场景暗示：结尾用产品陈列（多角度展示产品颜值）和暗示品质生活的场景（如精致的桌面、窗边的咖啡角等），给用户"买了这个你也能过上这种生活"的暗示。',
      visual: '极致特写+慢动作：使用微距镜头或近景特写展示产品细节——咖啡液流动的质感、冰淇淋的绵密质地、香薰蜡烛的火焰等。关键镜头使用慢动作（如冰块落入水中、水花溅起等），增加视觉美感。',
      voiceover: '全程无口播或极简口播：整个视频可能没有一句旁白，完全依赖视觉和声音传达信息。如需口播，也只是简短的1-2句话，声音轻柔，与ASMR氛围协调。',
      bgm: '环境白噪音+轻音乐：选择雨声、海浪声等自然白噪音作为背景，或轻柔的钢琴/吉他曲。音量要低于ASMR音效，让声音层次分明。不使用强节奏BGM，保持"沉浸"调性。',
      color_tone: '冷白/莫兰迪色系：整体色调偏冷白或低饱和度的莫兰迪色系，营造高级感和品质感。避免过于饱和的颜色，保持画面的"通透感"和"呼吸感"。'
    }),
    constraint_rules: '① ASMR音效必须清晰、真实，避免使用罐头音效（用户能听出来） ② 特写镜头要稳，使用三脚架或稳定器，避免手抖 ③ 节奏舒缓，每镜3-8秒，不追求快节奏 ④ 整体调性要统一（一个视频不要忽冷忽热） ⑤ 产品颜值要高，ASMR模板对产品包装要求高。',
    usage_count: 15,
    rating: 4.6,
    thumbnail_url: 'https://picsum.photos/seed/template2/400/300'
  },
  {
    name: '知识科普+产品种草模板',
    description: '以前沿、有价值的知识内容吸引用户关注，在建立专业信任感后再自然植入产品。适合美妆护肤、健康食品、数码科技等需要"专业背书"的品类。通过"反常识"或"知识点"在前3秒抓住用户，让他们觉得"这个视频有价值"。',
    category: '专业种草',
    tags: JSON.stringify(['知识科普', '专业背书', '小红书', '深度内容']),
    strategy: '知识科普+产品种草是一种"价值交换"的创作策略。与其直接说"这个产品好"，不如先告诉用户一个他们不知道的知识点（如"90%的人选错尺码"、"早C晚A的原理"等）。当用户感觉"学到了"的时候，他们已经对你产生了信任感。此时再植入产品推荐，用户更容易接受。这种模板的核心逻辑是："我教你知识，你信任我，我推荐产品，你买单。" 适合有专业背景或愿意做功课的创作者。',
    factors: JSON.stringify({
      opening: '反常识/知识点钩子：开篇直接抛出用户不知道的"冷知识"或"反常识"观点，如"你敷面膜的方式可能是错的"、"XX成分白天不能用"等。用大字字幕或图解动画呈现，0-3秒内吸引"想学习"的用户。',
      closing: '产品推荐+行动号召：结尾基于前面建立的专业感，自然引出"那怎么选/用呢？推荐XX"的行动号召。可以展示产品使用效果，附上购买链接或优惠信息。',
      visual: '图解动画+产品特写：知识部分使用图解动画或大字字幕展示关键信息（测量方法、成分对比等），信息一目了然。产品部分使用近景特写展示产品外观和质感。两者结合，专业感和说服力并存。',
      voiceover: '专业但易懂型旁白：口播语调平稳、自信，像一个可靠的朋友在分享知识。每句话逻辑清晰，重点词加重音。语速适中，让用户有时间消化信息。避免过于推销感的语气。',
      bgm: '节奏平稳的轻音乐：选择不抢戏的轻音乐作为背景，钢琴曲、轻爵士或氛围音乐为主。音量低，让口播成为主角。不使用强节奏BGM，保持"学习"氛围。',
      color_tone: '专业白/浅灰+品牌色点缀：整体色调以白色或浅灰为主，传达专业和可靠感。可在产品展示部分加入品牌主色调作为点缀，增加品牌识别度。'
    }),
    constraint_rules: '① 知识点必须准确，避免误导（这会影响长期信任） ② 知识部分和信息密度要高，让用户感觉"学到了" ③ 产品植入要自然，不要生硬跳转 ④ 整体时长可适当放长（15-30秒），知识需要时间展开 ⑤ 创作者最好有一定专业背景，脚本要经得起推敲。',
    usage_count: 18,
    rating: 4.7,
    thumbnail_url: 'https://picsum.photos/seed/template3/400/300'
  }
];

function seed() {
  console.log('🌱 开始插入种子数据...');

  const videoInsert = db.prepare(`
    INSERT INTO video_library (id, title, platform, category, tags, thumbnail_url, video_url,
      hook_technique, selling_points, shot_analysis, style_analysis, structure_analysis,
      duration, view_count, like_count, source_declaration, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const templateInsert = db.prepare(`
    INSERT INTO inspiration_templates (id, name, description, category, tags, strategy, factors,
      constraint_rules, usage_count, rating, thumbnail_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let videoCount = 0;
  for (const v of videoLibraryData) {
    const id = generateId('vl');
    videoInsert.run(
      id, v.title, v.platform, v.category, v.tags, v.thumbnail_url, v.video_url,
      v.hook_technique, v.selling_points, v.shot_analysis, v.style_analysis, v.structure_analysis,
      v.duration, v.view_count, v.like_count, v.source_declaration, v.status
    );
    videoCount++;
  }
  console.log(`✅ 已插入 ${videoCount} 条视频数据`);

  let templateCount = 0;
  for (const t of templateData) {
    const id = generateId('tpl');
    templateInsert.run(
      id, t.name, t.description, t.category, t.tags, t.strategy, t.factors,
      t.constraint_rules, t.usage_count, t.rating, t.thumbnail_url
    );
    templateCount++;
  }
  console.log(`✅ 已插入 ${templateCount} 条模板数据`);

  console.log('\n🎉 种子数据插入完成！');
  console.log(`📹 视频库: ${videoCount} 条`);
  console.log(`📝 灵感模板: ${templateCount} 条`);
}

if (require.main === module) {
  try {
    seed();
    process.exit(0);
  } catch (err) {
    console.error('❌ 种子数据插入失败:', err.message);
    process.exit(1);
  }
}

module.exports = { seed, videoLibraryData, templateData };
