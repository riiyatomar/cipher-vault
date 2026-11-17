/**
 * CipherVault — API Client
 * Axios instance with JWT interceptor and base configuration.
 * Talks directly to the backend API gateway.
 */
import axios from 'axios';

const API_BASE_URL = '/api';

// ── Axios client ──────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 + token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token: newRefresh } = res.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefresh);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── API Methods ───────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  refresh: (token) => api.post('/auth/refresh', { refresh_token: token }),
};

export const documentsAPI = {
  upload: (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: () => api.get('/documents/list'),
  get: (id) => api.get(`/documents/${id}`),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'arraybuffer' }),
  delete: (id) => api.delete(`/documents/${id}`),
  getShared: (id) => api.get(`/documents/shared/${id}`),
  downloadShared: (id) => api.get(`/documents/shared/${id}/download`, { responseType: 'arraybuffer' }),
};

export const encryptionAPI = {
  encrypt: (data) => api.post('/encryption/encrypt', data),
  decrypt: (data) => api.post('/encryption/decrypt', data),
};

export const auditAPI = {
  getLogs: (params) => api.get('/audit/logs', { params }),
  getStats: () => api.get('/audit/stats'),
  getSecurityEvents: () => api.get('/audit/security-events'),
};

export default api;
