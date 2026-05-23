class IntentParser {
  constructor() {
    this.intentPatterns = {
      'generate_video': {
        patterns: [
          /生成.*视频/i,
          /创建.*视频/i,
          /制作.*视频/i,
          /帮我.*视频/i,
          /生成.*分镜.*视频/i,
          /剪辑.*视频/i,
          /合成.*视频/i
        ],
        weight: 1.0,
        requiresConfirmation: true
      },
      'generate_image': {
        patterns: [
          /生成.*图片/i,
          /创建.*图像/i,
          /生成分镜.*图/i,
          /生成.*关键帧/i,
          /生成.*首帧/i
        ],
        weight: 1.0,
        requiresConfirmation: true
      },
      'generate_script': {
        patterns: [
          /写.*剧本/i,
          /生成.*脚本/i,
          /创作.*文案/i,
          /帮我.*写.*带货/i,
          /帮我.*写.*剧本/i
        ],
        weight: 1.0,
        requiresConfirmation: true
      },
      'edit_scene': {
        patterns: [
          /修改.*分镜/i,
          /调整.*镜头/i,
          /改.*时长/i,
          /更新.*分镜/i,
          /第.*分镜.*改成/i,
          /把.*分镜.*改成/i
        ],
        weight: 0.9,
        requiresConfirmation: false
      },
      'edit_script': {
        patterns: [
          /修改.*剧本/i,
          /改.*台词/i,
          /编辑.*文案/i,
          /更新.*旁白/i
        ],
        weight: 0.9,
        requiresConfirmation: false
      },
      'reorder': {
        patterns: [
          /调整顺序/i,
          /重新排序/i,
          /调换.*顺序/i,
          /把.*放在.*前面/i
        ],
        weight: 0.9,
        requiresConfirmation: false
      },
      'add_material': {
        patterns: [
          /上传.*素材/i,
          /添加.*图片/i,
          /引入.*材料/i,
          /上传.*商品图/i
        ],
        weight: 1.0,
        requiresConfirmation: false
      },
      'search_material': {
        patterns: [
          /搜索.*素材/i,
          /找.*图片/i,
          /检索.*材料/i,
          /有没有.*素材/i
        ],
        weight: 0.9,
        requiresConfirmation: false
      },
      'compose_video': {
        patterns: [
          /剪辑/i,
          /合成.*视频/i,
          /拼接.*视频/i,
          /把.*合在一起/i
        ],
        weight: 1.0,
        requiresConfirmation: true
      },
      'add_audio': {
        patterns: [
          /添加.*音乐/i,
          /配上.*配音/i,
          /加.*背景音/i,
          /添加.*音效/i
        ],
        weight: 1.0,
        requiresConfirmation: true
      },
      'query_status': {
        patterns: [
          /现在.*状态/i,
          /进展.*如何/i,
          /完成了.*吗/i,
          /生成.*到哪了/i
        ],
        weight: 0.8,
        requiresConfirmation: false
      },
      'explain': {
        patterns: [
          /解释.*为什么/i,
          /说明.*原因/i,
          /为什么.*这样/i
        ],
        weight: 0.7,
        requiresConfirmation: false
      },
      'delete': {
        patterns: [
          /删除.*分镜/i,
          /移除.*素材/i,
          /删掉/i
        ],
        weight: 0.9,
        requiresConfirmation: true
      }
    };

    this.entityExtractors = {
      sceneId: /第(\d+)[个]*分镜/i,
      field: /(镜头类型|时长|旁白|描述|转场|shot_type)/i,
      shotType: /(特写|中景|全景|俯拍|仰拍)/i,
      emotion: /(热情|专业|平静|幽默|震惊|温情)/i
    };
  }

  async parse(message, context = {}) {
    const intents = this.detectIntents(message);
    const entities = this.extractEntities(message, context);
    const confidence = this.calculateConfidence(intents, entities);
    const requiresConfirmation = this.checkRequiresConfirmation(intents);
    const intentDescription = this.generateIntentDescription(intents, entities);

    return {
      primaryIntent: intents[0]?.intent || 'unknown',
      intents: intents,
      entities,
      confidence,
      requiresConfirmation,
      intentDescription,
      originalMessage: message,
      timestamp: Date.now()
    };
  }

  detectIntents(message) {
    const results = [];

    for (const [intentName, config] of Object.entries(this.intentPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(message)) {
          results.push({
            intent: intentName,
            matchedPattern: pattern.source,
            weight: config.weight,
            requiresConfirmation: config.requiresConfirmation || false
          });
          break;
        }
      }
    }

    results.sort((a, b) => b.weight - a.weight);

    return results;
  }

  extractEntities(message, context) {
    const entities = {};

    const sceneIdMatch = message.match(this.entityExtractors.sceneId);
    if (sceneIdMatch) {
      entities.sceneId = parseInt(sceneIdMatch[1]);
    }

    const fieldMatch = message.match(this.entityExtractors.field);
    if (fieldMatch) {
      const fieldMap = {
        '镜头类型': 'shot_type',
        'shot_type': 'shot_type'
      };
      entities.field = fieldMap[fieldMatch[1]] || fieldMatch[1];
    }

    const shotMatch = message.match(this.entityExtractors.shotType);
    if (shotMatch) {
      entities.shotType = shotMatch[1];
    }

    const emotionMatch = message.match(this.entityExtractors.emotion);
    if (emotionMatch) {
      entities.emotion = emotionMatch[1];
    }

    const durationMatch = message.match(/(\d+)[秒]*钟/i);
    if (durationMatch) {
      entities.duration = parseInt(durationMatch[1]);
    }

    return entities;
  }

  calculateConfidence(intents, entities) {
    if (intents.length === 0) {
      return 0.3;
    }

    let confidence = intents[0].weight;

    if (entities.sceneId) confidence += 0.1;
    if (entities.field) confidence += 0.1;
    if (entities.shotType) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  checkRequiresConfirmation(intents) {
    return intents.some(i => i.requiresConfirmation);
  }

  generateIntentDescription(intents, entities) {
    if (intents.length === 0) {
      return '未知意图';
    }

    const intentMap = {
      'generate_video': '生成视频',
      'generate_image': '生成图片',
      'generate_script': '生成剧本',
      'edit_scene': '编辑分镜',
      'edit_script': '编辑剧本',
      'reorder': '调整顺序',
      'add_material': '添加素材',
      'search_material': '搜索素材',
      'compose_video': '剪辑视频',
      'add_audio': '添加音频',
      'query_status': '查询状态',
      'explain': '解释说明',
      'delete': '删除'
    };

    let description = intentMap[intents[0].intent] || intents[0].intent;

    if (entities.sceneId) {
      description += `（分镜${entities.sceneId}）`;
    }

    if (entities.field) {
      description += `的${entities.field}`;
    }

    if (entities.shotType) {
      description += `为${entities.shotType}`;
    }

    return description;
  }
}

module.exports = IntentParser;
