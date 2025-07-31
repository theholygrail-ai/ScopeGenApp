import { useState, useRef, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';

interface Slide {
  id: string;
  currentHtml: string;
  versionNumber?: number;
}

interface Props {
  slide: Slide;
  onUpdate: (updated: Partial<Slide>) => void;
}

export default function SlideEditorPage({ slide, onUpdate }: Props) {
  const [instruction, setInstruction] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestInstructionRef = useRef(instruction);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestInstructionRef.current = instruction;
  }, [instruction]);

  const sendEdit = useCallback(
    async (instr: string) => {
      if (!instr.trim()) return;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setPending(true);
      setError(null);

      try {
        const resp = await fetch(`/slides/${slide.id}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: instr }),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        onUpdate(data.slide);
      } catch (e: any) {
        if (e.name === 'AbortError') {
          return;
        }
        setError(e.message || 'Edit failed');
      } finally {
        setPending(false);
      }
    },
    [slide.id, onUpdate]
  );

  const debouncedSend = useRef(
    debounce((instr: string) => {
      void sendEdit(instr);
    }, 500)
  ).current;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInstruction(e.target.value);
    debouncedSend(e.target.value);
  };

  const handleApply = () => {
    debouncedSend.cancel();
    void sendEdit(instruction);
  };

  useEffect(() => {
    return () => {
      debouncedSend.cancel();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [debouncedSend]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-semibold mb-1">Edit Instruction</label>
        <textarea
          value={instruction}
          onChange={handleChange}
          disabled={pending}
          className="w-full border rounded p-2"
          rows={3}
          placeholder="e.g., Make the header teal and increase font size"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleApply}
          disabled={pending || !instruction.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {pending ? 'Applying...' : 'Apply'}
        </button>
        {pending && <span className="text-sm text-gray-600">Edit in progress...</span>}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}

