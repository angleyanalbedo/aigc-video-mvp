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

const reviewModel = {
  getByProject(projectId) {
    const list = db.prepare('SELECT * FROM reviews WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return list.map(item => ({
      ...item,
      check_results: parseJSON(item.check_results),
      history: parseJSON(item.history)
    }));
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!item) return null;
    return {
      ...item,
      check_results: parseJSON(item.check_results),
      history: parseJSON(item.history)
    };
  },

  create(data) {
    const id = generateId('rev');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO reviews (id, project_id, title, description, type, status, check_results, history, creator, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId || null,
      data.title || 'Untitled Review',
      data.description || null,
      data.type || 'content',
      data.status || 'pending',
      stringifyJSON(data.checkResults || null),
      stringifyJSON(data.history || null),
      data.creator || 'system',
      now,
      now
    );
    return reviewModel.getById(id);
  },

  update(id, data) {
    const review = reviewModel.getById(id);
    if (!review) return null;
    db.prepare(`
      UPDATE reviews
      SET title = ?, description = ?, type = ?, status = ?, check_results = ?, history = ?, creator = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title !== undefined ? data.title : review.title,
      data.description !== undefined ? data.description : review.description,
      data.type !== undefined ? data.type : review.type,
      data.status !== undefined ? data.status : review.status,
      data.checkResults !== undefined ? stringifyJSON(data.checkResults) : stringifyJSON(review.check_results),
      data.history !== undefined ? stringifyJSON(data.history) : stringifyJSON(review.history),
      data.creator !== undefined ? data.creator : review.creator,
      new Date().toISOString(),
      id
    );
    return reviewModel.getById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    return true;
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as total FROM reviews').get().total;
    const pending = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'").get().count;
    const approved = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'approved'").get().count;
    const rejected = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'rejected'").get().count;
    return { total, pending, approved, rejected };
  }
};

module.exports = reviewModel;
