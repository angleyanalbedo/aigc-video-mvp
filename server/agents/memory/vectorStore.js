const db = require('../../db');
const embeddingService = require('./embeddingService');

class VectorStore {
  constructor() {
    this.dim = embeddingService.getDimension();
  }

  async store({ id, agentName, sessionId, memoryType, content, metadata, importance, expiresAt }) {
    const embedding = await embeddingService.embed(content);
    const embeddingBuffer = embeddingService.vectorToBuffer(embedding);

    const memId = id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO agent_memory
      (id, agent_name, session_id, memory_type, content, embedding, metadata, importance, created_at, accessed_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `);

    stmt.run(
      memId,
      agentName,
      sessionId || null,
      memoryType,
      content,
      embeddingBuffer,
      metadata ? JSON.stringify(metadata) : null,
      importance || 0.5,
      expiresAt || null
    );

    return memId;
  }

  async search({ agentName, query, memoryType, sessionId, topK = 5, threshold = 0.3 }) {
    const queryEmbedding = await embeddingService.embed(query);

    let sql = 'SELECT * FROM agent_memory WHERE agent_name = ?';
    const params = [agentName];

    if (memoryType) {
      sql += ' AND memory_type = ?';
      params.push(memoryType);
    }

    if (sessionId) {
      sql += ' AND (session_id = ? OR session_id IS NULL)';
      params.push(sessionId);
    }

    sql += " AND (expires_at IS NULL OR expires_at > datetime('now'))";

    const rows = db.prepare(sql).all(...params);

    const scored = rows.map(row => {
      const rowEmbedding = embeddingService.bufferToVector(row.embedding);
      const similarity = embeddingService.constructor.cosineSimilarity(queryEmbedding, rowEmbedding);
      return {
        id: row.id,
        agentName: row.agent_name,
        sessionId: row.session_id,
        memoryType: row.memory_type,
        content: row.content,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        importance: row.importance,
        similarity,
        createdAt: row.created_at,
        accessedAt: row.accessed_at
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    const results = scored.filter(r => r.similarity >= threshold).slice(0, topK);

    this._touchAccessed(results.map(r => r.id));

    return results;
  }

  async getRecent({ agentName, sessionId, memoryType, limit = 10 }) {
    let sql = 'SELECT * FROM agent_memory WHERE agent_name = ?';
    const params = [agentName];

    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }

    if (memoryType) {
      sql += ' AND memory_type = ?';
      params.push(memoryType);
    }

    sql += " AND (expires_at IS NULL OR expires_at > datetime('now'))";
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params);

    return rows.map(row => ({
      id: row.id,
      agentName: row.agent_name,
      sessionId: row.session_id,
      memoryType: row.memory_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      importance: row.importance,
      createdAt: row.created_at,
      accessedAt: row.accessed_at
    }));
  }

  async delete(id) {
    db.prepare('DELETE FROM agent_memory WHERE id = ?').run(id);
  }

  async deleteBySession(agentName, sessionId) {
    db.prepare('DELETE FROM agent_memory WHERE agent_name = ? AND session_id = ?').run(agentName, sessionId);
  }

  async cleanup() {
    db.prepare("DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')").run();
  }

  async getStats(agentName) {
    const total = db.prepare('SELECT COUNT(*) as count FROM agent_memory WHERE agent_name = ?').get(agentName);
    const byType = db.prepare('SELECT memory_type, COUNT(*) as count FROM agent_memory WHERE agent_name = ? GROUP BY memory_type').all(agentName);
    return {
      total: total.count,
      byType: byType.reduce((acc, row) => {
        acc[row.memory_type] = row.count;
        return acc;
      }, {})
    };
  }

  _touchAccessed(ids) {
    if (ids.length === 0) return;
    const stmt = db.prepare("UPDATE agent_memory SET accessed_at = datetime('now') WHERE id = ?");
    const transaction = db.transaction((ids) => {
      for (const id of ids) stmt.run(id);
    });
    transaction(ids);
  }
}

module.exports = new VectorStore();
