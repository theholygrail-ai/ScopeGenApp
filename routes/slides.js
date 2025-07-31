const express = require('express');
const router = express.Router();
const { generateSlidesFromMarkdown } = require('../services/slideGenerator');
const { brandContext } = require('../config/brandContext');

router.post('/generate', async (req, res) => {
  try {
    const { fullSow } = req.body;
    if (!fullSow) return res.status(400).json({ error: 'fullSow markdown is required' });

    const slides = await generateSlidesFromMarkdown(fullSow, brandContext);
    res.json({ slides });
  } catch (err) {
    console.error('[SlideGeneration] failed', err);
    res.status(500).json({ error: 'Slide generation failed', detail: err.message });
  }
});

module.exports = router;
