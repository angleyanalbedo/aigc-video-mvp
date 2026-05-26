/**
 * Agent Tools - 工具定义
 * 
 * 统一的工具系统，所有 Agent 都可以使用这些工具来执行操作
 */

const { z } = require('zod');
const projectModel = require('../../models/project');
const { updateSceneAsset } = require('./workbenchAPI');
const videoAPI = require('./videoAPI');
const ttsAPI = require('./ttsAPI');

/**
 * 工具：更新分镜资产
 */
const updateSceneTool = {
  name: 'updateScene',
  description: '更新分镜的内容和属性，包括描述、旁白、时长等',
  parameters: z.object({
    projectId: z.string().describe('项目ID'),
    sceneId: z.number().describe('分镜ID（从1开始）'),
    field: z.string().describe('要更新的字段名'),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).describe('字段值')
  }),
  execute: async ({ projectId, sceneId, field, value }) => {
    try {
      const sceneIndex = sceneId - 1;
      const result = await updateSceneAsset(projectId, sceneIndex, field, value);
      if (result.success) {
        return `✅ 分镜 ${sceneId} 的 ${field} 已更新为: ${value}`;
      }
      return `❌ 更新失败: ${result.error}`;
    } catch (error) {
      return `❌ 更新失败: ${error.message}`;
    }
  }
};

/**
 * 工具：获取项目信息
 */
const getProjectTool = {
  name: 'getProject',
  description: '获取项目详情，包括素材、剧本、商品信息等',
  parameters: z.object({
    projectId: z.string().describe('项目ID')
  }),
  execute: async ({ projectId }) => {
    try {
      const project = projectModel.getById(projectId);
      if (!project) {
        return `❌ 项目 ${projectId} 不存在`;
      }
      return JSON.stringify({
        name: project.name,
        description: project.description,
        productInfo: project.product_info,
        materials: project.materials || [],
        script: project.script,
        settings: project.settings
      }, null, 2);
    } catch (error) {
      return `❌ 获取项目失败: ${error.message}`;
    }
  }
};

/**
 * 工具：获取分镜列表
 */
const getScenesTool = {
  name: 'getScenes',
  description: '获取剧本的所有分镜列表及其当前状态',
  parameters: z.object({
    projectId: z.string().describe('项目ID')
  }),
  execute: async ({ projectId }) => {
    try {
      const project = projectModel.getById(projectId);
      if (!project || !project.script || !project.script.scenes) {
        return '❌ 项目没有剧本或分镜数据';
      }
      return JSON.stringify(project.script.scenes, null, 2);
    } catch (error) {
      return `❌ 获取分镜失败: ${error.message}`;
    }
  }
};

/**
 * 工具：保存剧本
 */
const saveScriptTool = {
  name: 'saveScript',
  description: '保存完整的剧本到项目',
  parameters: z.object({
    projectId: z.string().describe('项目ID'),
    script: z.object({
      title: z.string(),
      scenes: z.array(z.any())
    }).describe('剧本对象')
  }),
  execute: async ({ projectId, script }) => {
    try {
      projectModel.update(projectId, { script });
      return `✅ 剧本已保存，共 ${script.scenes?.length || 0} 个分镜`;
    } catch (error) {
      return `❌ 保存剧本失败: ${error.message}`;
    }
  }
};

/**
 * 工具：生成视频
 */
const generateVideoTool = {
  name: 'generateVideo',
  description: '调用视频生成API生成分镜视频',
  parameters: z.object({
    prompt: z.string().describe('视频生成提示词'),
    imageUrl: z.string().optional().describe('首帧图片URL'),
    duration: z.number().optional().describe('视频时长（秒）'),
    projectId: z.string().optional().describe('项目ID'),
    sceneId: z.number().optional().describe('分镜ID（从1开始）')
  }),
  execute: async ({ prompt, imageUrl, duration, projectId, sceneId }) => {
    try {
      const result = await videoAPI.createVideoTask({
        prompt,
        imageUrl,
        duration: duration || 5
      });
      
      if (projectId && sceneId !== undefined) {
        const sceneIndex = sceneId - 1;
        await updateSceneAsset(projectId, sceneIndex, 'taskId', result.id);
      }
      
      return `✅ 视频生成任务已创建，任务ID: ${result.id}`;
    } catch (error) {
      return `❌ 视频生成失败: ${error.message}`;
    }
  }
};

