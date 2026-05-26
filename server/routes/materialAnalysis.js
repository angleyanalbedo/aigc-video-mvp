const express = require('express');
const router = express.Router();
const materialAnalysisService = require('../services/materialAnalysisService');

router.post('/:id/analyze', async (req, res) => {
  try {
    const result = await materialAnalysisService.analyzeMaterial(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/slices', (req, res) => {
  const slices = materialAnalysisService.getSlicesByMaterial(req.params.id);
  res.json({ success: true, data: slices });
});

router.post('/:id/auto-slice', async (req, res) => {
  const { sliceCount } = req.body;
  try {
    const slices = await materialAnalysisService.autoSliceMaterial(req.params.id, sliceCount || 4);
    res.json({ success: true, data: slices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/slices/search', (req, res) => {
  const { keyword, tags, productTags, videoTags, sliceTags, limit } = req.body;
  const results = materialAnalysisService.searchSlices({
    keyword, tags, productTags, videoTags, sliceTags,
    limit: limit || 20
  });
  res.json({ success: true, data: results });
});

router.post('/slices', (req, res) => {
  try {
    const slice = materialAnalysisService.createSlice(req.body);
    res.json({ success: true, data: slice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/slices/:id', (req, res) => {
  materialAnalysisService.deleteSlice(req.params.id);
  res.json({ success: true });
});

module.exports = router;
