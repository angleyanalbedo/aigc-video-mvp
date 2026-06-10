/**
 * Tool Registry — 统一工具注册中心
 *
 * 所有工具在这里定义一次，JSON Schema 描述供 LLM 理解，execute 函数供执行。
 * 替代原 agentTools.js (Zod) + toolExecutor.js (switch) 的分散设计。
 */

const projectModel = require('../../models/project');
const { updateSceneAsset } = require('./workbenchAPI');
const videoAPI = require('./videoAPI');
const ttsAPI = require('./ttsAPI');

// ─── 工具定义 ───────────────────────────────────────────────

const tools = [

  {
    name: 'generate_script',
    description: '根据商品信息生成短视频分镜剧本。包含场景描述、旁白、时长、镜头类型等。',
    parameters: {
      type: 'object',
      properties: {
        productInfo: {
          type: 'object',
          description: '商品信息（名称、卖点、受众、风格、价格）',
          properties: {
            title: { type: 'string' },
            sellingPoints: { type: 'string' },
            targetAudience: { type: 'string' },
            style: { type: 'string' },
            price: { type: 'string' }
          }
        }
      },
      required: ['productInfo']
    },
    execute: async (params, context) => {
      const scriptAgent = require('../scriptAgent');
      const project = projectModel.getById(context.projectId);
      const productInfo = params.productInfo || project.product_info;
      if (!productInfo) return '❌ 没有商品信息，请先上传素材并分析';
      const script = await scriptAgent.generate(productInfo, context.projectId);
      await projectModel.update(context.projectId, { script });
      const canvasSyncService = require('../../services/canvasSyncService');
      await canvasSyncService.syncScriptToCanvas(context.projectId, script);
      return `✅ 剧本生成完成，共 ${script.scenes?.length || 0} 个分镜`;
    }
  },

  {
    name: 'generate_video',
    description: '为指定分镜生成视频。需要分镜已有首帧图片或描述。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' }
      },
      required: ['sceneId']
    },
    execute: async (params, context) => {
      const videoAgent = require('../videoAgent');
      const project = projectModel.getById(context.projectId);
      const scene = project.script?.scenes?.[params.sceneId - 1];
      if (!scene) return `❌ 分镜 ${params.sceneId} 不存在`;
      const result = await videoAgent.generateScene(scene, {
        projectId: context.projectId,
        sceneIndex: params.sceneId - 1,
        resolution: '720p',
        ratio: '9:16'
      });
      return result.videoUrl
        ? `✅ 分镜 ${params.sceneId} 视频生成成功`
        : `❌ 分镜 ${params.sceneId} 视频生成失败: ${result.error || '未知错误'}`;
    }
  },

  {
    name: 'generate_image',
    description: '为指定分镜生成关键帧图片。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' }
      },
      required: ['sceneId']
    },
    execute: async (params, context) => {
      const imageAgent = require('../imageAgent');
      const project = projectModel.getById(context.projectId);
      const scene = project.script?.scenes?.[params.sceneId - 1];
      if (!scene) return `❌ 分镜 ${params.sceneId} 不存在`;
      const result = await imageAgent.generateImage(
        scene.description, scene.referenceImageUrl, context.projectId, params.sceneId
      );
      return result.success ? `✅ 分镜 ${params.sceneId} 图片生成成功` : `❌ 图片生成失败`;
    }
  },

  {
    name: 'compose_video',
    description: '将所有已生成的分镜视频拼接为最终成片，可选添加TTS配音。',
    parameters: {
      type: 'object',
      properties: {
        addTTS: { type: 'boolean', description: '是否添加TTS配音', default: true }
      }
    },
    execute: async (params, context) => {
      const clipAgent = require('../clipAgent');
      const project = projectModel.getById(context.projectId);
      const script = project.script;
      if (!script?.scenes) return '❌ 没有剧本';
      const videos = script.scenes.filter(s => s.videoUrl).map(s => ({ sceneId: s.id, videoUrl: s.videoUrl }));
      if (videos.length === 0) return '❌ 没有已生成的视频';
      const result = await clipAgent.execute(script, videos, { addTTS: params.addTTS !== false });
      return result.video ? `✅ 视频合成完成` : `❌ 合成失败`;
    }
  },

  {
    name: 'update_scene',
    description: '更新分镜的某个字段（描述、旁白、时长、镜头类型等）。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' },
        field: { type: 'string', description: '字段名: description, voiceover, duration, shot_type, emotion, transition' },
        value: { description: '字段值' }
      },
      required: ['sceneId', 'field', 'value']
    },
    execute: async (params, context) => {
      const result = await updateSceneAsset(context.projectId, params.sceneId - 1, params.field, params.value);
      return result.success
        ? `✅ 分镜 ${params.sceneId} 的 ${params.field} 已更新`
        : `❌ 更新失败: ${result.error}`;
    }
  },

  {
    name: 'get_project',
    description: '获取当前项目的完整信息，包括素材、剧本、商品信息、设置等。',
    parameters: { type: 'object', properties: {} },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project) return '❌ 项目不存在';
      return JSON.stringify({
        name: project.name,
        description: project.description,
        productInfo: project.product_info,
        materials: (project.materials || []).map(m => ({ id: m.id, filename: m.filename, type: m.type })),
        script: project.script,
        settings: project.settings
      }, null, 2);
    }
  },

  {
    name: 'get_scenes',
    description: '获取所有分镜的当前状态。',
    parameters: { type: 'object', properties: {} },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有分镜数据';
      return JSON.stringify(project.script.scenes.map((s, i) => ({
        id: i + 1,
        description: s.description?.slice(0, 50),
        voiceover: s.voiceover?.slice(0, 30),
        duration: s.duration,
        shot_type: s.shot_type,
        hasImage: !!s.imageUrl,
        hasVideo: !!s.videoUrl,
        hasAudio: !!s.audioUrl,
        status: s.status
      })), null, 2);
    }
  },

  {
    name: 'save_script',
    description: '保存完整的剧本到项目。',
    parameters: {
      type: 'object',
      properties: {
        script: {
          type: 'object',
          description: '剧本对象，包含 title 和 scenes 数组',
          properties: {
            title: { type: 'string' },
            scenes: { type: 'array' }
          },
          required: ['title', 'scenes']
        }
      },
      required: ['script']
    },
    execute: async (params, context) => {
      await projectModel.update(context.projectId, { script: params.script });
      return `✅ 剧本已保存，共 ${params.script.scenes?.length || 0} 个分镜`;
    }
  },

  {
    name: 'generate_tts',
    description: '为指定分镜生成TTS配音。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' },
        voice: { type: 'string', description: '声音: zh_female_story, zh_male_narrator, zh_male_technology, zh_female_chitchat' }
      },
      required: ['sceneId']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      const scene = project.script?.scenes?.[params.sceneId - 1];
      if (!scene?.voiceover) return `❌ 分镜 ${params.sceneId} 没有旁白文本`;
      const result = await ttsAPI.generateTTS({
        text: scene.voiceover,
        voice: params.voice || 'zh_female_story',
        speed: 1.0, volume: 0.8
      });
      if (result.audioFile) {
        await updateSceneAsset(context.projectId, params.sceneId - 1, 'audioUrl', result.audioFile);
        return `✅ 分镜 ${params.sceneId} 配音生成成功`;
      }
      return `❌ 配音生成失败`;
    }
  },

  {
    name: 'search_materials',
    description: '搜索项目素材库。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' }
      }
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.materials?.length) return '❌ 项目没有素材';
      let materials = project.materials;
      if (params.keyword) {
        materials = materials.filter(m =>
          m.filename?.includes(params.keyword) || m.tags?.some(t => t.includes(params.keyword))
        );
      }
      return JSON.stringify(materials.map(m => ({ id: m.id, filename: m.filename, type: m.type })), null, 2);
    }
  },

  {
    name: 'add_scene',
    description: '在剧本末尾添加一个新分镜。',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '分镜画面描述' },
        voiceover: { type: 'string', description: '旁白文本' },
        duration: { type: 'number', description: '时长（秒）', default: 5 },
        shot_type: { type: 'string', description: '镜头类型: 特写/中景/全景', default: '中景' }
      },
      required: ['description']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      const script = project.script || { title: '带货剧本', scenes: [] };
      script.scenes = script.scenes || [];
      script.scenes.push({
        id: script.scenes.length + 1,
        description: params.description,
        voiceover: params.voiceover || '',
        duration: params.duration || 5,
        shot_type: params.shot_type || '中景',
        status: 'pending'
      });
      await projectModel.update(context.projectId, { script });
      return `✅ 已添加分镜 ${script.scenes.length}`;
    }
  },

  {
    name: 'edit_script',
    description: '根据反馈修改剧本，只调整受影响的分镜。',
    parameters: {
      type: 'object',
      properties: {
        feedback: { type: 'string', description: '修改意见' }
      },
      required: ['feedback']
    },
    execute: async (params, context) => {
      const scriptAgent = require('../scriptAgent');
      const project = projectModel.getById(context.projectId);
      if (!project?.script) return '❌ 没有剧本可修改';
      const refined = await scriptAgent.refine(project.script, params.feedback);
      await projectModel.update(context.projectId, { script: refined });
      return `✅ 剧本已根据反馈修改`;
    }
  },

  {
    name: 'query_status',
    description: '查询当前项目的进度状态。',
    parameters: { type: 'object', properties: {} },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '暂无剧本';
      const scenes = project.script.scenes;
      const total = scenes.length;
      const done = scenes.filter(s => s.videoUrl).length;
      const imgDone = scenes.filter(s => s.imageUrl).length;
      const audioDone = scenes.filter(s => s.audioUrl).length;
      return `📊 项目状态：共 ${total} 个分镜，${imgDone} 张图片已生成，${done} 个视频已渲染，${audioDone} 段配音已生成`;
    }
  },

  {
    name: 'explain',
    description: '当用户问的是知识性问题或闲聊时使用此工具，不需要操作项目。',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '用户的问题' }
      },
      required: ['question']
    },
    execute: async (params, context) => {
      const agentChatService = require('../../services/agentChatService');
      const reply = await agentChatService.generateGeneralChat(params.question, context.sessionContext);
      return reply;
    }
  },

  // ─── 补齐工具 ─────────────────────────────────────────

  {
    name: 'delete_scene',
    description: '删除指定分镜，剩余分镜自动重新编号。删除后会同步更新画布。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '要删除的分镜序号（从1开始）' }
      },
      required: ['sceneId']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有剧本';
      const idx = params.sceneId - 1;
      if (idx < 0 || idx >= project.script.scenes.length) return `❌ 分镜 ${params.sceneId} 不存在`;
      const deleted = project.script.scenes.splice(idx, 1)[0];
      // 重新编号
      project.script.scenes.forEach((s, i) => { s.id = i + 1; });
      await projectModel.update(context.projectId, { script: project.script });
      const canvasSyncService = require('../../services/canvasSyncService');
      await canvasSyncService.syncScriptToCanvas(context.projectId, project.script);
      return `✅ 已删除分镜 ${params.sceneId}（${deleted.description?.slice(0, 20)}...），剩余 ${project.script.scenes.length} 个分镜`;
    }
  },

  {
    name: 'reorder_scene',
    description: '将分镜移动到新位置，其余分镜自动重新编号。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '要移动的分镜序号（从1开始）' },
        newPosition: { type: 'number', description: '目标位置（从1开始）' }
      },
      required: ['sceneId', 'newPosition']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有剧本';
      const scenes = project.script.scenes;
      const fromIdx = params.sceneId - 1;
      const toIdx = params.newPosition - 1;
      if (fromIdx < 0 || fromIdx >= scenes.length) return `❌ 分镜 ${params.sceneId} 不存在`;
      if (toIdx < 0 || toIdx >= scenes.length) return `❌ 目标位置 ${params.newPosition} 超出范围（共 ${scenes.length} 个分镜）`;
      const [moved] = scenes.splice(fromIdx, 1);
      scenes.splice(toIdx, 0, moved);
      scenes.forEach((s, i) => { s.id = i + 1; });
      await projectModel.update(context.projectId, { script: project.script });
      const canvasSyncService = require('../../services/canvasSyncService');
      await canvasSyncService.syncScriptToCanvas(context.projectId, project.script);
      return `✅ 分镜已从位置 ${params.sceneId} 移动到 ${params.newPosition}，当前顺序: ${scenes.map(s => s.id).join('→')}`;
    }
  },

  {
    name: 'set_video_params',
    description: '设置指定分镜的视频渲染参数（分辨率、宽高比）。下次渲染时生效。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' },
        resolution: { type: 'string', description: '分辨率: 720p 或 480p', enum: ['720p', '480p'] },
        ratio: { type: 'string', description: '宽高比: 9:16(竖屏), 16:9(横屏), 1:1(方形), 4:3', enum: ['9:16', '16:9', '1:1', '4:3'] }
      },
      required: ['sceneId']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有剧本';
      const scene = project.script.scenes[params.sceneId - 1];
      if (!scene) return `❌ 分镜 ${params.sceneId} 不存在`;
      scene.videoParams = scene.videoParams || {};
      if (params.resolution) scene.videoParams.resolution = params.resolution;
      if (params.ratio) scene.videoParams.ratio = params.ratio;
      await projectModel.update(context.projectId, { script: project.script });
      return `✅ 分镜 ${params.sceneId} 渲染参数: 分辨率=${scene.videoParams.resolution || '720p'}, 宽高比=${scene.videoParams.ratio || '9:16'}`;
    }
  },

  {
    name: 'set_audio_mix',
    description: '设置全局音频混音参数（TTS音量、BGM音量、BGM链接）。合成成片时生效。',
    parameters: {
      type: 'object',
      properties: {
        ttsVolume: { type: 'number', description: 'TTS配音音量 0-1，默认0.8' },
        bgmVolume: { type: 'number', description: 'BGM背景音乐音量 0-1，默认0.2' },
        bgmUrl: { type: 'string', description: 'BGM音频文件URL（可选）' }
      }
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project) return '❌ 项目不存在';
      const settings = project.settings || {};
      settings.audioMix = settings.audioMix || { ttsVolume: 0.8, bgmVolume: 0.2 };
      if (params.ttsVolume !== undefined) settings.audioMix.ttsVolume = Math.max(0, Math.min(1, params.ttsVolume));
      if (params.bgmVolume !== undefined) settings.audioMix.bgmVolume = Math.max(0, Math.min(1, params.bgmVolume));
      if (params.bgmUrl !== undefined) settings.audioMix.bgmUrl = params.bgmUrl;
      await projectModel.update(context.projectId, { settings });
      return `✅ 音频混音参数已更新: TTS音量=${settings.audioMix.ttsVolume}, BGM音量=${settings.audioMix.bgmVolume}${settings.audioMix.bgmUrl ? ', BGM=' + settings.audioMix.bgmUrl.slice(0, 40) : ''}`;
    }
  },

  {
    name: 'parallel_generate_video',
    description: '同时渲染多个分镜的视频（并行执行，速度更快）。传入分镜序号数组。',
    parameters: {
      type: 'object',
      properties: {
        sceneIds: { type: 'array', items: { type: 'number' }, description: '分镜序号数组，如 [1, 2, 3]' }
      },
      required: ['sceneIds']
    },
    execute: async (params, context) => {
      const videoAgent = require('../videoAgent');
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有剧本';
      const scenes = params.sceneIds
        .map(id => project.script.scenes[id - 1])
        .filter(Boolean);
      if (scenes.length === 0) return '❌ 没有有效的分镜';
      const results = await Promise.allSettled(
        scenes.map(scene => videoAgent.generateScene(scene, {
          projectId: context.projectId,
          sceneIndex: scene.id - 1,
          resolution: scene.videoParams?.resolution || '720p',
          ratio: scene.videoParams?.ratio || '9:16'
        }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.videoUrl).length;
      const failed = results.length - succeeded;
      return `✅ 并行渲染完成: ${succeeded} 成功，${failed} 失败（共 ${results.length} 个分镜）`;
    }
  },

  {
    name: 'link_material',
    description: '将素材库中的素材关联到指定分镜（作为首帧图片或参考图）。',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'number', description: '分镜序号（从1开始）' },
        materialId: { type: 'string', description: '素材ID' }
      },
      required: ['sceneId', 'materialId']
    },
    execute: async (params, context) => {
      const project = projectModel.getById(context.projectId);
      if (!project?.script?.scenes) return '❌ 没有剧本';
      const scene = project.script.scenes[params.sceneId - 1];
      if (!scene) return `❌ 分镜 ${params.sceneId} 不存在`;
      const material = project.materials?.find(m => m.id === params.materialId);
      if (!material) return `❌ 素材 ${params.materialId} 不存在`;
      if (material.type === 'image' || material.type === 'video') {
        scene.imageUrl = material.url || material.file_path;
        scene.referenceImageUrl = material.url || material.file_path;
      }
      scene.linkedMaterialId = params.materialId;
      await projectModel.update(context.projectId, { script: project.script });
      return `✅ 已将素材 "${material.filename}" 关联到分镜 ${params.sceneId}`;
    }
  },

  {
    name: 'analyze_material',
    description: '分析用户上传的图片、视频或文件，提取商品信息（名称、卖点、受众、风格、价格）。当用户上传了附件并要求分析时使用。',
    parameters: {
      type: 'object',
      properties: {
        fileUrl: { type: 'string', description: '文件URL（可选，不传则自动使用当前消息的附件）' },
        fileName: { type: 'string', description: '文件名（可选）' },
        fileType: { type: 'string', description: '文件类型: image, video, file（可选）' }
      }
    },
    execute: async (params, context) => {
      const assetAgent = require('../assetAgent');
      // 优先使用参数传入的文件信息，否则从当前消息元数据中获取
      const meta = context.sessionContext?.currentMessageMetadata || {};
      const fileUrl = params.fileUrl || meta.fileUrl;
      const fileName = params.fileName || meta.fileName;
      const fileType = params.fileType || meta.fileType;

      if (!fileUrl) return '❌ 没有可分析的文件，请先上传图片、视频或文件';

      const materials = [{
        filename: fileName || 'uploaded_file',
        url: fileUrl,
        type: fileType || 'file',
        tags: []
      }];

      try {
        const result = await assetAgent.analyze(materials);
        return `✅ 文件分析完成:\n- 商品: ${result.title}\n- 卖点: ${result.sellingPoints}\n- 受众: ${result.targetAudience}\n- 风格: ${result.style}\n- 价格: ${result.price}`;
      } catch (err) {
        return `❌ 文件分析失败: ${err.message}`;
      }
    }
  }
];

// ─── 注册表 ───────────────────────────────────────────────

const toolMap = new Map();
for (const tool of tools) {
  toolMap.set(tool.name, tool);
}

/**
 * 获取所有工具的 JSON Schema 描述（用于注入 system prompt）
 */
function getToolDescriptions() {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }));
}

/**
 * 执行指定工具
 */
async function executeTool(name, params, context) {
  const tool = toolMap.get(name);
  if (!tool) {
    return `❌ 未知工具: ${name}。可用工具: ${[...toolMap.keys()].join(', ')}`;
  }
  try {
    return await tool.execute(params, context);
  } catch (error) {
    console.error(`❌ 工具 ${name} 执行失败:`, error);
    return `❌ 工具 ${name} 执行失败: ${error.message}`;
  }
}

/**
 * 获取工具名称列表
 */
function getToolNames() {
  return [...toolMap.keys()];
}

module.exports = {
  tools,
  getToolDescriptions,
  executeTool,
  getToolNames
};
