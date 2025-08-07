const express = require('express');
const router = express.Router();
const { chunkSowMarkdown } = require('../services/slideGenerator');
const { generateSlidesAgentically } = require('../services/slideGenerationAgent');
const { applySlideEdit, revertSlideToVersion } = require('../services/slideEditor');
const {
  createRunWithSlides,
  persistSlideEdit,
  getSlidesByRun,
  getSlideWithHistory,
  lockSlide,
  unlockSlide,
} = require('../services/slidePersistence');
const { withSlideLock } = require('../services/slideMutationQueue');
const { pool } = require('../services/db');
const { brandContext } = require('../config/brandContext');

// Simple in-memory slide store used when DATABASE_URL is not set
const slideStore = new Map();
const useDb = !!pool;

router.post('/generate', async (req, res) => {
  try {
    const { fullSow } = req.body;
    if (!fullSow) return res.status(400).json({ error: 'fullSow markdown is required' });

    const slideSpecs = chunkSowMarkdown(fullSow);
    const slides = [];
    for await (const slide of generateSlidesAgentically(slideSpecs, brandContext)) {
      slides.push(slide);
    }
    slides.forEach(s => { if (!s.versionNumber) s.versionNumber = 1; });
    if (useDb) {
      try {
        const runId = await createRunWithSlides(fullSow, slides, null);
        return res.json({ runId, slides });
      } catch (dbErr) {
        console.error('[SlideGeneration] db persist failed', dbErr);
        return res.status(500).json({ error: 'Slide persistence failed', detail: dbErr.message });
      }
    } else {
      slides.forEach(s => slideStore.set(s.id, s));
      return res.json({ slides });
    }
  } catch (err) {
    console.error('[SlideGeneration] failed', err);
    res.status(500).json({ error: 'Slide generation failed', detail: err.message });
  }
});

// Stream slide generation using Server-Sent Events
router.post('/generate/stream', async (req, res) => {
  try {
    const { fullSow } = req.body;
    if (!fullSow) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'fullSow markdown is required' }));
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const slideSpecs = chunkSowMarkdown(fullSow);
    const slides = [];

    try {
      for await (const slide of generateSlidesAgentically(slideSpecs, brandContext)) {
        if (!slide.versionNumber) slide.versionNumber = 1;
        slides.push(slide);
        res.write(`data: ${JSON.stringify(slide)}\n\n`);
      }

      if (useDb) {
        try {
          const runId = await createRunWithSlides(fullSow, slides, null);
          res.write(`event: done\ndata: ${JSON.stringify({ runId })}\n\n`);
        } catch (dbErr) {
          console.error('[SlideGenerationStream] db persist failed', dbErr);
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: 'Slide persistence failed', detail: dbErr.message })}\n\n`
          );
        }
      } else {
        slides.forEach(s => slideStore.set(s.id, s));
        res.write(`event: done\ndata: {}\n\n`);
      }
    } catch (streamErr) {
      console.error('[SlideGenerationStream] failed during generation', streamErr);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: 'Slide generation failed', detail: streamErr.message })}\n\n`
      );
    }

    res.end();
  } catch (err) {
    console.error('[SlideGenerationStream] failed', err);
    res.status(500).json({ error: 'Slide generation failed', detail: err.message });
  }
});

// Fetch a single slide with history
router.get('/:slideId', async (req, res) => {
  try {
    const { slideId } = req.params;
    if (useDb) {
      const slide = await getSlideWithHistory(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      slide.chatHistory = slide.chatHistory || [];
      slide.versionHistory = slide.versionHistory || [];
      if (!slide.versionNumber) slide.versionNumber = slide.versionHistory.length;
      slide.currentHtml = slide.currentHtml || '';
      return res.json({ slide });
    } else {
      const slide = slideStore.get(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      slide.chatHistory = slide.chatHistory || [];
      slide.versionHistory = slide.versionHistory || [];
      if (!slide.versionNumber) slide.versionNumber = slide.versionHistory.length;
      slide.currentHtml = slide.currentHtml || '';
      return res.json({ slide });
    }
  } catch (err) {
    console.error('[SlideFetch] failed', err);
    res.status(500).json({ error: 'Fetch failed', detail: err.message });
  }
});

// Apply an edit to a slide
router.post('/:slideId/edit', async (req, res) => {
  try {
    const { slideId } = req.params;
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'instruction required' });

    await withSlideLock(slideId, async () => {
      if (useDb) {
        const slideWithHistory = await getSlideWithHistory(slideId);
        if (!slideWithHistory) return res.status(404).json({ error: 'Slide not found' });
        if (slideWithHistory.isLocked) {
          return res.status(409).json({ error: 'Slide is locked/finalized and cannot be edited' });
        }

        const updated = await applySlideEdit(slideWithHistory, instruction);
        const lastVersion = updated.versionHistory.slice(-1)[0];
        await persistSlideEdit(slideId, updated.currentHtml, lastVersion.source, instruction, null);
        return res.json({
          slide: {
            id: slideId,
            currentHtml: updated.currentHtml,
            isLocked: slideWithHistory.isLocked,
            finalizedAt: slideWithHistory.finalizedAt,
          },
        });
      } else {
        const slide = slideStore.get(slideId);
        if (!slide) return res.status(404).json({ error: 'Slide not found' });
        if (slide.isLocked) {
          return res.status(409).json({ error: 'Slide is locked/finalized and cannot be edited' });
        }
        const updated = await applySlideEdit(slide, instruction);
        slideStore.set(slideId, updated);
        return res.json({ slide: updated });
      }
    });
  } catch (err) {
    console.error('[SlideEdit] failed', err);
    res.status(500).json({ error: 'Edit failed', detail: err.message });
  }
});

