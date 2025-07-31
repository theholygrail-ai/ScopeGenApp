const express = require('express');
const router = express.Router();
const { generateSlidesFromMarkdown } = require('../services/slideGenerator');
const { applySlideEdit, revertSlideToVersion } = require('../services/slideEditor');
const { brandContext } = require('../config/brandContext');

// Simple in-memory slide store for demo purposes
const slideStore = new Map();

router.post('/generate', async (req, res) => {
  try {
    const { fullSow } = req.body;
    if (!fullSow) return res.status(400).json({ error: 'fullSow markdown is required' });

    const slides = await generateSlidesFromMarkdown(fullSow, brandContext);
    slides.forEach(s => slideStore.set(s.id, s));
    res.json({ slides });
  } catch (err) {
    console.error('[SlideGeneration] failed', err);
    res.status(500).json({ error: 'Slide generation failed', detail: err.message });
  }
});

// Apply an edit to a slide
router.post('/:slideId/edit', async (req, res) => {
  try {
    const { slideId } = req.params;
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'instruction required' });

    const slide = slideStore.get(slideId);
    if (!slide) return res.status(404).json({ error: 'Slide not found' });

    const updated = await applySlideEdit(slide, instruction);
    slideStore.set(slideId, updated);
    res.json({ slide: updated });
  } catch (err) {
    console.error('[SlideEdit] failed', err);
    res.status(500).json({ error: 'Edit failed', detail: err.message });
  }
});

// List versions of a slide
router.get('/:slideId/versions', (req, res) => {
  const slide = slideStore.get(req.params.slideId);
  if (!slide) return res.status(404).json({ error: 'Slide not found' });
  res.json({ versions: slide.versionHistory });
});

// Revert to an earlier version
router.post('/:slideId/revert', (req, res) => {
  try {
    const { slideId } = req.params;
    const { versionIndex } = req.body;
    const slide = slideStore.get(slideId);
    if (!slide) return res.status(404).json({ error: 'Slide not found' });

    const reverted = revertSlideToVersion(slide, versionIndex);
    slideStore.set(slideId, reverted);
    res.json({ slide: reverted });
  } catch (err) {
    console.error('[SlideRevert] failed', err);
    res.status(500).json({ error: 'Revert failed', detail: err.message });
  }
});

module.exports = router;
