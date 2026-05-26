const db = require('../db');
const canvasSyncService = require('../services/canvasSyncService');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJSON(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stringifyJSON(value) {
  if (!value) return null;
  return JSON.stringify(value);
}

const projectModel = {
  getAll(filters = {}) {
    const { status, page = 1, pageSize = 20, keyword } = filters;
    let query = 'SELECT * FROM projects WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY updated_at DESC';
    const offset = (page - 1) * pageSize;
    query += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const list = db.prepare(query).all(...params);

    const countQuery = query.split(' ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).all(...params.slice(0, -2))[0];

    return {
      list: list.map(item => {
        const materials = db.prepare('SELECT * FROM materials WHERE project_id = ?').all(item.id);
        const script = parseJSON(item.script);

        // 自动校准/智能修复项目状态
        let currentStatus = item.status;
        const calculatedStatus = projectModel.calculateProjectStatus(
          { ...item, script },
          script
        );
        if (calculatedStatus !== currentStatus) {
          db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
            .run(calculatedStatus, new Date().toISOString(), item.id);
          currentStatus = calculatedStatus;
        }

        return {
          ...item,
          status: currentStatus,
          // 同时提供两种格式的日期字段，兼容不同的前端代码
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          videoUrl: item.video_url, // 同时支持两种命名
          product_info: parseJSON(item.product_info),
          script,
          settings: parseJSON(item.settings),
          materials: materials.map(m => ({ ...m, tags: parseJSON(m.tags), createdAt: m.created_at }))
        };
      }),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!item) return null;
    const materials = db.prepare('SELECT * FROM materials WHERE project_id = ?').all(id);
    const script = parseJSON(item.script);

    // 自动校准/智能修复项目状态
    let currentStatus = item.status;
    const calculatedStatus = projectModel.calculateProjectStatus(
      { ...item, script },
      script
    );
    if (calculatedStatus !== currentStatus) {
      db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
        .run(calculatedStatus, new Date().toISOString(), id);
      currentStatus = calculatedStatus;
    }

    return {
      ...item,
      status: currentStatus,
      // 同时提供两种格式的日期字段，兼容不同的前端代码
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      videoUrl: item.video_url, // 同时支持两种命名
      product_info: parseJSON(item.product_info),
      script,
      settings: parseJSON(item.settings),
      materials: materials.map(m => ({ ...m, tags: parseJSON(m.tags), createdAt: m.created_at }))
    };
  },

  create(data) {
    const id = data.id || generateId('proj');
    const now = new Date().toISOString();
    
    const defaultScript = data.script || {
      title: '未命名剧本',
      description: '点击编辑剧本标题和描述',
      scenes: []
    };

    db.prepare(`
      INSERT INTO projects (id, name, description, status, product_info, script, settings, video_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || 'Untitled Project',
      data.description || null,
      data.status || 'draft',
      stringifyJSON(data.productInfo || null),
      stringifyJSON(defaultScript),
      stringifyJSON(data.settings || null),
      data.videoUrl || null,
      now,
      now
    );

    if (data.materialIds && Array.isArray(data.materialIds)) {
      const updateStmt = db.prepare('UPDATE materials SET project_id = ? WHERE id = ?');
      for (const matId of data.materialIds) {
        updateStmt.run(id, matId);
      }
    }

    canvasSyncService.syncScriptToCanvas(id, defaultScript).catch(err => {
      console.error('⚠️ 初始化画布失败:', err.message);
    });

    return projectModel.getById(id);
  },

  // 辅助函数：根据项目内容智能计算状态
  calculateProjectStatus(project, newScript) {
    const script = newScript !== undefined ? newScript : project.script;
    
    if (project.videoUrl) {
      return 'completed';
    }
    
    // 优先从 scenes 数据库表中读取最新渲染状态以确保高准确性（防止 JSON 与分镜表不同步）
    let scenes = [];
    try {
      const dbScenes = db.prepare('SELECT video_url, status, rendering FROM scenes WHERE project_id = ?').all(project.id);
      if (dbScenes && dbScenes.length > 0) {
        scenes = dbScenes.map(s => ({
          videoUrl: s.video_url,
          status: s.status,
          rendering: s.rendering === 1
        }));
      }
    } catch (e) {
      console.error('⚠️ 从 scenes 表获取状态失败，降级使用 script.scenes:', e.message);
    }

    // 如果数据库中没有 scenes，则退回到 script.scenes JSON 数据
    if (scenes.length === 0 && script && script.scenes && script.scenes.length > 0) {
      scenes = script.scenes;
    }
    
    if (scenes.length > 0) {
      console.log(`\n🔍 [DEBUG_STATUS] 计算项目 ${project.id || project.name || 'Unknown'} 状态:`);
      console.log(`   - project.videoUrl (最终合成视频):`, project.videoUrl);
      console.log(`   - 关联分镜数量:`, scenes.length);
      scenes.forEach((s, idx) => {
        console.log(`     * 分镜 ${idx + 1}: videoUrl="${s.videoUrl || s.video_url || '无'}", status="${s.status || '无'}", rendering=${s.rendering}`);
      });

      // 兼容 videoUrl 和 video_url 两种属性命名
      const allHaveVideo = scenes.every(scene => scene.videoUrl || scene.video_url);
      const allHaveImage = scenes.every(scene => scene.imageUrl || scene.image_url);
      const hasAnyVideo = scenes.some(scene => scene.videoUrl || scene.video_url);
      const hasAnyImage = scenes.some(scene => scene.imageUrl || scene.image_url);
      const hasGenerating = scenes.some(scene => scene.status === 'generating' || scene.rendering || scene.status === 'processing');
      
      console.log(`   - allHaveVideo (所有分镜均有视频):`, allHaveVideo);
      console.log(`   - hasGenerating (有正在生成的任务):`, hasGenerating);

      // 如果每个分镜都有 video url，就是生成完毕 (completed)
      if (allHaveVideo) {
        console.log(`   👉 最终决定状态: completed\n`);
        return 'completed';
      }
      
      if (hasGenerating) {
        console.log(`   👉 最终决定状态: processing (因为有生成中任务)\n`);
        return 'processing';
      }
      
      if (hasAnyVideo || hasAnyImage) {
        console.log(`   👉 最终决定状态: processing (因为已开始部分画面/视频生成)\n`);
        return 'processing';
      }
      console.log(`   👉 最终决定状态: draft\n`);
      return 'draft';
    }
    
    console.log(`   👉 最终决定状态:`, project.status || 'draft', `(无分镜，返回默认值)\n`);
    return project.status || 'draft';
  },

  update(id, data) {
    const now = new Date().toISOString();
    const project = projectModel.getById(id);
    if (!project) return null;
    
    // 智能计算项目状态
    let newStatus = data.status;
    if (newStatus === undefined) {
      newStatus = projectModel.calculateProjectStatus(
        {...project, videoUrl: data.videoUrl}, 
        data.script
      );
    }

    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, status = ?, product_info = ?, script = ?, settings = ?, video_url = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name !== undefined ? data.name : project.name,
      data.description !== undefined ? data.description : project.description,
      newStatus,
      data.productInfo !== undefined ? stringifyJSON(data.productInfo) : stringifyJSON(project.product_info),
      data.script !== undefined ? stringifyJSON(data.script) : stringifyJSON(project.script),
      data.settings !== undefined ? stringifyJSON(data.settings) : stringifyJSON(project.settings),
      data.videoUrl !== undefined ? data.videoUrl : project.video_url,
      now,
      id
    );

    if (data.materialIds !== undefined && Array.isArray(data.materialIds)) {
      db.prepare('UPDATE materials SET project_id = NULL WHERE project_id = ?').run(id);
      const updateStmt = db.prepare('UPDATE materials SET project_id = ? WHERE id = ?');
      for (const matId of data.materialIds) {
        updateStmt.run(id, matId);
      }
    }

    // 如果更新了剧本，自动同步到画布
    if (data.script !== undefined) {
      canvasSyncService.syncScriptToCanvas(id, data.script).catch(err => {
        console.error('⚠️ 同步剧本到画布失败:', err.message);
      });
    }

    return projectModel.getById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return true;
  },

  duplicate(id) {
    const project = projectModel.getById(id);
    if (!project) return null;
    return projectModel.create({
      name: `${project.name} (Copy)`,
      description: project.description,
      productInfo: project.product_info,
      script: project.script,
      settings: project.settings
    });
  }
};

module.exports = projectModel;
