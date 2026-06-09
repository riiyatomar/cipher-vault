/**
 * CipherVault — API Client
 * Axios instance with JWT interceptor and base configuration.
 *
 * DEMO MODE: When the backend is unreachable (no Docker running),
 * the app automatically falls back to localStorage-based demo mode.
 * Set NEXT_PUBLIC_DEMO_MODE=true in .env.local to force demo mode.
 */
import axios from 'axios';
import {
  demoAuthAPI, demoDocumentsAPI, demoEncryptionAPI, demoAuditAPI,
} from '@/lib/demo-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const FORCE_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ── Demo mode detection ──────────────────────────────────
let _demoMode = FORCE_DEMO;

export function isDemoMode() {
  return _demoMode;
}

// Check connectivity on first load — if backend is down, switch to demo
if (typeof window !== 'undefined' && !FORCE_DEMO) {
  axios.get(`${API_BASE_URL}/health`, { timeout: 3000 })
    .catch(() => {
      _demoMode = true;
      console.log('%c🔒 CipherVault running in DEMO MODE (backend not available)', 'color: #6366f1; font-weight: bold; font-size: 14px;');
    });
}

// ── Real Axios client (used when backend is available) ────
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

// ── Unified API — routes to demo or real backend ─────────
export const authAPI = {
  register: (data) => _demoMode ? demoAuthAPI.register(data) : api.post('/auth/register', data),
  login: (data) => _demoMode ? demoAuthAPI.login(data) : api.post('/auth/login', data),
  getProfile: () => _demoMode ? demoAuthAPI.getProfile() : api.get('/auth/me'),
  refresh: (token) => _demoMode ? demoAuthAPI.refresh(token) : api.post('/auth/refresh', { refresh_token: token }),
};

export const documentsAPI = {
  upload: (formData) => _demoMode ? demoDocumentsAPI.upload(formData) : api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: () => _demoMode ? demoDocumentsAPI.list() : api.get('/documents/list'),
  get: (id) => _demoMode ? demoDocumentsAPI.get(id) : api.get(`/documents/${id}`),
  download: (id) => _demoMode ? demoDocumentsAPI.download(id) : api.get(`/documents/${id}/download`, { responseType: 'arraybuffer' }),
  delete: (id) => _demoMode ? demoDocumentsAPI.delete(id) : api.delete(`/documents/${id}`),
};

export const encryptionAPI = {
  encrypt: (data) => _demoMode ? demoEncryptionAPI.encrypt(data) : api.post('/encryption/encrypt', data),
  decrypt: (data) => _demoMode ? demoEncryptionAPI.decrypt(data) : api.post('/encryption/decrypt', data),
};

export const auditAPI = {
  getLogs: (params) => _demoMode ? demoAuditAPI.getLogs(params) : api.get('/audit/logs', { params }),
  getStats: () => _demoMode ? demoAuditAPI.getStats() : api.get('/audit/stats'),
  getSecurityEvents: () => _demoMode ? demoAuditAPI.getSecurityEvents() : api.get('/audit/security-events'),
};

export default api;
