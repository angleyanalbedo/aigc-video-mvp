const vectorStore = require('./vectorStore');
const embeddingService = require('./embeddingService');
const db = require('../../db');

const SHORT_TERM_LIMIT = 20;
const LONG_TERM_IMPORTANCE_THRESHOLD = 0.7;
const SUMMARY_TRIGGER_COUNT = 10;
const SEMANTIC_TOP_K = 5;
const SEMANTIC_THRESHOLD = 0.3;

class MemoryManager {
  constructor() {
    this._cleanupInterval = null;
    this.startCleanup();
  }

  startCleanup() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = setInterval(() => {
      vectorStore.cleanup().catch(err => {
        console.warn('⚠️ MemoryManager: 清理过期记忆失败:', err.message);
      });
    }, 5 * 60 * 1000);
  }

  stopCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  async addShortTerm({ agentName, sessionId, content, metadata, importance }) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const id = await vectorStore.store({
      agentName,
      sessionId,
      memoryType: 'short_term',
      content,
      metadata: {
        ...metadata,
        addedAt: Date.now()
      },
      importance: importance || 0.5,
      expiresAt
    });

    await this._checkPromotion(agentName, sessionId);
    await this._checkSummarization(agentName, sessionId);

    return id;
  }

  async addLongTerm({ agentName, sessionId, content, metadata, importance }) {
    return vectorStore.store({
      agentName,
      sessionId: null,
      memoryType: 'long_term',
      content,
      metadata: {
        ...metadata,
        promotedAt: Date.now()
      },
      importance: importance || LONG_TERM_IMPORTANCE_THRESHOLD
    });
  }

  async addSummary({ agentName, sessionId, summary, keyFacts }) {
    const embedding = await embeddingService.embed(summary);
    const embeddingBuffer = embeddingService.vectorToBuffer(embedding);

    const existing = db.prepare(
      'SELECT id FROM agent_memory_summaries WHERE agent_name = ? AND session_id = ?'
    ).get(agentName, sessionId);

    if (existing) {
      db.prepare(`
        UPDATE agent_memory_summaries
        SET summary = ?, key_facts = ?, embedding = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(summary, keyFacts ? JSON.stringify(keyFacts) : null, embeddingBuffer, existing.id);
      return existing.id;
    }

    const id = `sum_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO agent_memory_summaries (id, agent_name, session_id, summary, key_facts, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, agentName, sessionId, summary, keyFacts ? JSON.stringify(keyFacts) : null, embeddingBuffer);

    return id;
  }

  async recall({ agentName, sessionId, query, topK = SEMANTIC_TOP_K }) {
    const results = [];

    const recent = await vectorStore.getRecent({
      agentName,
      sessionId,
      memoryType: 'short_term',
      limit: 5
    });
    results.push(...recent.map(r => ({ ...r, recallType: 'short_term' })));

    const longTerm = await vectorStore.search({
      agentName,
      query,
      memoryType: 'long_term',
      topK,
      threshold: SEMANTIC_THRESHOLD
    });
    results.push(...longTerm.map(r => ({ ...r, recallType: 'semantic_long_term' })));

    if (query) {
      const semantic = await vectorStore.search({
        agentName,
        query,
        topK,
        threshold: SEMANTIC_THRESHOLD
      });
      for (const r of semantic) {
        if (!results.find(existing => existing.id === r.id)) {
          results.push({ ...r, recallType: 'semantic' });
        }
      }
    }

    const summaries = this._getSummaries(agentName, sessionId);
    for (const s of summaries) {
      results.push({
        id: s.id,
        agentName,
        sessionId: s.session_id,
        memoryType: 'summary',
        content: s.summary,
        metadata: s.key_facts ? JSON.parse(s.key_facts) : null,
        importance: 0.9,
        similarity: 1.0,
        recallType: 'summary',
        createdAt: s.created_at
      });
    }

    const deduped = this._deduplicate(results);
    deduped.sort((a, b) => {
      const priority = { summary: 4, semantic_long_term: 3, semantic: 2, short_term: 1 };
      const pa = priority[a.recallType] || 0;
      const pb = priority[b.recallType] || 0;
      if (pa !== pb) return pb - pa;
      return (b.similarity || 0) - (a.similarity || 0);
    });

    return deduped.slice(0, topK * 2);
  }

  buildContextString(memories) {
    if (!memories || memories.length === 0) return '';

    const parts = [];

    const summaries = memories.filter(m => m.memoryType === 'summary');
    if (summaries.length > 0) {
      parts.push('## 历史会话摘要');
      for (const s of summaries) {
        parts.push(`- ${s.content}`);
        if (s.metadata && Array.isArray(s.metadata)) {
          for (const fact of s.metadata) {
            parts.push(`  · ${fact}`);
          }
        }
      }
    }

    const longTerm = memories.filter(m => m.memoryType === 'long_term' || m.recallType === 'semantic_long_term');
    if (longTerm.length > 0) {
      parts.push('## 长期记忆（重要事实）');
      for (const m of longTerm) {
        parts.push(`- ${m.content}`);
      }
    }

    const shortTerm = memories.filter(m => m.memoryType === 'short_term' && m.recallType !== 'semantic');
    if (shortTerm.length > 0) {
      parts.push('## 近期对话');
      for (const m of shortTerm) {
        const role = m.metadata?.role || 'user';
        parts.push(`[${role}] ${m.content}`);
      }
    }

    const semantic = memories.filter(m => m.recallType === 'semantic' && m.memoryType !== 'long_term');
    if (semantic.length > 0) {
      parts.push('## 语义相关记忆');
      for (const m of semantic) {
        parts.push(`- ${m.content} (相关度: ${(m.similarity * 100).toFixed(0)}%)`);
      }
    }

    return parts.join('\n');
  }

  async _checkPromotion(agentName, sessionId) {
    const recent = await vectorStore.getRecent({
      agentName,
      sessionId,
      memoryType: 'short_term',
      limit: SHORT_TERM_LIMIT
    });

    for (const mem of recent) {
      if (mem.importance >= LONG_TERM_IMPORTANCE_THRESHOLD && mem.memoryType === 'short_term') {
        await this.addLongTerm({
          agentName,
          sessionId,
          content: mem.content,
          metadata: mem.metadata,
          importance: mem.importance
        });
      }
    }
  }

  async _checkSummarization(agentName, sessionId) {
    const recent = await vectorStore.getRecent({
      agentName,
      sessionId,
      memoryType: 'short_term',
      limit: SUMMARY_TRIGGER_COUNT + 1
    });

    if (recent.length < SUMMARY_TRIGGER_COUNT) return;

    const existingSummary = this._getSummaries(agentName, sessionId);
    if (existingSummary.length > 0) return;

    const contents = recent.map(m => {
      const role = m.metadata?.role || 'user';
      return `[${role}] ${m.content}`;
    });

    const summary = this._generateLocalSummary(contents);
    const keyFacts = this._extractKeyFacts(recent);

    await this.addSummary({
      agentName,
      sessionId,
      summary,
      keyFacts
    });

    console.log(`📋 MemoryManager: 已为 ${agentName}/${sessionId} 生成会话摘要`);
  }

  _generateLocalSummary(contents) {
    const lines = contents.slice(0, 10);
    return `会话摘要: 共 ${contents.length} 条交互。${lines.join('；').slice(0, 200)}`;
  }

  _extractKeyFacts(memories) {
    const facts = [];
    for (const m of memories) {
      if (m.importance >= 0.7) {
        facts.push(m.content.slice(0, 100));
      }
      if (m.metadata?.keyFact) {
        facts.push(m.metadata.keyFact);
      }
    }
    return [...new Set(facts)].slice(0, 5);
  }

  _getSummaries(agentName, sessionId) {
    if (sessionId) {
      return db.prepare(
        'SELECT * FROM agent_memory_summaries WHERE agent_name = ? AND session_id = ?'
      ).all(agentName, sessionId);
    }
    return db.prepare(
      'SELECT * FROM agent_memory_summaries WHERE agent_name = ?'
    ).all(agentName);
  }

  _deduplicate(results) {
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  async getMemoryStats(agentName) {
    const storeStats = await vectorStore.getStats(agentName);
    const summaryCount = db.prepare(
      'SELECT COUNT(*) as count FROM agent_memory_summaries WHERE agent_name = ?'
    ).get(agentName);

    return {
      ...storeStats,
      summaries: summaryCount.count,
      onnxActive: embeddingService.isOnnxActive(),
      embeddingDim: embeddingService.getDimension()
    };
  }

  async clearSession(agentName, sessionId) {
    await vectorStore.deleteBySession(agentName, sessionId);
    db.prepare(
      'DELETE FROM agent_memory_summaries WHERE agent_name = ? AND session_id = ?'
    ).run(agentName, sessionId);
  }
}

module.exports = new MemoryManager();
