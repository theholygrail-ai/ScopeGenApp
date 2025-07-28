import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Replace with your actual IP if testing on device

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function uploadBRDFile(file: any) {
  const formData = new FormData();
  formData.append('brdFile', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as any);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
