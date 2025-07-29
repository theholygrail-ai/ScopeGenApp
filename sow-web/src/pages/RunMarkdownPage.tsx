import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, generateSow } from '../services/api';

export default function RunMarkdownPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMarkdown = async () => {
      if (!runId) return;
      try {
        const { data: tasks } = await api.get(`/ps/tasks/${runId}`);
        let combined = '';
        for (const task of tasks) {
          const { data } = await api.get(`/ps/tasks/${runId}/${task.id}`, { responseType: 'text' });
          const taskName = task.name || `Task ${task.id}`;
          combined += `## ${taskName}\n\n${data}\n\n`;
        }
        setMarkdown(combined.trim());
      } catch (err: any) {
        setError('Error loading tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchMarkdown();
  }, [runId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleGenerate = async () => {
    try {
      const { markdown: newMarkdown } = await generateSow(markdown);
      navigate('/generated', { state: { markdown: newMarkdown } });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button className="text-blue-600" onClick={handleBack}>&larr; Back</button>
        <h1 className="text-2xl font-bold">Run Markdown</h1>
      </div>
      <textarea
        className="w-full border p-2 h-96 mb-4"
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
      />
      <div className="space-x-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={handleCopy}
        >
          Copy Markdown
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleGenerate}
        >
          Generate SOW
        </button>
      </div>
    </div>
  );
}
