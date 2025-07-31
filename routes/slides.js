const express = require('express');
const router = express.Router();
const { generateSlidesFromMarkdown } = require('../services/slideGenerator');
const { applySlideEdit, revertSlideToVersion } = require('../services/slideEditor');
const { createRunWithSlides, persistSlideEdit, getSlidesByRun } = require('../services/slidePersistence');
const { pool } = require('../services/db');
const { brandContext } = require('../config/brandContext');

// Simple in-memory slide store used when DATABASE_URL is not set
const slideStore = new Map();
const useDb = !!pool;

router.post('/generate', async (req, res) => {
  try {
    const { fullSow } = req.body;
    if (!fullSow) return res.status(400).json({ error: 'fullSow markdown is required' });

    const slides = await generateSlidesFromMarkdown(fullSow, brandContext);
    if (useDb) {
      try {
        const runId = await createRunWithSlides(fullSow, slides, req.userId || null);
        res.json({ runId, slides });
      } catch (dbErr) {
        console.error('[SlideGeneration] db persist failed', dbErr);
        res.status(500).json({ error: 'Slide persistence failed', detail: dbErr.message });
      }
    } else {
      slides.forEach(s => slideStore.set(s.id, s));
      res.json({ slides });
    }
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

    if (useDb) {
      const resSlide = await pool.query('SELECT * FROM slides WHERE id=$1', [slideId]);
      if (resSlide.rowCount === 0) return res.status(404).json({ error: 'Slide not found' });
      const slide = {
        id: resSlide.rows[0].id,
        title: resSlide.rows[0].title,
        originalMarkdown: resSlide.rows[0].original_markdown,
        currentHtml: resSlide.rows[0].current_html,
        versionHistory: [],
        chatHistory: []
      };
      const updated = await applySlideEdit(slide, instruction);
      await persistSlideEdit(slideId, updated.currentHtml, updated.versionHistory.slice(-1)[0].source, instruction, req.userId || null);
      res.json({ slide: { id: slideId, currentHtml: updated.currentHtml } });
    } else {
      const slide = slideStore.get(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      const updated = await applySlideEdit(slide, instruction);
      slideStore.set(slideId, updated);
      res.json({ slide: updated });
    }
  } catch (err) {
    console.error('[SlideEdit] failed', err);
    res.status(500).json({ error: 'Edit failed', detail: err.message });
  }
});

// List versions of a slide
router.get('/:slideId/versions', async (req, res) => {
  const { slideId } = req.params;
  if (useDb) {
    try {
      const rows = await pool.query('SELECT version_number, instruction, source, html, created_at FROM slide_versions WHERE slide_id=$1 ORDER BY version_number', [slideId]);
      if (rows.rowCount === 0) return res.status(404).json({ error: 'Slide not found' });
      res.json({ versions: rows.rows });
    } catch (err) {
      console.error('[SlideVersions] failed', err);
      res.status(500).json({ error: 'Failed to fetch versions', detail: err.message });
    }
  } else {
    const slide = slideStore.get(slideId);
    if (!slide) return res.status(404).json({ error: 'Slide not found' });
    res.json({ versions: slide.versionHistory });
  }
});

// Revert to an earlier version
router.post('/:slideId/revert', async (req, res) => {
  try {
    const { slideId } = req.params;
    const { versionIndex } = req.body;
    if (useDb) {
      const versions = await pool.query('SELECT html, version_number FROM slide_versions WHERE slide_id=$1 ORDER BY version_number', [slideId]);
      if (versions.rowCount === 0) return res.status(404).json({ error: 'Slide not found' });
      if (versionIndex < 0 || versionIndex >= versions.rowCount) return res.status(400).json({ error: 'Invalid version index' });
      const target = versions.rows[versionIndex];
      await persistSlideEdit(slideId, target.html, 'revert', `Reverted to ${target.version_number}`, req.userId || null);
      res.json({ slide: { id: slideId, currentHtml: target.html } });
    } else {
      const slide = slideStore.get(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      const reverted = revertSlideToVersion(slide, versionIndex);
      slideStore.set(slideId, reverted);
      res.json({ slide: reverted });
    }
  } catch (err) {
    console.error('[SlideRevert] failed', err);
    res.status(500).json({ error: 'Revert failed', detail: err.message });
  }
});

// Export slides as a single HTML presentation
router.get('/export/html/:runId', async (req, res) => {
  if (!useDb) return res.status(400).json({ error: 'DATABASE_URL not configured' });
  const { runId } = req.params;
  try {
    const slides = await getSlidesByRun(runId);
    if (!slides.length) return res.status(404).json({ error: 'Run not found' });
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Slide Deck</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100 p-8">
${slides.map((s,i)=>`<section class="mb-12 p-6 bg-white rounded shadow">
  <h2 class="text-xl font-bold mb-4">Slide ${i+1}: ${s.title}</h2>
  <div>${s.current_html}</div>
</section>`).join('\n')}
</body></html>`;
    res.setHeader('Content-Type','text/html');
    res.send(html);
  } catch (err) {
    console.error('[SlideExport] failed', err);
    res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

module.exports = router;
