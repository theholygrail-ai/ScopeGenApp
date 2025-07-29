import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import UploadPage from '../pages/UploadPage';
import PreviewPage from '../pages/PreviewPage';
import BrandingPage from '../pages/BrandingPage';
import RunMarkdownPage from '../pages/RunMarkdownPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/branding" element={<BrandingPage />} />
        <Route path="/run/:runId" element={<RunMarkdownPage />} />
      </Routes>
    </BrowserRouter>
  );
}