// List versions of a slide
router.get('/:slideId/versions', async (req, res) => {
  try {
    const { slideId } = req.params;
    if (useDb) {
      const slide = await getSlideWithHistory(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      return res.json({ versions: slide.versionHistory });
    } else {
      const slide = slideStore.get(slideId);
      if (!slide) return res.status(404).json({ error: 'Slide not found' });
      return res.json({ versions: slide.versionHistory });
    }
  } catch (err) {
    console.error('[SlideVersions] failed', err);
    res.status(500).json({ error: 'Failed to fetch versions', detail: err.message });
  }
});

// Revert to an earlier version
router.post('/:slideId/revert', async (req, res) => {
  try {
    const { slideId } = req.params;
    const { versionIndex } = req.body;
    if (versionIndex === undefined) return res.status(400).json({ error: 'versionIndex required' });

    await withSlideLock(slideId, async () => {
      if (useDb) {
        const slide = await getSlideWithHistory(slideId);
        if (!slide) return res.status(404).json({ error: 'Slide not found' });
        if (slide.isLocked) {
          return res.status(409).json({ error: 'Slide is locked/finalized and cannot be reverted' });
        }
        if (versionIndex < 0 || versionIndex >= slide.versionHistory.length) {
          return res.status(400).json({ error: 'Invalid version index' });
        }

        const target = slide.versionHistory[versionIndex];
        revertSlideToVersion(slide, versionIndex);
        await persistSlideEdit(slideId, target.html, 'revert', `Reverted to version ${target.versionNumber}`, null);
        return res.json({
          slide: {
            id: slideId,
            currentHtml: target.html,
            isLocked: slide.isLocked,
            finalizedAt: slide.finalizedAt,
            versionNumber: slide.versionNumber,
            chatHistory: slide.chatHistory,
          },
        });
      } else {
        const slide = slideStore.get(slideId);
        if (!slide) return res.status(404).json({ error: 'Slide not found' });
        if (slide.isLocked) {
          return res.status(409).json({ error: 'Slide is locked/finalized and cannot be reverted' });
        }
        const reverted = revertSlideToVersion(slide, versionIndex);
        slideStore.set(slideId, reverted);
        return res.json({ slide: reverted });
      }
    });
  } catch (err) {
    console.error('[SlideRevert] failed', err);
    res.status(500).json({ error: 'Revert failed', detail: err.message });
  }
});

// Lock a slide
router.post('/:slideId/lock', async (req, res) => {
  try {
    const { slideId } = req.params;
    await withSlideLock(slideId, async () => {
      if (useDb) {
        await lockSlide(slideId, null);
        const slide = await getSlideWithHistory(slideId);
        return res.json({ slide });
      } else {
        const slide = slideStore.get(slideId);
        if (!slide) return res.status(404).json({ error: 'Slide not found' });
        slide.isLocked = true;
        slide.finalizedAt = new Date();
        slideStore.set(slideId, slide);
        return res.json({ slide });
      }
    });
  } catch (err) {
    console.error('[SlideLock] failed', err);
    res.status(500).json({ error: 'Lock failed', detail: err.message });
  }
});

// Unlock a slide
router.post('/:slideId/unlock', async (req, res) => {
  try {
    const { slideId } = req.params;
    await withSlideLock(slideId, async () => {
      if (useDb) {
        await unlockSlide(slideId, null);
        const slide = await getSlideWithHistory(slideId);
        return res.json({ slide });
      } else {
        const slide = slideStore.get(slideId);
        if (!slide) return res.status(404).json({ error: 'Slide not found' });
        slide.isLocked = false;
        slide.finalizedAt = null;
        slideStore.set(slideId, slide);
        return res.json({ slide });
      }
    });
  } catch (err) {
    console.error('[SlideUnlock] failed', err);
    res.status(500).json({ error: 'Unlock failed', detail: err.message });
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
  <div>${s.currentHtml}</div>
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
