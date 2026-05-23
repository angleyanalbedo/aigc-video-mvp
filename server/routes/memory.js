const express = require('express');
const router = express.Router();
const { memoryManager, vectorStore, embeddingService } = require('../agents/memory');

router.get('/stats/:agentName', async (req, res) => {
  const { agentName } = req.params;
  try {
    const stats = await memoryManager.getMemoryStats(agentName);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('获取记忆统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/recall', async (req, res) => {
  const { agentName, sessionId, query, topK } = req.body;

  if (!agentName || !query) {
    return res.status(400).json({ success: false, error: 'agentName and query are required' });
  }

  try {
    const memories = await memoryManager.recall({
      agentName,
      sessionId,
      query,
      topK: topK || 5
    });
    const contextString = memoryManager.buildContextString(memories);
    res.json({ success: true, memories, contextString });
  } catch (error) {
    console.error('语义召回失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/short-term', async (req, res) => {
  const { agentName, sessionId, content, metadata, importance } = req.body;

  if (!agentName || !content) {
    return res.status(400).json({ success: false, error: 'agentName and content are required' });
  }

  try {
    const id = await memoryManager.addShortTerm({
      agentName,
      sessionId,
      content,
      metadata,
      importance
    });
    res.json({ success: true, id });
  } catch (error) {
    console.error('添加短期记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/long-term', async (req, res) => {
  const { agentName, sessionId, content, metadata, importance } = req.body;

  if (!agentName || !content) {
    return res.status(400).json({ success: false, error: 'agentName and content are required' });
  }

  try {
    const id = await memoryManager.addLongTerm({
      agentName,
      sessionId,
      content,
      metadata,
      importance
    });
    res.json({ success: true, id });
  } catch (error) {
    console.error('添加长期记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/summary', async (req, res) => {
  const { agentName, sessionId, summary, keyFacts } = req.body;

  if (!agentName || !summary) {
    return res.status(400).json({ success: false, error: 'agentName and summary are required' });
  }

  try {
    const id = await memoryManager.addSummary({
      agentName,
      sessionId,
      summary,
      keyFacts
    });
    res.json({ success: true, id });
  } catch (error) {
    console.error('添加摘要失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recent/:agentName', async (req, res) => {
  const { agentName } = req.params;
  const { sessionId, memoryType, limit } = req.query;

  try {
    const memories = await vectorStore.getRecent({
      agentName,
      sessionId: sessionId || null,
      memoryType: memoryType || null,
      limit: parseInt(limit) || 10
    });
    res.json({ success: true, memories });
  } catch (error) {
    console.error('获取近期记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/session/:agentName/:sessionId', async (req, res) => {
  const { agentName, sessionId } = req.params;

  try {
    await memoryManager.clearSession(agentName, sessionId);
    res.json({ success: true, message: '会话记忆已清除' });
  } catch (error) {
    console.error('清除会话记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await vectorStore.delete(id);
    res.json({ success: true, message: '记忆已删除' });
  } catch (error) {
    console.error('删除记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/embedding/status', (req, res) => {
  res.json({
    success: true,
    onnxActive: embeddingService.isOnnxActive(),
    dimension: embeddingService.getDimension(),
    mode: embeddingService.isOnnxActive() ? 'onnx_semantic' : 'hash_trigram'
  });
});

module.exports = router;
