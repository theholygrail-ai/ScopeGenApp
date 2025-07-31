const { pool } = require('./db');

function normalizeSlideRow(row) {
  return {
    id: row.id,
    title: row.title,
    originalMarkdown: row.original_markdown,
    currentHtml: row.current_html,
    modelSource: row.model_source,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createRunWithSlides(fullMarkdown, slides, userId = null) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runRes = await client.query(
      'INSERT INTO sow_runs (user_id, input_markdown) VALUES ($1, $2) RETURNING id',
      [userId, fullMarkdown]
    );
    const runId = runRes.rows[0].id;
    for (const slide of slides) {
      const source = slide.versionHistory[slide.versionHistory.length - 1]?.source || null;
      await client.query(
        `INSERT INTO slides (id, run_id, title, original_markdown, current_html, model_source, version_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [slide.id, runId, slide.title, slide.originalMarkdown, slide.currentHtml, source, 1]
      );
      await client.query(
        `INSERT INTO slide_versions (slide_id, html, source, instruction, version_number)
         VALUES ($1,$2,$3,$4,$5)`,
        [slide.id, slide.currentHtml, source, 'initial generation', 1]
      );
    }
    await client.query('COMMIT');
    return runId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function persistSlideEdit(slideId, updatedHtml, source, instruction, userId = null) {
  if (!pool) throw new Error('DATABASE_URL not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slideRes = await client.query('SELECT version_number FROM slides WHERE id=$1 FOR UPDATE', [slideId]);
    if (slideRes.rowCount === 0) throw new Error('Slide not found');
    const currentVersion = slideRes.rows[0].version_number;
    const newVersion = currentVersion + 1;
    await client.query(
      'UPDATE slides SET current_html=$1, model_source=$2, version_number=$3, updated_at=now() WHERE id=$4',
      [updatedHtml, source, newVersion, slideId]
    );
    await client.query(
      'INSERT INTO slide_versions (slide_id, html, source, instruction, version_number) VALUES ($1,$2,$3,$4,$5)',
      [slideId, updatedHtml, source, instruction, newVersion]
    );
    await client.query(
      'INSERT INTO slide_edit_logs (slide_id, user_id, action, instruction, from_version, to_version) VALUES ($1,$2,$3,$4,$5,$6)',
      [slideId, userId, 'edit', instruction, currentVersion, newVersion]
    );
    await client.query('COMMIT');
    return newVersion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getSlidesByRun(runId) {
  if (!pool) return [];
  const res = await pool.query('SELECT * FROM slides WHERE run_id=$1 ORDER BY created_at', [runId]);
  return res.rows.map(normalizeSlideRow);
}

async function getSlideWithHistory(slideId) {
  if (!pool) throw new Error('DATABASE_URL not configured');
  const slideRes = await pool.query('SELECT * FROM slides WHERE id=$1', [slideId]);
  if (slideRes.rowCount === 0) return null;
  const slide = normalizeSlideRow(slideRes.rows[0]);

  const versionsRes = await pool.query(
    'SELECT version_number, instruction, source, html, created_at FROM slide_versions WHERE slide_id=$1 ORDER BY version_number',
    [slideId]
  );
  slide.versionHistory = versionsRes.rows.map(v => ({
    versionNumber: v.version_number,
    instruction: v.instruction,
    source: v.source,
    html: v.html,
    createdAt: v.created_at,
  }));

  return slide;
}

module.exports = {
  createRunWithSlides,
  persistSlideEdit,
  getSlidesByRun,
  getSlideWithHistory,
  normalizeSlideRow,
};
