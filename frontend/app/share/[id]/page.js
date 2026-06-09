'use client';

/**
 * CipherVault — Share Receiver Page
 * Public page for recipients of shared links.
 * Decrypts using password from URL fragment (never sent to server).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { documentsAPI } from '@/lib/api';
import { decryptFile } from '@/lib/encryption';
import toast from 'react-hot-toast';
import {
  HiOutlineLockOpen, HiOutlineDownload, HiOutlineShieldCheck,
  HiOutlineDocumentText, HiOutlinePhotograph, HiOutlineExclamation
} from 'react-icons/hi';

export default function SharePage() {
  const params = useParams();
  const docId = params.id;
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDoc() {
      try {
        const res = await documentsAPI.get(docId);
        setDoc(res.data);
      } catch {
        setError('Document not found or has expired.');
      } finally {
        setLoading(false);
      }
    }
    if (docId) loadDoc();
  }, [docId]);

  const handleDecrypt = async () => {
    // Read password from URL fragment
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (!hash) {
      toast.error('No decryption key found in link');
      return;
    }

    let pwd;
    try {
      const decoded = JSON.parse(atob(hash));
      pwd = decoded.pwd;
    } catch {
      toast.error('Invalid share link');
      return;
    }

    setDecrypting(true);
    try {
      const res = await documentsAPI.download(docId);
      const encryptedData = res.data;
      const salt = res.headers['x-salt'] || doc.salt;
      const iv = res.headers['x-iv'] || doc.iv;
      const iterations = doc.iterations || 600000;

      const decryptedData = await decryptFile(encryptedData, pwd, salt, iv, iterations);
      const blob = new Blob([decryptedData], { type: doc.mime_type });
      const url = URL.createObjectURL(blob);
      setDecryptedUrl(url);
      if (doc.mime_type.startsWith('image/')) setPreviewUrl(url);
      toast.success('File decrypted successfully!');
    } catch {
      toast.error('Decryption failed — invalid password or corrupted file');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
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
          <HiOutlineShieldCheck className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--brand-primary)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>CipherVault</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Encrypted file shared with you</p>
        </div>

        {/* Doc info */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
              {doc.mime_type === 'application/pdf'
                ? <HiOutlineDocumentText className="w-5 h-5" style={{ color: 'var(--brand-light)' }} />
                : <HiOutlinePhotograph className="w-5 h-5" style={{ color: 'var(--brand-light)' }} />
              }
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{doc.filename}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(doc.file_size / (1024 * 1024)).toFixed(2)} MB • {doc.encryption_algorithm}
                {doc.iterations > 600000 ? ' • Maximum Security' : ''}
              </p>
            </div>
          </div>
        </div>

        {!decryptedUrl ? (
          <div className="glass-card p-6 text-center">
            <button
              onClick={handleDecrypt}
              disabled={decrypting}
              className="btn-primary w-full py-3.5 gap-2"
            >
              {decrypting ? (
                <><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Decrypting...</>
              ) : (
                <><HiOutlineLockOpen className="w-5 h-5" /> Decrypt & Access</>
              )}
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--text-dim)' }}>
              Decryption happens entirely in your browser.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6"
          >
            {previewUrl && (
              <div className="mb-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-primary)' }}>
                <img src={previewUrl} alt="Preview" className="max-h-64 w-full object-contain" style={{ background: 'rgba(0,0,0,0.2)' }} />
              </div>
            )}
            <button onClick={handleDownload} className="btn-primary w-full py-3.5 gap-2">
              <HiOutlineDownload className="w-5 h-5" /> Download File
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
