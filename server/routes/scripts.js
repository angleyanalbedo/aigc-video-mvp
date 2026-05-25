const express = require('express');
const router = express.Router();
const scriptInterventionService = require('../services/scriptInterventionService');
const db = require('../db');

function parseJSON(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

router.get('/', (req, res) => {
  const { projectId, mode, limit = 50 } = req.query;
  let query = 'SELECT * FROM scripts WHERE 1=1';
  const params = [];

  if (projectId) {
    query += ' AND project_id = ?';
    params.push(projectId);
  }
  if (mode) {
    query += ' AND generation_mode = ?';
    params.push(mode);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const rows = db.prepare(query).all(...params);
  const scripts = rows.map(r => ({
    ...r,
    content: parseJSON(r.content),
    productInfo: parseJSON(r.product_info),
    factorsUsed: parseJSON(r.factors_used)
  }));

  res.json({ success: true, data: scripts });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '剧本不存在' });

  res.json({
    success: true,
    data: {
      ...row,
      content: parseJSON(row.content),
      productInfo: parseJSON(row.product_info),
      factorsUsed: parseJSON(row.factors_used)
    }
  });
});

router.post('/:id/refine', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: '请提供修改要求' });

  try {
    const result = await scriptInterventionService.refineWithPrompt(req.params.id, prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/replace-factor', async (req, res) => {
  const { factorType, newValue } = req.body;
  if (!factorType || !newValue) {
    return res.status(400).json({ success: false, error: '请提供因子类型和新值' });
  }

  try {
    const result = await scriptInterventionService.replaceFactor(req.params.id, factorType, newValue);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/modify-scene', async (req, res) => {
  const { sceneIndex, modifications } = req.body;
  if (sceneIndex === undefined || !modifications) {
    return res.status(400).json({ success: false, error: '请提供分镜索引和修改内容' });
  }

  try {
    const result = await scriptInterventionService.modifyScene(req.params.id, sceneIndex, modifications);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', (req, res) => {
  const history = scriptInterventionService.getScriptHistory(req.params.id);
  res.json({ success: true, data: history });
});

module.exports = router;
