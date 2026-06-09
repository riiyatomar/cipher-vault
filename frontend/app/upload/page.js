'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/context/AuthContext';
import { documentsAPI } from '@/lib/api';
import { encryptFile, hashFile } from '@/lib/encryption';
import { logActivity } from '@/app/activity/page';
import toast from 'react-hot-toast';
import {
  HiOutlineCloudUpload, HiOutlineLockClosed, HiOutlineCheckCircle,
  HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlinePhotograph,
  HiOutlineX, HiOutlineKey, HiOutlineEye, HiOutlineEyeOff, HiOutlineClock,
  HiOutlineLightningBolt
} from 'react-icons/hi';

const EXPIRY_OPTIONS = [
  { value: 'none', label: 'No expiration', desc: 'File stays until you delete it' },
  { value: '24', label: '24 hours', desc: 'Auto-deletes after 1 day' },
  { value: '48', label: '48 hours', desc: 'Auto-deletes after 2 days' },
  { value: '168', label: '7 days', desc: 'Auto-deletes after 1 week' },
];

const ENCRYPTION_LEVELS = [
  { value: 600000, label: 'Standard', desc: 'AES-256 • 600K PBKDF2 iterations', icon: '🔒' },
  { value: 1000000, label: 'Maximum', desc: 'AES-256 • 1M PBKDF2 iterations', icon: '🛡️' },
];

const STEPS = ['Select File', 'Set Password', 'Encrypting', 'Uploading', 'Done'];

