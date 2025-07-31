class MockPool {
  constructor() {
    this.runs = [];
    this.slides = [];
    this.slideVersions = [];
    this.editLogs = [];
    this.nextRunId = 1;
  }
  async connect() { return this; }
  release() {}
  async query(text, params) {
    if (/^BEGIN/.test(text) || /^COMMIT/.test(text) || /^ROLLBACK/.test(text)) {
      return { rows: [], rowCount: 0 };
    }
    if (/INSERT INTO sow_runs/i.test(text)) {
      const id = this.nextRunId++;
      this.runs.push({ id, user_id: params[0], input_markdown: params[1] });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/INSERT INTO slides/i.test(text)) {
      const [id, runId, title, md, html, source, ver] = params;
      this.slides.push({
        id,
        run_id: runId,
        title,
        original_markdown: md,
        current_html: html,
        model_source: source,
        version_number: ver,
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rowCount: 1 };
    }
    if (/INSERT INTO slide_versions/i.test(text)) {
      const [slideId, html, source, instruction, ver] = params;
      this.slideVersions.push({
        slide_id: slideId,
        html,
        source,
        instruction,
        version_number: ver,
        created_at: new Date(),
      });
      return { rowCount: 1 };
    }
    if (/INSERT INTO slide_edit_logs/i.test(text)) {
      const [slideId, userId, action, instruction, fromVer, toVer] = params;
      this.editLogs.push({ slide_id: slideId, user_id: userId, action, instruction, from_version: fromVer, to_version: toVer });
      return { rowCount: 1 };
    }
    if (/SELECT version_number FROM slides WHERE id=\$1/i.test(text)) {
      const slideId = params[0];
      const slide = this.slides.find(s => s.id === slideId);
      return { rowCount: slide ? 1 : 0, rows: slide ? [{ version_number: slide.version_number }] : [] };
    }
    if (/UPDATE slides SET current_html=/i.test(text)) {
      const [html, source, versionNumber, slideId] = params;
      const slide = this.slides.find(s => s.id === slideId);
      if (!slide) return { rowCount: 0 };
      slide.current_html = html;
      slide.model_source = source;
      slide.version_number = versionNumber;
      slide.updated_at = new Date();
      return { rowCount: 1 };
    }
    if (/SELECT \* FROM slides WHERE run_id=\$1/i.test(text)) {
      const runId = params[0];
      const rows = this.slides.filter(s => s.run_id === runId);
      return { rows };
    }
    if (/SELECT \* FROM slides WHERE id=\$1/i.test(text)) {
      const slideId = params[0];
      const slide = this.slides.find(s => s.id === slideId);
      return { rowCount: slide ? 1 : 0, rows: slide ? [slide] : [] };
    }
    if (/SELECT version_number, instruction, source, html, created_at FROM slide_versions WHERE slide_id=\$1/i.test(text)) {
      const slideId = params[0];
      const rows = this.slideVersions.filter(v => v.slide_id === slideId).sort((a,b)=>a.version_number-b.version_number);
      return { rows, rowCount: rows.length };
    }
    throw new Error('Unhandled query: ' + text);
  }
}
module.exports = new MockPool();
