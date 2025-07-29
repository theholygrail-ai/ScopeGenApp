import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
