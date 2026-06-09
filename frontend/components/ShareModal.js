'use client';

/**
 * CipherVault — Share Modal
 * Generates a secure shareable link with password in URL fragment (never sent to server).
 * Includes QR code for easy mobile sharing.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  HiOutlineX, HiOutlineClipboard, HiOutlineCheck,
  HiOutlineShare, HiOutlineQrcode, HiOutlineShieldCheck,
  HiOutlineDownload
} from 'react-icons/hi';

export default function ShareModal({ doc, onClose }) {
  const [password, setPassword] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const generateLink = () => {
    if (!password) return;
    // Password goes in URL fragment (#) — NEVER sent to server
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const fragment = btoa(JSON.stringify({ pwd: password, docId: doc.id }));
    const link = `${baseUrl}/share/${doc.id}#${fragment}`;
    setShareLink(link);
    setShowQR(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('share-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement('a');
      a.download = `ciphervault-share-${doc.id.slice(0, 8)}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md rounded-2xl p-6 relative"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg" style={{ color: 'var(--text-dim)' }}>
            <HiOutlineX className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
              <HiOutlineShare className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Share Securely</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{doc.filename}</p>
            </div>
          </div>

          {!shareLink ? (
            // Step 1: Enter password
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  File Encryption Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateLink()}
                  placeholder="Enter the password used to encrypt this file"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <HiOutlineShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-light)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  The password is embedded in the URL fragment (#) and <strong>never sent to our servers</strong>. Recipients decrypt in their browser.
                </p>
              </div>

              <button
                onClick={generateLink}
                disabled={!password}
                className="btn-primary w-full py-3 gap-2"
              >
                <HiOutlineShare className="w-4 h-4" />
                Generate Share Link
              </button>
            </div>
          ) : (
            // Step 2: Share link + QR
            <div className="space-y-4">
              {/* Link */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Share Link</label>
                <div className="flex gap-2">
                  <input
                    value={shareLink}
                    readOnly
                    className="input-field text-xs flex-1"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button onClick={copyLink} className="btn-primary px-3 py-2 gap-1 text-xs flex-shrink-0">
                    {copied ? <HiOutlineCheck className="w-4 h-4" /> : <HiOutlineClipboard className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex flex-col items-center"
                >
                  <div className="p-4 rounded-xl bg-white">
                    <QRCodeSVG
                      id="share-qr-code"
                      value={shareLink}
                      size={200}
                      level="M"
                      fgColor="#1e1b4b"
                      bgColor="#ffffff"
                    />
                  </div>
                  <button onClick={downloadQR} className="mt-3 text-xs flex items-center gap-1" style={{ color: 'var(--brand-light)' }}>
                    <HiOutlineDownload className="w-3 h-3" />
                    Download QR Code
                  </button>
                </motion.div>
              )}

              <button onClick={onClose} className="btn-secondary w-full py-2.5 text-sm">
                Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
