import axios from 'axios';

// Resolve the API base URL in a fail-fast manner so deployments always
// point to the intended backend. Local development may fall back to the
// Node server running on port 8000.
const API_BASE_URL = (() => {
  const envUrl = (import.meta as any).env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.DEV) return 'http://localhost:8000';
  console.error('🚨 Missing VITE_API_BASE_URL in production build.');
  throw new Error('VITE_API_BASE_URL is required in non-dev environments');
})();

console.log('Resolved API base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadBRDFile = async (file: File) => {
  const formData = new FormData();
  formData.append('brdFile', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const generateSow = async (markdown: string) => {
  const response = await api.post('/generate-sow', { markdown });
  return response.data;
};

export const generateSlides = async (fullSow: string) => {
  const { data } = await api.post('/slides/generate', { fullSow });
  return data.slides;
};

export const editSlide = async (id: string, instruction: string) => {
  const { data } = await api.post(`/slides/${id}/edit`, { instruction });
  return data.slide;
};

export const getVersions = async (id: string) => {
  const { data } = await api.get(`/slides/${id}/versions`);
  return data.versions;
};

export const revertSlide = async (id: string, versionIndex: number) => {
  const { data } = await api.post(`/slides/${id}/revert`, { versionIndex });
  return data.slide;
};

// --- Admin Endpoints ---
// `clearAdminCache` demonstrates how to call admin routes that require the
// `x-admin-token` header. The token can be provided explicitly or via a
// `VITE_ADMIN_TOKEN` environment variable exposed to the frontend.
export const clearAdminCache = async (token?: string) => {
  const adminToken = token || (import.meta as any).env.VITE_ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error('Admin token required for admin requests');
  }
  await api.post(
    '/admin/cache/clear',
    {},
    {
      headers: {
        'x-admin-token': adminToken,
      },
    }
  );
};
