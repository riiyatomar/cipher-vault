'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { documentsAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ShareModal from '@/components/ShareModal';
import { logActivity } from '@/app/activity/page';
import toast from 'react-hot-toast';
import {
  HiOutlineCloudUpload, HiOutlineDocumentText, HiOutlinePhotograph,
  HiOutlineTrash, HiOutlineDownload, HiOutlineLockOpen, HiOutlineClock,
  HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineExclamation,
  HiOutlineShare
} from 'react-icons/hi';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getTimeRemaining(expiryTime) {
  if (!expiryTime) return { text: 'No expiry', urgent: false, permanent: true };
  const diff = new Date(expiryTime) - new Date();
  if (diff <= 0) return { text: 'Expired', urgent: true, permanent: false };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return {
    text: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
    urgent: hours < 1,
    permanent: false,
  };
}

function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return HiOutlineDocumentText;
  return HiOutlinePhotograph;
}

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);
  const [shareDoc, setShareDoc] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  // Refresh countdown every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await documentsAPI.list();
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => documentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold mb-1">
              Welcome, <span className="gradient-text">{user?.username}</span>
            </h1>
            <p className="text-surface-400">
              {documents.length} encrypted document{documents.length !== 1 ? 's' : ''} in your vault
            </p>
          </div>
          <Link href="/upload" className="btn-primary gap-2">
            <HiOutlineCloudUpload className="w-5 h-5" />
            Upload File
          </Link>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Files', value: documents.length, icon: HiOutlineDocumentText, color: 'text-brand-400' },
            { label: 'Encrypted', value: documents.filter(d => d.status === 'active').length, icon: HiOutlineLockClosed, color: 'text-accent-emerald' },
            { label: 'Expiring Soon', value: documents.filter(d => d.expiry_time && getTimeRemaining(d.expiry_time).urgent).length, icon: HiOutlineClock, color: 'text-accent-amber' },
            { label: 'Protected', value: documents.filter(d => d.encryption_algorithm).length, icon: HiOutlineShieldCheck, color: 'text-accent-cyan' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="glass-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-surface-400 mt-1">{stat.label}</div>
              </div>
            );
          })}
        </motion.div>

        {/* File List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-16 text-center"
          >
            <HiOutlineCloudUpload className="w-16 h-16 text-surface-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-surface-300">Your Vault is Empty</h3>
            <p className="text-surface-500 max-w-sm mx-auto mb-6">
              Upload your first document to start protecting your files with zero-knowledge encryption.
            </p>
            <Link href="/upload" className="btn-primary gap-2">
              <HiOutlineCloudUpload className="w-5 h-5" />
              Upload Your First File
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {documents.map((doc, i) => {
                const Icon = getFileIcon(doc.mime_type);
                const timeLeft = getTimeRemaining(doc.expiry_time);
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card-hover p-5"
                  >
                    <div className="flex items-center gap-4">
                      {/* File icon */}
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-brand-400" />
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{doc.filename}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-surface-400">
                          <span>{formatBytes(doc.file_size)}</span>
                          <span className="w-1 h-1 rounded-full bg-surface-600" />
                          <span>
                            {new Date(doc.upload_time).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-surface-600" />
                          <span>{doc.download_count} download{doc.download_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="hidden sm:flex items-center gap-2">
                        <span className="badge-encrypted">
                          <HiOutlineLockClosed className="w-3 h-3 mr-1" />
                          {doc.encryption_algorithm}
                        </span>
                        <span className={timeLeft.permanent ? 'badge-active' : timeLeft.urgent ? 'badge-expired' : 'badge-active'}>
                          <HiOutlineClock className="w-3 h-3 mr-1" />
                          {timeLeft.text}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShareDoc(doc)}
                          className="p-2 rounded-lg text-surface-400 hover:text-accent-amber hover:bg-accent-amber/10 transition-colors"
                          title="Share"
                        >
                          <HiOutlineShare className="w-5 h-5" />
                        </button>
                        <Link
                          href={`/unlock/${doc.id}`}
                          className="p-2 rounded-lg text-surface-400 hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
                          title="Unlock & Download"
                        >
                          <HiOutlineLockOpen className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm('Delete this document permanently?')) {
                              deleteMutation.mutate(doc.id);
                              logActivity('delete', { filename: doc.filename });
                            }
                          }}
                          className="p-2 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-accent-rose/10 transition-colors"
                          title="Delete"
                        >
                          <HiOutlineTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareDoc && (
        <ShareModal
          doc={shareDoc}
          onClose={() => setShareDoc(null)}
        />
      )}
    </div>
  );
}
