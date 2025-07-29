import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from '../pages/UploadPage';
import PreviewPage from '../pages/PreviewPage';
import BrandingPage from '../pages/BrandingPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/branding" element={<BrandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
