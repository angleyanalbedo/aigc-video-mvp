/**
 * Workbench API — 工作台操作工具
 *
 * 职责：允许执行层 Agent（ImageAgent 与 VideoAgent）在成功生成关键帧图片或视频后，
 * 调用该工具，直接读写 SQLite 并自动回写工作台数据，不需要前端等待或独立刷新，
 * 使得 Agent 表现为具备对工作台自主操作修改能力的实体。
 */

const projectModel = require('../../models/project');

async function updateSceneAsset(projectId, sceneIndex, field, value) {
  console.log(`\n💼 [Agent 工具调用] ———— 工作台操作工具 (Workbench Tool) 启动 ————`);
  console.log(`项目 ID: ${projectId} | 分镜索引: ${sceneIndex} | 写入字段: ${field}`);

  if (!projectId) {
    console.warn(`⚠️  [Agent 工具调用] 未提供有效 projectId，操作跳过`);
    return { success: false, error: '缺少项目ID' };
  }

  try {
    const project = projectModel.getById(projectId);
    if (!project || !project.script) {
      throw new Error('未检索到对应项目或分镜剧本数据');
    }

    const script = project.script;
    if (!script.scenes || !script.scenes[sceneIndex]) {
      throw new Error(`分镜索引越界 (当前最大分镜数: ${script.scenes?.length || 0})`);
    }

    // 更新指定的字段，并同步调整状态机
    script.scenes[sceneIndex][field] = value;
    
    if (field === 'videoUrl') {
      script.scenes[sceneIndex].status = 'completed';
      script.scenes[sceneIndex].generatedAt = Date.now();
      console.log(`✅ [Agent 工具调用] 分镜视频已就绪，状态已设定为 completed`);
    } else if (field === 'imageUrl') {
      script.scenes[sceneIndex].status = 'image_completed';
      console.log(`✅ [Agent 工具调用] 分镜首帧已就绪，状态已设定为 image_completed`);
    } else if (field === 'audioUrl') {
      script.scenes[sceneIndex].audioUrl = value;
      console.log(`✅ [Agent 工具调用] 分镜配音已绑定`);
    }

    // 将更改写存至 SQLite 数据库中
    projectModel.update(projectId, { script });
    console.log(`✅ [Agent 工具调用] SQLite 数据库分镜持久化更新成功！已回写: ${field} = "${value.slice(0, 50)}..."\n`);
    
    return { success: true };
  } catch (err) {
    console.error(`❌ [Agent 工具调用] 修改 SQLite 工作台失败:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { updateSceneAsset };
