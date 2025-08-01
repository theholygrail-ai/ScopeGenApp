import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, generateSlides } from '../services/api';

interface Slide {
  id: string;
  title: string;
  currentHtml: string;
  chatHistory: { role: string; content: string }[];
}

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function diffText(oldStr: string, newStr: string): DiffPart[] {
  const oldParts = oldStr.split(/(\s+)/).filter(Boolean);
  const newParts = newStr.split(/(\s+)/).filter(Boolean);
  const diff: DiffPart[] = [];
  let i = 0,
    j = 0;
  while (i < oldParts.length && j < newParts.length) {
    if (oldParts[i] === newParts[j]) {
      diff.push({ value: newParts[j] });
      i++;
      j++;
    } else {
      diff.push({ value: newParts[j], added: true });
      diff.push({ value: oldParts[i], removed: true });
      i++;
      j++;
    }
  }
  while (j < newParts.length) {
    diff.push({ value: newParts[j], added: true });
    j++;
  }
  while (i < oldParts.length) {
    diff.push({ value: oldParts[i], removed: true });
    i++;
  }
  return diff;
}

export default function SlideEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState<Slide | null>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState<DiffPart[] | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const init = async () => {
      const passed = (location.state as any) || {};
      if (passed.slides && passed.slides.length) {
        setSlides(passed.slides);
        setSelected(passed.slides[0]);
        return;
      }
      if (passed.markdown) {
        try {
          const newSlides = await generateSlides(passed.markdown);
          setSlides(newSlides);
          setSelected(newSlides[0]);
        } catch (err) {
          setError('Failed to load slides');
        }
      }
    };
    init();
  }, [location.state]);

  const updateSlideInState = (updated: Slide) => {
    setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected(updated);
  };

  const applyEdit = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    const previous = selected.currentHtml;
    try {
      const res = await api.post(`/slides/${selected.id}/edit`, { instruction });
      const updated = res.data.slide as Slide;
      updateSlideInState(updated);
      setInstruction('');
      setDiff(diffText(previous, updated.currentHtml));
    } catch (err) {
      setError('Edit failed');
    } finally {
      setLoading(false);
    }
  };

  const revertVersion = async (index: number) => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api.post(`/slides/${selected.id}/revert`, { versionIndex: index });
      const updated = res.data.slide as Slide;
      updateSlideInState(updated);
      setDiff(null);
    } catch (err) {
      setError('Revert failed');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    if (!selected) return [] as any[];
    const res = await api.get(`/slides/${selected.id}/versions`);
    return res.data.versions || [];
  };

  useEffect(() => {
    if (diff || !iframeRef.current || !selected) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>\n` +
      `<script src="https://cdn.tailwindcss.com"></script>` +
      `</head><body class="p-4">${selected.currentHtml}</body></html>`);
    doc.close();
  }, [selected, diff]);

  return (
    <div className="flex h-screen">
      <div className="w-1/5 border-r overflow-y-auto">
        {slides.map((s) => (
          <div key={s.id} onClick={() => setSelected(s)} className={`p-2 cursor-pointer ${selected?.id === s.id ? 'bg-gray-200' : ''}`}>{s.title}</div>
        ))}
      </div>
      <div className="w-3/5 p-4 overflow-auto">
        <div className="border p-4 bg-white rounded min-h-[70vh]">
          {diff ? (
            <div>
              {diff.map((p, i) => (
                <span
                  key={i}
                  className={p.added ? 'bg-green-200' : p.removed ? 'bg-red-200 line-through' : ''}
                >
                  {p.value}
                </span>
              ))}
            </div>
          ) : (
            <iframe ref={iframeRef} title="slide" className="w-full h-[70vh] border-none" />
          )}
        </div>
      </div>
      <div className="w-1/5 p-4 flex flex-col">
        <div className="flex-1 overflow-auto mb-2">
          {selected?.chatHistory.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className="text-xs font-semibold">{m.role}</div>
              <div className="whitespace-pre-wrap text-sm">{m.content}</div>
            </div>
          ))}
        </div>
        <textarea
          className="w-full border rounded p-2 mb-2"
          placeholder="Edit instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <button onClick={applyEdit} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          {loading ? 'Applying...' : 'Apply Edit'}
        </button>
        {error && <div className="text-red-500 mt-2 text-sm">{error}</div>}
        <button
          onClick={async () => {
            const versions = await loadVersions();
            if (versions.length) revertVersion(versions.length - 1);
          }}
          className="mt-2 text-sm underline"
        >
          Revert Last
        </button>
        <button
          onClick={() => navigate('/preview', { state: { slides } })}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
        >
          Preview Slides
        </button>
      </div>
    </div>
  );
}
