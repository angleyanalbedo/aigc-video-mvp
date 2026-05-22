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
      list: list.map(item => ({
        ...item,
        product_info: parseJSON(item.product_info),
        script: parseJSON(item.script),
        settings: parseJSON(item.settings)
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!item) return null;
    return {
      ...item,
      product_info: parseJSON(item.product_info),
      script: parseJSON(item.script),
      settings: parseJSON(item.settings)
    };
  },

  create(data) {
    const id = generateId('proj');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO projects (id, name, description, status, product_info, script, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || 'Untitled Project',
      data.description || null,
      data.status || 'draft',
      stringifyJSON(data.productInfo || null),
      stringifyJSON(data.script || null),
      stringifyJSON(data.settings || null),
      now,
      now
    );
    return projectModel.getById(id);
  },

  update(id, data) {
    const now = new Date().toISOString();
    const project = projectModel.getById(id);
    if (!project) return null;
    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, status = ?, product_info = ?, script = ?, settings = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name !== undefined ? data.name : project.name,
      data.description !== undefined ? data.description : project.description,
      data.status !== undefined ? data.status : project.status,
      data.productInfo !== undefined ? stringifyJSON(data.productInfo) : stringifyJSON(project.product_info),
      data.script !== undefined ? stringifyJSON(data.script) : stringifyJSON(project.script),
      data.settings !== undefined ? stringifyJSON(data.settings) : stringifyJSON(project.settings),
      now,
      id
    );
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
