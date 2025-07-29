import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from '../pages/UploadPage';
import PreviewPage from '../pages/PreviewPage';
import BrandingPage from '../pages/BrandingPage';
import RunMarkdownPage from '../pages/RunMarkdownPage';
import GeneratedSowPage from '../pages/GeneratedSowPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/branding" element={<BrandingPage />} />
        <Route path="/run/:runId" element={<RunMarkdownPage />} />
        <Route path="/generated" element={<GeneratedSowPage />} />
      </Routes>
    </BrowserRouter>
  );
}
