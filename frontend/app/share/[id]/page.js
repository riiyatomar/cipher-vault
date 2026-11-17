'use client';

/**
 * CipherVault — Share Receiver Page
 * Public page for recipients of shared links.
 * Requires the recipient to enter the decryption password before the file can be unlocked.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { documentsAPI } from '@/lib/api';
import { decryptFile } from '@/lib/encryption';
import toast from 'react-hot-toast';
import {
  HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineDownload, HiOutlineShieldCheck,
  HiOutlineDocumentText, HiOutlinePhotograph, HiOutlineExclamation,
  HiOutlineEye, HiOutlineEyeOff, HiOutlineKey
} from 'react-icons/hi';

export default function SharePage() {
  const params = useParams();
  const docId = params.id;
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDoc() {
      try {
        let res;
        try {
          res = await documentsAPI.getShared(docId);
        } catch {
          res = await documentsAPI.get(docId);
        }
        setDoc(res.data);
      } catch {
        setError('Document not found, expired, or access is restricted.');
      } finally {
        setLoading(false);
      }
    }
    if (docId) loadDoc();
  }, [docId]);

  const handleDecrypt = async (e) => {
    if (e) e.preventDefault();
    if (!password) {
      toast.error('Please enter the password to decrypt this file');
      return;
    }

    setDecrypting(true);
    try {
      let res;
      try {
        res = await documentsAPI.downloadShared(docId);
      } catch {
        res = await documentsAPI.download(docId);
      }

      const encryptedData = res.data;
      const salt = res.headers?.['x-salt'] || doc.salt;
      const iv = res.headers?.['x-iv'] || doc.iv;
      const iterations = doc.iterations || 600000;

      if (!salt || !iv) {
        toast.error('File encryption parameters missing');
        setDecrypting(false);
        return;
      }

      const decryptedData = await decryptFile(encryptedData, password, salt, iv, iterations);
      const blob = new Blob([decryptedData], { type: doc.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setDecryptedUrl(url);

      if (doc.mime_type?.startsWith('image/') || doc.mime_type === 'application/pdf') {
        setPreviewUrl(url);
      }
      toast.success('Document decrypted successfully!');
    } catch (err) {
      console.error('Decryption failed:', err);
      toast.error('Incorrect password! Unable to decrypt file.');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownload = () => {
    if (!decryptedUrl) return;
    const a = document.createElement('a');
    a.href = decryptedUrl;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLockAgain = () => {
    if (decryptedUrl) {
      URL.revokeObjectURL(decryptedUrl);
    }
    setDecryptedUrl(null);
    setPreviewUrl(null);
    setPassword('');
    toast('Document locked');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="glass-card p-8 max-w-md text-center">
          <HiOutlineExclamation className="w-12 h-12 mx-auto mb-4 text-accent-rose" />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Document Unavailable</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center mx-auto mb-3 shadow-glow">
            <HiOutlineShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>CipherVault</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Securely shared encrypted document</p>
        </div>

        {/* Doc Info Card */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
              {doc.mime_type === 'application/pdf'
                ? <HiOutlineDocumentText className="w-6 h-6" style={{ color: 'var(--brand-light)' }} />
                : <HiOutlinePhotograph className="w-6 h-6" style={{ color: 'var(--brand-light)' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.filename}</p>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <HiOutlineLockClosed className="w-3 h-3" />
                  {doc.encryption_algorithm || 'AES-256-GCM'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!decryptedUrl ? (
          /* Password Form */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <form onSubmit={handleDecrypt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Decryption Password
                </label>
                <div className="relative">
                  <HiOutlineKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-dim)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password to unlock file"
                    required
                    autoFocus
                    className="input-field pl-11 pr-11 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {showPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <HiOutlineLockClosed className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  This file cannot be decrypted without the correct password. Decryption happens entirely inside your browser.
                </p>
              </div>

              <button
                type="submit"
                disabled={decrypting || !password}
                className="btn-primary w-full py-3.5 gap-2"
              >
                {decrypting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Decrypting...</span>
                  </>
                ) : (
                  <>
                    <HiOutlineLockOpen className="w-5 h-5" />
                    <span>Unlock & Decrypt</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          /* Decrypted view */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <HiOutlineShieldCheck className="w-5 h-5" />
                <span>Decrypted Successfully</span>
              </div>
              <button
                onClick={handleLockAgain}
                className="text-xs px-2.5 py-1 rounded-lg border hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}
              >
                Lock Again
              </button>
            </div>

            {previewUrl && (
              <div className="rounded-xl overflow-hidden border max-h-72 flex items-center justify-center p-2" style={{ borderColor: 'var(--border-primary)', background: 'rgba(0,0,0,0.2)' }}>
                {doc.mime_type?.startsWith('image/') ? (
                  <img src={previewUrl} alt="Preview" className="max-h-64 object-contain rounded-lg" />
                ) : (
                  <iframe src={previewUrl} title="PDF Preview" className="w-full h-64 rounded-lg" />
                )}
              </div>
            )}

            <button onClick={handleDownload} className="btn-primary w-full py-3.5 gap-2">
              <HiOutlineDownload className="w-5 h-5" /> Download Decrypted File
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
