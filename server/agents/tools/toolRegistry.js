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
