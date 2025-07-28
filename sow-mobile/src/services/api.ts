import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Replace with your actual IP if testing on device

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
