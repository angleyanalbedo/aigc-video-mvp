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

const taskModel = {
  getByProject(projectId) {
    const list = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return list.map(item => ({
      ...item,
      result: parseJSON(item.result),
      trace: parseJSON(item.trace)
    }));
  },

  getById(id) {
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!item) return null;
    return {
      ...item,
      result: parseJSON(item.result),
      trace: parseJSON(item.trace)
    };
  },

  create(data) {
    const id = generateId('task');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, project_id, type, status, progress, result, error, trace, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId || null,
      data.type || 'unknown',
      data.status || 'pending',
      data.progress || 0,
      stringifyJSON(data.result || null),
      data.error || null,
      stringifyJSON(data.trace || null),
      now,
      now
    );
    return taskModel.getById(id);
  },

  update(id, data) {
    const task = taskModel.getById(id);
    if (!task) return null;
    db.prepare(`
      UPDATE tasks
      SET type = ?, status = ?, progress = ?, result = ?, error = ?, trace = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.type !== undefined ? data.type : task.type,
      data.status !== undefined ? data.status : task.status,
      data.progress !== undefined ? data.progress : task.progress,
      data.result !== undefined ? stringifyJSON(data.result) : stringifyJSON(task.result),
      data.error !== undefined ? data.error : task.error,
      data.trace !== undefined ? stringifyJSON(data.trace) : stringifyJSON(task.trace),
      new Date().toISOString(),
      id
    );
    return taskModel.getById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return true;
  }
};

module.exports = taskModel;
