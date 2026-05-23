const express = require('express');
const router = express.Router();
const skillLoader = require('../agents/skills/skillLoader');

router.get('/', (req, res) => {
  try {
    const skills = skillLoader.list();
    res.json({ success: true, skills, total: skills.length });
  } catch (error) {
    console.error('获取 Skill 列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:skillId', (req, res) => {
  const { skillId } = req.params;

  try {
    const skill = skillLoader.load(skillId);
    if (!skill) {
      return res.status(404).json({ success: false, error: `Skill "${skillId}" 未找到` });
    }
    res.json({ success: true, skill });
  } catch (error) {
    console.error('加载 Skill 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:skillId/prompt', (req, res) => {
  const { skillId } = req.params;

  try {
    const prompt = skillLoader.loadPrompt(skillId);
    if (!prompt) {
      return res.status(404).json({ success: false, error: `Skill "${skillId}" 提示词未找到` });
    }
    res.json({ success: true, skillId, prompt });
  } catch (error) {
    console.error('加载 Skill 提示词失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:skillId', (req, res) => {
  const { skillId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, error: 'content is required' });
  }

  try {
    const result = skillLoader.save(skillId, content);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('更新 Skill 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agent/:agentName', (req, res) => {
  const { agentName } = req.params;

  try {
    const skill = skillLoader.getSkillForAgent(agentName);
    if (!skill) {
      return res.status(404).json({ success: false, error: `Agent "${agentName}" 的 Skill 未找到` });
    }
    res.json({ success: true, skill });
  } catch (error) {
    console.error('加载 Agent Skill 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agent/:agentName/prompt', (req, res) => {
  const { agentName } = req.params;

  try {
    const prompt = skillLoader.loadPromptForAgent(agentName);
    if (!prompt) {
      return res.status(404).json({ success: false, error: `Agent "${agentName}" 的提示词未找到` });
    }
    res.json({ success: true, agentName, prompt });
  } catch (error) {
    console.error('加载 Agent 提示词失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
