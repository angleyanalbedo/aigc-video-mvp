const express = require('express');
const router = express.Router();
const scriptInterventionService = require('../services/scriptInterventionService');
const SceneModel = require('../models/scene');

router.get('/scenes/:projectId', (req, res) => {
  try {
    const scenes = SceneModel.getByProjectId(req.params.projectId);
    res.json({ success: true, data: scenes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scenes/detail/:sceneId', (req, res) => {
  try {
    const scene = SceneModel.getById(req.params.sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, error: '分镜不存在' });
    }
    res.json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:projectId/refine', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: '请提供修改要求' });

  try {
    const result = await scriptInterventionService.refineWithPrompt(req.params.projectId, prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:projectId/replace-factor', async (req, res) => {
  const { factorType, newValue } = req.body;
  if (!factorType || !newValue) {
    return res.status(400).json({ success: false, error: '请提供因子类型和新值' });
  }

  try {
    const result = await scriptInterventionService.replaceFactor(req.params.projectId, factorType, newValue);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scenes/:sceneId/modify', async (req, res) => {
  const { modifications } = req.body;
  if (!modifications) {
    return res.status(400).json({ success: false, error: '请提供修改内容' });
  }

  try {
    const result = await scriptInterventionService.modifyScene(req.params.sceneId, modifications);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scenes/:projectId/add', async (req, res) => {
  const sceneData = req.body;
  
  try {
    const result = await scriptInterventionService.addScene(req.params.projectId, sceneData);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/scenes/:sceneId', async (req, res) => {
  try {
    const result = await scriptInterventionService.deleteScene(req.params.sceneId);
    if (!result) {
      return res.status(404).json({ success: false, error: '分镜不存在' });
    }
    res.json({ success: true, message: '分镜删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
