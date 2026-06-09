'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { documentsAPI } from '@/lib/api';
import { decryptFile } from '@/lib/encryption';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { logActivity } from '@/app/activity/page';
import {
  HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineKey,
  HiOutlineDocumentText, HiOutlinePhotograph, HiOutlineDownload,
  HiOutlineShieldCheck, HiOutlineExclamation, HiOutlineEye, HiOutlineEyeOff
} from 'react-icons/hi';

export default function UnlockPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [decryptedFilename, setDecryptedFilename] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const res = await documentsAPI.get(documentId);
      return res.data;
    },
    enabled: isAuthenticated && !!documentId,
  });

  const handleDecrypt = async () => {
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setDecrypting(true);
    try {
      // Download encrypted file
      const res = await documentsAPI.download(documentId);
      const encryptedData = res.data;
      const salt = res.headers['x-salt'] || doc.salt;
      const iv = res.headers['x-iv'] || doc.iv;

      if (!salt || !iv) {
        toast.error('Missing encryption metadata');
        setDecrypting(false);
        return;
      }

      // Decrypt in browser
      const iterations = doc.iterations || 600000;
      const decryptedData = await decryptFile(encryptedData, password, salt, iv, iterations);

      // Create blob URL for download/preview
      const blob = new Blob([decryptedData], { type: doc.mime_type });
      const url = URL.createObjectURL(blob);
      setDecryptedUrl(url);
      setDecryptedFilename(doc.filename);

      // Preview for images and PDFs
      if (doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf') {
        setPreviewUrl(url);
      }

      toast.success('File decrypted successfully!');
      logActivity('decrypt', { filename: doc.filename, details: `Decrypted with ${doc.iterations || 600000} iterations` });
    } catch (err) {
      console.error('Decryption error:', err);
      toast.error('Decryption failed — wrong password or corrupted file');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownload = () => {
    if (!decryptedUrl) return;
    const a = document.createElement('a');
    a.href = decryptedUrl;
    a.download = decryptedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logActivity('download', { filename: decryptedFilename, details: 'Downloaded decrypted file' });
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Unlock Document</h1>
          <p className="text-surface-400">
            Enter your encryption password to decrypt and access this file.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="glass-card p-12 flex justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 text-center"
          >
            <HiOutlineExclamation className="w-12 h-12 text-accent-rose mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Document Not Found</h3>
            <p className="text-surface-400 mb-4">This document may have expired or been deleted.</p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary">
              Back to Dashboard
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Document info */}
            <div className="glass-card p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  {doc?.mime_type === 'application/pdf'
                    ? <HiOutlineDocumentText className="w-7 h-7 text-brand-400" />
                    : <HiOutlinePhotograph className="w-7 h-7 text-brand-400" />
                  }
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{doc?.filename}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-surface-400">
                    <span>{(doc?.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span className="w-1 h-1 rounded-full bg-surface-600 my-auto" />
                    <span>{doc?.encryption_algorithm}</span>
                    <span className="w-1 h-1 rounded-full bg-surface-600 my-auto" />
                    <span className={doc?.status === 'active' ? 'text-accent-emerald' : 'text-accent-rose'}>
                      {doc?.status}
                    </span>
                  </div>
                </div>
                <div className="badge-encrypted">
                  <HiOutlineLockClosed className="w-3 h-3 mr-1" />
                  Encrypted
                </div>
              </div>
            </div>

            {/* Unlock form or preview */}
            {!decryptedUrl ? (
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent-amber/10 flex items-center justify-center">
                    <HiOutlineKey className="w-5 h-5 text-accent-amber" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Enter Encryption Password</h3>
                    <p className="text-xs text-surface-400">The file will be decrypted in your browser</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
                      placeholder="File encryption password"
                      className="input-field pr-12"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                    >
                      {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                    </button>
                  </div>

                  <button
                    onClick={handleDecrypt}
                    disabled={decrypting || !password}
                    className="btn-primary w-full py-3.5 gap-2"
                  >
                    {decrypting ? (
                      <>
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Decrypting...
                      </>
                    ) : (
                      <>
                        <HiOutlineLockOpen className="w-5 h-5" />
                        Decrypt File
                      </>
                    )}
                  </button>

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
                    <HiOutlineShieldCheck className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-surface-400">
                      Decryption happens entirely in your browser. Your password is never sent to our servers.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-8"
              >
                <div className="text-center mb-6">
                  <HiOutlineLockOpen className="w-12 h-12 text-accent-emerald mx-auto mb-3" />
                  <h3 className="text-xl font-semibold">File Decrypted</h3>
                  <p className="text-surface-400 text-sm">Your file is ready for download</p>
                </div>

                {/* Image preview */}
                {previewUrl && doc?.mime_type?.startsWith('image/') && (
                  <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                    <img src={previewUrl} alt="Decrypted preview" className="max-h-96 w-full object-contain" style={{ background: 'var(--bg-card)' }} />
                  </div>
                )}

                {/* PDF preview */}
                {previewUrl && doc?.mime_type === 'application/pdf' && (
                  <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' }}>
                      <HiOutlineDocumentText className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>PDF Preview</span>
                    </div>
                    <iframe
                      src={previewUrl}
                      title="PDF Preview"
                      className="w-full bg-white"
                      style={{ height: '500px', border: 'none' }}
                    />
                  </div>
                )}

                <button onClick={handleDownload} className="btn-primary w-full py-3.5 gap-2">
                  <HiOutlineDownload className="w-5 h-5" />
                  Download Decrypted File
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
