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

const materialModel = {
  getByProject(projectId) {
    const list = db.prepare('SELECT * FROM materials WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return list.map(item => ({
      ...item,
      tags: parseJSON(item.tags),
      embedding: parseJSON(item.embedding)
    }));
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
    if (!item) return null;
    return {
      ...item,
      tags: parseJSON(item.tags),
      embedding: parseJSON(item.embedding)
    };
  },

  create(data) {
    const id = data.id || generateId('mat');
    db.prepare(`
      INSERT INTO materials (id, project_id, filename, url, type, tags, embedding, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId || null,
      data.filename,
      data.url,
      data.type || null,
      stringifyJSON(data.tags || null),
      stringifyJSON(data.embedding || null),
      data.content || null,
      new Date().toISOString()
    );
    return materialModel.getById(id);
  },

  update(id, data) {
    const material = materialModel.getById(id);
    if (!material) return null;
    db.prepare(`
      UPDATE materials
      SET filename = ?, url = ?, type = ?, tags = ?, embedding = ?, content = ?
      WHERE id = ?
    `).run(
      data.filename !== undefined ? data.filename : material.filename,
      data.url !== undefined ? data.url : material.url,
      data.type !== undefined ? data.type : material.type,
      data.tags !== undefined ? stringifyJSON(data.tags) : stringifyJSON(material.tags),
      data.embedding !== undefined ? stringifyJSON(data.embedding) : stringifyJSON(material.embedding),
      data.content !== undefined ? data.content : material.content,
      id
    );
    return materialModel.getById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    return true;
  },

  search(keyword, tags, projectId) {
    let query = 'SELECT * FROM materials WHERE 1=1';
    const params = [];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    if (keyword) {
      query += ' AND (filename LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    query += ' ORDER BY created_at DESC';
    const list = db.prepare(query).all(...params);
    return list.map(item => ({
      ...item,
      tags: parseJSON(item.tags),
      embedding: parseJSON(item.embedding)
    }));
  }
};

module.exports = materialModel;
