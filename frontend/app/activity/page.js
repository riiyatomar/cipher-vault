'use client';

/**
 * CipherVault — Activity Timeline
 * Chronological log of all user actions (upload, decrypt, download, share, delete, login).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  HiOutlineCloudUpload, HiOutlineDownload, HiOutlineTrash,
  HiOutlineLockOpen, HiOutlineLogin, HiOutlineShare, HiOutlineFilter,
  HiOutlineShieldCheck, HiOutlineClock
} from 'react-icons/hi';

const ACTIVITY_KEY = 'cv_activity_log';

const ACTION_CONFIG = {
  upload:   { icon: HiOutlineCloudUpload, color: '#6366f1', label: 'Uploaded' },
  decrypt:  { icon: HiOutlineLockOpen, color: '#06b6d4', label: 'Decrypted' },
  download: { icon: HiOutlineDownload, color: '#10b981', label: 'Downloaded' },
  share:    { icon: HiOutlineShare, color: '#f59e0b', label: 'Shared' },
  delete:   { icon: HiOutlineTrash, color: '#f43f5e', label: 'Deleted' },
  login:    { icon: HiOutlineLogin, color: '#8b5cf6', label: 'Logged in' },
};

/** Log an activity event (call from anywhere) */
export function logActivity(action, details = {}) {
  if (typeof window === 'undefined') return;
  const logs = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  logs.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
  // Keep last 200
  if (logs.length > 200) logs.length = 200;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(logs));
}

export default function ActivityPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
    setLogs(stored);
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Activity Timeline</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track every action on your encrypted documents</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['all', ...Object.keys(ACTION_CONFIG)].map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === key ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${filter === key ? 'var(--border-hover)' : 'var(--border-primary)'}`,
                color: filter === key ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {key === 'all' ? 'All' : ACTION_CONFIG[key].label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-16 text-center"
          >
            <HiOutlineClock className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-dim)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>No Activity Yet</h3>
            <p style={{ color: 'var(--text-muted)' }}>Start uploading and managing files to see your activity here.</p>
          </motion.div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: 'var(--border-primary)' }} />

            <div className="space-y-4">
              {filtered.map((log, i) => {
                const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.upload;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-4 pl-2"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                      style={{ background: `${config.color}20`, border: `2px solid ${config.color}40` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="glass-card flex-1 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {config.label}
                          {log.filename && <span style={{ color: 'var(--text-muted)' }}> — {log.filename}</span>}
                        </p>
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{log.details}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
