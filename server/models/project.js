const db = require('../db');

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
        return {
          ...item,
          // 同时提供两种格式的日期字段，兼容不同的前端代码
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          videoUrl: item.video_url, // 同时支持两种命名
          product_info: parseJSON(item.product_info),
          script: parseJSON(item.script),
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
    return {
      ...item,
      // 同时提供两种格式的日期字段，兼容不同的前端代码
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      videoUrl: item.video_url, // 同时支持两种命名
      product_info: parseJSON(item.product_info),
      script: parseJSON(item.script),
      settings: parseJSON(item.settings),
      materials: materials.map(m => ({ ...m, tags: parseJSON(m.tags), createdAt: m.created_at }))
    };
  },

  create(data) {
    const id = generateId('proj');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO projects (id, name, description, status, product_info, script, settings, video_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || 'Untitled Project',
      data.description || null,
      data.status || 'draft',
      stringifyJSON(data.productInfo || null),
      stringifyJSON(data.script || null),
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

    return projectModel.getById(id);
  },

  // 辅助函数：根据项目内容智能计算状态
  calculateProjectStatus(project, newScript) {
    const script = newScript !== undefined ? newScript : project.script;
    
    // 如果有视频URL，说明项目已完成
    if (project.videoUrl) {
      return 'completed';
    }
    
    // 如果有剧本但没有视频，说明正在处理中
    if (script && script.scenes && script.scenes.length > 0) {
      const hasVideos = script.scenes.some(scene => scene.videoUrl);
      const hasImages = script.scenes.some(scene => scene.imageUrl);
      
      if (hasVideos) {
        return 'processing';
      } else if (hasImages) {
        return 'processing';
      }
      return 'draft';
    }
    
    // 其他情况保持原样或默认草稿
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
