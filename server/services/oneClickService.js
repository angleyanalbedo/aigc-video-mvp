const { llmProvider, videoProvider } = require('../services/providers');
const { VideoComposer, TTSService } = require('../services/videoComposer');
const { withRetry, sleep, videoRetryOptions, ttsRetryOptions } = require('../utils/retry');
const db = require('../db');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PORT = process.env.PORT || 3001;

[OUTPUT_DIR, TEMP_DIR, UPLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

class OneClickService {
  constructor() {
    this.tasks = new Map();
  }

  async startGeneration(input, onProgress) {
    const taskId = `oc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.tasks.set(taskId, {
      status: 'processing',
      progress: 0,
      phase: 'initializing',
      message: '初始化一键成片任务...',
      createdAt: Date.now()
    });

    this._runPipeline(taskId, input, onProgress).catch(err => {
      console.error('一键成片失败:', err);
      this.tasks.set(taskId, {
        ...this.tasks.get(taskId),
        status: 'failed',
        error: err.message,
        phase: 'failed'
      });
    });

    return taskId;
  }

  getStatus(taskId) {
    return this.tasks.get(taskId) || null;
  }

  async _runPipeline(taskId, input, onProgress) {
    const update = (progress, phase, message) => {
      this.tasks.set(taskId, {
        ...this.tasks.get(taskId),
        progress, phase, message
      });
      if (onProgress) onProgress({ taskId, progress, phase, message });
    };

    try {
      update(5, 'extracting', '提取商品信息...');

      const productInfo = await this._extractProductInfo(input);

      update(10, 'searching_materials', '检索素材库匹配素材...');
      const matchedMaterials = this._searchMaterials(productInfo);

      update(15, 'generating_script', 'AI 生成剧本...');
      const script = await this._generateScript(productInfo, matchedMaterials, input);

      this._saveScript(script, productInfo, input);

      update(25, 'generating_videos', '生成分镜视频...');
      const generatedScenes = await this._generateSceneVideos(script, input, productInfo, update);

      update(65, 'generating_tts', '生成配音...');
      let audioPath = null;
      try {
        audioPath = await this._generateTTS(generatedScenes);
      } catch (ttsErr) {
        console.warn('TTS 生成失败，跳过配音:', ttsErr.message);
      }

      update(80, 'composing', '拼接合成最终视频...');
      const composeResult = await this._composeVideo(generatedScenes, audioPath, input.options);

      this._cleanup(generatedScenes, audioPath);

      const finalResult = {
        status: 'completed',
        progress: 100,
        phase: 'completed',
        message: '一键成片完成！',
        videoUrl: `http://localhost:${PORT}/outputs/${path.basename(composeResult.outputPath)}`,
        duration: composeResult.duration,
        script,
        productInfo,
        completedAt: Date.now()
      };

      this.tasks.set(taskId, finalResult);
      if (onProgress) onProgress({ taskId, progress: 100, phase: 'completed', message: '一键成片完成！' });

      console.log(`✅ 一键成片完成: ${taskId}`);
      return finalResult;

    } catch (error) {
      console.error(`❌ 一键成片失败: ${taskId}`, error);
      this.tasks.set(taskId, {
        ...this.tasks.get(taskId),
        status: 'failed',
        error: error.message,
        phase: 'failed'
      });
      throw error;
    }
  }

  async _extractProductInfo(input) {
    if (input.productInfo && input.productInfo.title) {
      return {
        title: input.productInfo.title,
        sellingPoints: input.productInfo.sellingPoints || '',
        targetAudience: input.productInfo.targetAudience || '',
        category: input.productInfo.category || '',
        price: input.productInfo.price || '',
        imageUrl: input.productImage || null
      };
    }

    if (input.productLink) {
      try {
        const extracted = await llmProvider.generateStructuredText({
          system: '你是电商商品信息提取专家。从给定的商品链接或描述中提取商品信息。',
          prompt: `请从以下商品链接/描述中提取商品信息：\n${input.productLink}`,
          schema: {
            title: 'string',
            sellingPoints: 'string',
            targetAudience: 'string',
            category: 'string',
            price: 'string'
          }
        });
        return { ...extracted, imageUrl: input.productImage || null };
      } catch (err) {
        console.warn('商品信息提取失败，使用链接作为标题:', err.message);
        return {
          title: input.productLink,
          sellingPoints: '',
          targetAudience: '',
          category: '',
          price: '',
          imageUrl: input.productImage || null
        };
      }
    }

    if (input.productImage) {
      return {
        title: '商品推广视频',
        sellingPoints: '高品质、实用性强',
        targetAudience: '普通消费者',
        category: '',
        price: '',
        imageUrl: input.productImage
      };
    }

    throw new Error('请提供商品链接、商品图片或商品信息');
  }

  _searchMaterials(productInfo) {
    const materials = [];
    try {
      const keyword = productInfo.title || productInfo.category || '';
      if (keyword) {
        const rows = db.prepare(
          "SELECT * FROM materials WHERE filename LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 10"
        ).all(`%${keyword}%`, `%${keyword}%`);
        rows.forEach(r => {
          try { r.tags = JSON.parse(r.tags); } catch {}
          materials.push(r);
        });
      }
    } catch (err) {
      console.warn('素材检索失败:', err.message);
    }
    return materials;
  }

  async _generateScript(productInfo, matchedMaterials, input) {
    const materialContext = matchedMaterials.length > 0
      ? `\n## 可用素材\n${matchedMaterials.map(m => `- ${m.filename}: ${m.url}`).join('\n')}`
      : '';

    const templateContext = input.templateId
      ? await this._loadTemplateContext(input.templateId)
      : '';

    const referenceContext = input.referenceVideoId
      ? await this._loadReferenceContext(input.referenceVideoId)
      : '';

    let systemPrompt = `你是电商带货视频剧本生成专家。根据商品信息生成高质量的带货视频剧本。

## 剧本要求
1. 结构清晰：包含开场Hook、卖点展示、结尾行动号召
2. 分镜详细：每个分镜包含画面描述、旁白、时长、镜头类型
3. 符合电商规范：突出商品卖点，引导购买
4. 总时长控制在15秒以内（3-5个分镜）
5. 画面描述要具体，适合AI视频生成

## 输出格式
JSON格式：
{
  "title": "剧本标题",
  "scenes": [
    {
      "id": 1,
      "description": "画面描述（AI视频生成提示词，英文）",
      "voiceover": "旁白/台词（中文）",
      "duration": 3,
      "shot": "镜头类型（特写/近景/中景/远景）",
      "emotion": "情绪（积极/温馨/激动/专业）",
      "transition": "转场（fade/cut/dissolve）"
    }
  ]
}`;

    let userPrompt = `## 商品信息
- 商品名称：${productInfo.title}
- 卖点描述：${productInfo.sellingPoints || '高品质、实用性强'}
- 目标人群：${productInfo.targetAudience || '普通消费者'}
- 商品类目：${productInfo.category || '综合'}
- 商品价格：${productInfo.price || '面议'}
${materialContext}${templateContext}${referenceContext}

## 任务
请根据以上信息生成一个15秒以内的带货视频剧本。`;

    try {
      const script = await llmProvider.generateStructuredText({
        system: systemPrompt,
        prompt: userPrompt,
        schema: {
          title: 'string',
          scenes: [{
            id: 'number',
            description: 'string',
            voiceover: 'string',
            duration: 'number',
            shot: 'string',
            emotion: 'string',
            transition: 'string'
          }]
        }
      });

      const totalDuration = (script.scenes || []).reduce((sum, s) => sum + (s.duration || 3), 0);
      return {
        title: script.title || `${productInfo.title} - 带货视频`,
        scenes: (script.scenes || []).map((scene, index) => ({
          id: index + 1,
          description: scene.description,
          voiceover: scene.voiceover,
          duration: scene.duration || 3,
          shot_type: scene.shot || '中景',
          emotion: scene.emotion || '积极',
          transition: scene.transition || 'fade',
          status: 'idle',
          videoUrl: null
        })),
        totalDuration,
        createdAt: Date.now()
      };
    } catch (err) {
      console.warn('LLM 剧本生成失败，使用默认剧本:', err.message);
      return this._getFallbackScript(productInfo);
    }
  }

  async _loadTemplateContext(templateId) {
    try {
      const row = db.prepare('SELECT * FROM inspiration_templates WHERE id = ?').get(templateId);
      if (!row) return '';
      const factors = typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors;
      return `\n## 灵感模板指导
- 策略：${row.strategy}
- 因子：${JSON.stringify(factors, null, 2)}
- 约束规则：${row.constraint_rules || '无'}`;
    } catch { return ''; }
  }

  async _loadReferenceContext(referenceVideoId) {
    try {
      const row = db.prepare('SELECT * FROM video_library WHERE id = ?').get(referenceVideoId);
      if (!row) return '';
      return `\n## 参考爆款视频
- 标题：${row.title}
- Hook手法：${row.hook_technique || '无'}
- 卖点：${row.selling_points || '无'}
- 分镜分析：${row.shot_analysis || '无'}
- 风格分析：${row.style_analysis || '无'}
请参考此爆款视频的结构和手法，融合商品信息生成同款剧本。`;
    } catch { return ''; }
  }

  async _generateSceneVideos(script, input, productInfo, update) {
    const scenes = script.scenes;
    const generatedScenes = [];
    const options = input.options || {};

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const progressBase = 25 + (i / scenes.length) * 40;
      update(Math.floor(progressBase), 'generating_videos', `生成分镜 ${i + 1}/${scenes.length} 视频...`);

      let videoUrl;
      try {
        const imageUrl = scene.imageUrl || scene.referenceImageUrl || productInfo?.imageUrl || null;

        const task = await withRetry(async () => {
          return await videoProvider.createTask({
            prompt: scene.description,
            resolution: options.resolution || '720p',
            ratio: options.ratio || '9:16',
            duration: scene.duration || 4,
            imageUrl: imageUrl
          });
        }, videoRetryOptions);

        videoUrl = await this._pollVideoCompletion(task.id);
      } catch (err) {
        console.warn(`分镜 ${i + 1} 视频生成失败:`, err.message);
        throw new Error(`分镜 ${i + 1} 视频生成失败: ${err.message}`);
      }

      const videoPath = path.join(TEMP_DIR, `oc_scene_${i}_${Date.now()}.mp4`);
      await this._downloadFile(videoUrl, videoPath);

      try {
        const persistFilename = `oc_scene_${Date.now()}_${i}.mp4`;
        const persistPath = path.join(OUTPUT_DIR, persistFilename);
        fs.copyFileSync(videoPath, persistPath);
      } catch (persistErr) {
        console.warn('持久化分镜视频失败:', persistErr.message);
      }

      generatedScenes.push({
        ...scene,
        videoPath,
        videoUrl
      });
    }

    return generatedScenes;
  }

  async _generateTTS(generatedScenes) {
    const fullScriptText = generatedScenes
      .map(s => s.voiceover || '')
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!fullScriptText) return null;

    const ttsService = new TTSService();
    const result = await withRetry(async () => {
      return await ttsService.generate(fullScriptText, {
        voice: 'zh-CN-XiaoxiaoNeural',
        rate: '+0%',
        outputDir: TEMP_DIR
      });
    }, ttsRetryOptions);

    return result.audioFile;
  }

  async _composeVideo(generatedScenes, audioPath, options = {}) {
    const composer = new VideoComposer(generatedScenes, {
      outputDir: OUTPUT_DIR,
      tempDir: TEMP_DIR,
      transition: options.transition || 'fade'
    });

    return await composer.compose(audioPath);
  }

  _saveScript(script, productInfo, input) {
    try {
      const id = `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(`
        INSERT INTO scripts (id, title, content, generation_mode, template_id, reference_video_id, product_info, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        script.title,
        JSON.stringify(script),
        input.templateId ? 'template' : input.referenceVideoId ? 'copywriting' : 'auto',
        input.templateId || null,
        input.referenceVideoId || null,
        JSON.stringify(productInfo),
        'generated'
      );
      console.log(`✅ 剧本已保存: ${id}`);
    } catch (err) {
      console.warn('剧本保存失败:', err.message);
    }
  }

  _cleanup(generatedScenes, audioPath) {
    generatedScenes.forEach(s => {
      try { if (s.videoPath && fs.existsSync(s.videoPath)) fs.unlinkSync(s.videoPath); } catch {}
    });
    try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch {}
  }

  async _pollVideoCompletion(taskId, maxAttempts = 180) {
    const intervalMs = 3000;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await videoProvider.getStatus(taskId);
        if (status.status === 'succeeded') {
          if (status.videoUrl) return status.videoUrl;
          throw new Error('视频生成成功但没有返回 URL');
        }
        if (status.status === 'failed') {
          throw new Error(status.error || '视频生成失败');
        }
      } catch (err) {
        if (err.message.includes('failed') || err.message.includes('没有返回 URL')) throw err;
        console.warn(`轮询异常（继续）: ${err.message}`);
      }
      await sleep(intervalMs);
    }
    throw new Error('视频生成超时');
  }

  async _downloadFile(url, destPath) {
    if (url.startsWith('file://')) {
      fs.copyFileSync(url.replace('file://', ''), destPath);
      return;
    }
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
  }

  _getFallbackScript(productInfo) {
    const title = productInfo.title || '商品';
    const sellingPoints = productInfo.sellingPoints || '优质商品';
    return {
      title: `${title} - 带货视频`,
      scenes: [
        {
          id: 1,
          description: `Professional product showcase of ${title}, clean white background, high-end commercial photography style, soft lighting`,
          voiceover: `大家好，今天给大家推荐一款超棒的${title}`,
          duration: 3,
          shot_type: '特写',
          emotion: '积极',
          transition: 'fade',
          status: 'idle',
          videoUrl: null
        },
        {
          id: 2,
          description: `Close-up shot showing ${title} details, highlighting quality and features, warm lighting`,
          voiceover: `${sellingPoints}，品质保证`,
          duration: 5,
          shot_type: '近景',
          emotion: '温馨',
          transition: 'fade',
          status: 'idle',
          videoUrl: null
        },
        {
          id: 3,
          description: `Lifestyle shot showing ${title} in use, happy customer experience, bright atmosphere`,
          voiceover: '赶紧下单吧！',
          duration: 4,
          shot_type: '中景',
          emotion: '激动',
          transition: 'fade',
          status: 'idle',
          videoUrl: null
        }
      ],
      totalDuration: 12,
      createdAt: Date.now(),
      isFallback: true
    };
  }
}

module.exports = new OneClickService();
