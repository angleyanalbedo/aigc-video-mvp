const express = require('express');
const router = express.Router();
const projectModel = require('../models/project');

router.get('/', (req, res) => {
  try {
    const { status, page, pageSize, keyword } = req.query;
    const result = projectModel.getAll({
      status,
      page,
      pageSize,
      keyword
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const project = projectModel.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const project = projectModel.create(req.body);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const project = projectModel.update(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    projectModel.remove(req.params.id);
    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/duplicate', (req, res) => {
  try {
    const project = projectModel.duplicate(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/archive', (req, res) => {
  try {
    const project = projectModel.update(req.params.id, { status: 'archived' });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
