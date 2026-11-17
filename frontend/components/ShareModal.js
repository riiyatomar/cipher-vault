'use client';

/**
 * CipherVault — Share Modal
 * Generates a clean shareable link and QR code.
 * The recipient MUST enter the encryption password to decrypt and view the file.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  HiOutlineX, HiOutlineClipboard, HiOutlineCheck,
  HiOutlineShare, HiOutlineShieldCheck,
  HiOutlineDownload, HiOutlineLockClosed
} from 'react-icons/hi';

export default function ShareModal({ doc, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareLink = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/share/${doc.id}`;
  }, [doc.id]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      toast.success('Share link copied!');
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

          <div className="space-y-4">
            {/* Password Protection Notice */}
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <HiOutlineLockClosed className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <strong>Password Protected Link:</strong> Anyone opening this link or scanning the QR code will be required to enter the file&apos;s password to decrypt it.
              </div>
            </div>

            {/* Link Input & Copy */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Shareable Link</label>
              <div className="flex gap-2">
                <input
                  value={shareLink}
                  readOnly
                  className="input-field text-xs flex-1 select-all"
                  style={{ fontFamily: 'monospace' }}
                />
                <button onClick={copyLink} className="btn-primary px-3 py-2 gap-1 text-xs flex-shrink-0">
                  {copied ? <HiOutlineCheck className="w-4 h-4" /> : <HiOutlineClipboard className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center pt-2">
              <div className="p-4 rounded-xl bg-white shadow-md">
                <QRCodeSVG
                  id="share-qr-code"
                  value={shareLink}
                  size={190}
                  level="M"
                  fgColor="#1e1b4b"
                  bgColor="#ffffff"
                />
              </div>
              <button onClick={downloadQR} className="mt-3 text-xs flex items-center gap-1.5 hover:underline" style={{ color: 'var(--brand-light)' }}>
                <HiOutlineDownload className="w-3.5 h-3.5" />
                Download QR Code Image
              </button>
            </div>

            <button onClick={onClose} className="btn-secondary w-full py-2.5 text-sm mt-2">
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
