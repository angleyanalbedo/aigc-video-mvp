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

const experimentModel = {
  getByProject(projectId) {
    const list = db.prepare('SELECT * FROM ab_experiments WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return list.map(item => ({
      ...item,
      variants: parseJSON(item.variants),
      results: parseJSON(item.results)
    }));
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(id);
    if (!item) return null;
    return {
      ...item,
      variants: parseJSON(item.variants),
      results: parseJSON(item.results)
    };
  },

  create(data) {
    const id = generateId('exp');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ab_experiments (id, project_id, name, description, status, variants, results, sample_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId || null,
      data.name || 'Untitled Experiment',
      data.description || null,
      data.status || 'draft',
      stringifyJSON(data.variants || null),
      stringifyJSON(data.results || null),
      data.sampleSize || 0,
      now,
      now
    );
    return experimentModel.getById(id);
  },

  update(id, data) {
    const experiment = experimentModel.getById(id);
    if (!experiment) return null;
    db.prepare(`
      UPDATE ab_experiments
      SET name = ?, description = ?, status = ?, variants = ?, results = ?, sample_size = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name !== undefined ? data.name : experiment.name,
      data.description !== undefined ? data.description : experiment.description,
      data.status !== undefined ? data.status : experiment.status,
      data.variants !== undefined ? stringifyJSON(data.variants) : stringifyJSON(experiment.variants),
      data.results !== undefined ? stringifyJSON(data.results) : stringifyJSON(experiment.results),
      data.sampleSize !== undefined ? data.sampleSize : experiment.sample_size,
      new Date().toISOString(),
      id
    );
    return experimentModel.getById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM ab_experiments WHERE id = ?').run(id);
    return true;
  },

  getDashboardStats() {
    const total = db.prepare('SELECT COUNT(*) as total FROM ab_experiments').get().total;
    const running = db.prepare("SELECT COUNT(*) as count FROM ab_experiments WHERE status = 'running'").get().count;
    const completed = db.prepare("SELECT COUNT(*) as count FROM ab_experiments WHERE status = 'completed'").get().count;
    return { total, running, completed };
  }
};

module.exports = experimentModel;
