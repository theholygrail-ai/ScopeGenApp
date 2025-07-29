import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function GeneratedSowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (location.state as any)?.markdown || '';
  const [markdown, setMarkdown] = useState(initial);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button className="text-blue-600" onClick={() => navigate(-1)}>&larr; Back</button>
        <h1 className="text-2xl font-bold">Generated SOW</h1>
      </div>
      <textarea
        className="w-full border p-2 h-96 mb-4"
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
      />
    </div>
  );
}