export default function UploadPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(0); // 0=select, 1=password, 2=encrypting, 3=uploading, 4=done
  const [progress, setProgress] = useState(0);
  const [encryptionStatus, setEncryptionStatus] = useState('');
  const [expiryHours, setExpiryHours] = useState('none');
  const [encryptionLevel, setEncryptionLevel] = useState(600000);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowed.includes(f.type)) {
        toast.error('Only PDF, JPG, and PNG files are supported');
        return;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error('File must be under 20MB');
        return;
      }
      setFile(f);
      setStep(1);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 20 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      // Step 2: Encrypt
      setStep(2);
      setEncryptionStatus('Reading file...');
      const arrayBuffer = await file.arrayBuffer();

      setEncryptionStatus('Deriving encryption key (PBKDF2)...');
      setProgress(20);

      setEncryptionStatus(`Encrypting with AES-256-GCM (${encryptionLevel === 1000000 ? '1M' : '600K'} iterations)...`);
      const { encrypted, salt, iv, iterations } = await encryptFile(arrayBuffer, password, encryptionLevel);
      setProgress(50);

      setEncryptionStatus('Computing SHA-256 hash...');
      const fileHash = await hashFile(new Uint8Array(encrypted));
      setProgress(70);

      // Step 3: Upload
      setStep(3);
      setEncryptionStatus('Uploading encrypted file...');

      const formData = new FormData();
      const encryptedBlob = new Blob([encrypted], { type: file.type });
      formData.append('file', encryptedBlob, file.name);
      formData.append('salt', salt);
      formData.append('iv', iv);
      formData.append('file_hash', fileHash);
      formData.append('expiry_hours', expiryHours);
      formData.append('iterations', String(iterations));

      await documentsAPI.upload(formData);
      setProgress(100);

      // Step 4: Done
      setStep(4);
      setEncryptionStatus('File encrypted and uploaded successfully!');
      toast.success('Document encrypted and uploaded!');
      logActivity('upload', { filename: file.name, details: `Encrypted with ${iterations.toLocaleString()} PBKDF2 iterations` });

    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.detail || 'Upload failed');
      setStep(1);
      setProgress(0);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPassword('');
    setConfirmPassword('');
    setExpiryHours('none');
    setEncryptionLevel(600000);
    setStep(0);
    setProgress(0);
    setEncryptionStatus('');
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Upload & Encrypt</h1>
          <p className="text-surface-400">
            Your file is encrypted in your browser before upload — zero-knowledge protection.
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-10"
        >
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${
                step > i
                  ? 'bg-accent-emerald text-white'
                  : step === i
                  ? 'bg-brand-500 text-white shadow-glow'
                  : 'bg-white/5 text-surface-500'
              }`}>
                {step > i ? <HiOutlineCheckCircle className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`hidden sm:block ml-2 text-xs font-medium ${
                step >= i ? 'text-surface-200' : 'text-surface-500'
              }`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 transition-colors ${
                  step > i ? 'bg-accent-emerald' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 0: Drag & Drop */}
          {step === 0 && (
            <motion.div
              key="drop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div
                {...getRootProps()}
                className={`glass-card p-16 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
                  isDragActive
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 hover:border-brand-500/50 hover:bg-white/5'
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  animate={isDragActive ? { scale: 1.05, y: -5 } : { scale: 1, y: 0 }}
                >
                  <HiOutlineCloudUpload className={`w-16 h-16 mx-auto mb-4 ${
                    isDragActive ? 'text-brand-400' : 'text-surface-500'
                  }`} />
                  <h3 className="text-xl font-semibold mb-2">
                    {isDragActive ? 'Drop your file here' : 'Drag & drop your file'}
                  </h3>
                  <p className="text-surface-400 mb-4">
                    or click to browse from your computer
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <HiOutlineDocumentText className="w-4 h-4" /> PDF
                    </span>
                    <span className="flex items-center gap-1">
                      <HiOutlinePhotograph className="w-4 h-4" /> JPG / PNG
                    </span>
                    <span>Max 20MB</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Password */}
          {step === 1 && file && (
            <motion.div
              key="password"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card p-8"
            >
              {/* File preview */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 mb-6">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  {file.type === 'application/pdf'
                    ? <HiOutlineDocumentText className="w-6 h-6 text-brand-400" />
                    : <HiOutlinePhotograph className="w-6 h-6 text-brand-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{file.name}</p>
                  <p className="text-xs text-surface-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}
                  </p>
                </div>
                <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/5">
                  <HiOutlineX className="w-5 h-5 text-surface-400" />
                </button>
              </div>

              {/* Password section */}
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                    <HiOutlineKey className="w-4 h-4 text-brand-400" />
                    Encryption Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Strong password to encrypt your file"
                      className="input-field pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                    >
                      {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="input-field"
                  />
                </div>

                {/* Expiration selector */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-3">
                    <HiOutlineClock className="w-4 h-4 text-accent-amber" />
                    File Expiration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPIRY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExpiryHours(opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          expiryHours === opt.value
                            ? 'border-brand-500 bg-brand-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-surface-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[11px] text-surface-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Encryption Strength Selector */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-3">
                    <HiOutlineLightningBolt className="w-4 h-4 text-accent-cyan" />
                    Encryption Strength
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ENCRYPTION_LEVELS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEncryptionLevel(opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          encryptionLevel === opt.value
                            ? 'border-brand-500 bg-brand-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-surface-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.icon} {opt.label}</p>
                        <p className="text-[11px] text-surface-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Security note */}
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-primary) 10%, transparent)' }}>
                  <HiOutlineShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-light)' }} />
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Zero-Knowledge Encryption</p>
                    <p>Your password never leaves your browser. We derive a 256-bit AES key using PBKDF2 ({encryptionLevel === 1000000 ? '1M' : '600K'} iterations) and encrypt the file locally.</p>
                  </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!password || !confirmPassword}
                  className="btn-primary w-full py-3.5 gap-2"
                >
                  <HiOutlineLockClosed className="w-5 h-5" />
                  Encrypt & Upload
                </button>
              </div>
            </motion.div>
          )}

          {/* Steps 2-3: Encrypting / Uploading */}
          {(step === 2 || step === 3) && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card p-12 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 rounded-full border-3 border-brand-500/20 border-t-brand-500 mx-auto mb-6"
              />

              <h3 className="text-xl font-semibold mb-2">
                {step === 2 ? 'Encrypting Your File' : 'Uploading Encrypted File'}
              </h3>
              <p className="text-surface-400 text-sm mb-6">{encryptionStatus}</p>

              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full"
                />
              </div>
              <p className="text-brand-400 text-sm font-medium mt-2">{progress}%</p>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              >
                <HiOutlineCheckCircle className="w-20 h-20 text-accent-emerald mx-auto mb-4" />
              </motion.div>
              <h3 className="text-2xl font-bold mb-2">Successfully Encrypted</h3>
              <p className="text-surface-400 mb-8">
                Your file has been encrypted and securely uploaded to your vault.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button onClick={resetForm} className="btn-secondary">
                  Upload Another
                </button>
                <button onClick={() => router.push('/dashboard')} className="btn-primary">
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