/**
 * 工具：生成配音
 */
const generateTTSTool = {
  name: 'generateTTS',
  description: '生成文本转语音配音',
  parameters: z.object({
    text: z.string().describe('要转换的文本'),
    voice: z.string().optional().describe('声音选项'),
    speed: z.number().optional().describe('语速'),
    volume: z.number().optional().describe('音量')
  }),
  execute: async ({ text, voice, speed, volume }) => {
    try {
      const result = await ttsAPI.generateTTS({
        text,
        voice: voice || 'zh_female_story',
        speed: speed || 1.0,
        volume: volume || 0.8
      });
      return `✅ 配音生成成功: ${result.audioFile}`;
    } catch (error) {
      return `❌ 配音生成失败: ${error.message}`;
    }
  }
};

/**
 * 工具：搜索素材
 */
const searchMaterialsTool = {
  name: 'searchMaterials',
  description: '搜索商品素材库获取相关素材',
  parameters: z.object({
    projectId: z.string().describe('项目ID'),
    keyword: z.string().optional().describe('搜索关键词')
  }),
  execute: async ({ projectId, keyword }) => {
    try {
      const project = projectModel.getById(projectId);
      if (!project || !project.materials) {
        return '❌ 项目没有素材';
      }
      
      let materials = project.materials;
      if (keyword) {
        materials = materials.filter(m => 
          m.filename?.includes(keyword) || 
          m.tags?.some(t => t.includes(keyword))
        );
      }
      
      return JSON.stringify(materials, null, 2);
    } catch (error) {
      return `❌ 搜索素材失败: ${error.message}`;
    }
  }
};

/**
 * 获取所有工具
 */
function getAllTools() {
  return {
    updateScene: updateSceneTool,
    getProject: getProjectTool,
    getScenes: getScenesTool,
    saveScript: saveScriptTool,
    generateVideo: generateVideoTool,
    generateTTS: generateTTSTool,
    searchMaterials: searchMaterialsTool
  };
}

/**
 * 获取特定 Agent 的工具集
 */
function getToolsForAgent(agentName) {
  const allTools = getAllTools();
  
  switch (agentName) {
    case 'ScriptAgent':
      return {
        updateScene: allTools.updateScene,
        getProject: allTools.getProject,
        getScenes: allTools.getScenes,
        saveScript: allTools.saveScript,
        generateVideo: allTools.generateVideo,
        generateTTS: allTools.generateTTS
      };
    
    case 'ImageAgent':
      return {
        updateScene: allTools.updateScene,
        getProject: allTools.getProject,
        getScenes: allTools.getScenes
      };
    
    case 'VideoAgent':
      return {
        updateScene: allTools.updateScene,
        generateVideo: allTools.generateVideo,
        generateTTS: allTools.generateTTS,
        getScenes: allTools.getScenes
      };
    
    case 'ClipAgent':
      return {
        getProject: allTools.getProject,
        getScenes: allTools.getScenes,
        saveScript: allTools.saveScript
      };
    
    case 'AssetAgent':
      return {
        getProject: allTools.getProject,
        searchMaterials: allTools.searchMaterials
      };
    
    case 'ReviewAgent':
      return {
        getProject: allTools.getProject,
        getScenes: allTools.getScenes,
        updateScene: allTools.updateScene
      };
    
    default:
      return allTools;
  }
}

module.exports = {
  getAllTools,
  getToolsForAgent,
  updateSceneTool,
  getProjectTool,
  getScenesTool,
  saveScriptTool,
  generateVideoTool,
  generateTTSTool,
  searchMaterialsTool
};
