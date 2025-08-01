import axios from 'axios';

// Read the API base URL from the environment so deployments can
// target different backends without modifying the source.
const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';

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
