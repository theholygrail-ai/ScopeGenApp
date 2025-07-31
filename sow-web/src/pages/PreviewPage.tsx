import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function PreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const slides = (location.state as any)?.slides || [];
  const [index, setIndex] = useState(0);

  if (!slides.length) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">No slides to preview.</p>
        <button className="underline" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  const prev = () => setIndex((i) => Math.max(i - 1, 0));
  const next = () => setIndex((i) => Math.min(i + 1, slides.length - 1));

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="flex-grow flex items-center justify-center w-full">
        <div
          className="bg-white p-6 rounded shadow max-w-3xl w-full"
          dangerouslySetInnerHTML={{ __html: slides[index].currentHtml }}
        />
      </div>
      <div className="mt-4 flex items-center space-x-4">
        <button onClick={prev} disabled={index === 0} className="px-4 py-2 bg-gray-200 rounded">
          Prev
        </button>
        <span>
          {index + 1} / {slides.length}
        </span>
        <button onClick={next} disabled={index === slides.length - 1} className="px-4 py-2 bg-gray-200 rounded">
          Next
        </button>
      </div>
      <button onClick={() => navigate(-1)} className="mt-4 underline text-blue-600">
        Back to Editor
      </button>
    </div>
  );
}
