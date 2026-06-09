'use client';

/**
 * CipherVault — 2FA Settings Page
 * Setup/disable TOTP two-factor authentication.
 * Uses Web Crypto API for HMAC-SHA1 TOTP generation.
 */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  HiOutlineShieldCheck, HiOutlineKey, HiOutlineLockClosed,
  HiOutlineCheckCircle, HiOutlineExclamation
} from 'react-icons/hi';

const TOTP_KEY = 'cv_totp_setup';

// Generate a random base32 secret
function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const values = crypto.getRandomValues(new Uint8Array(20));
  for (let i = 0; i < 20; i++) {
    secret += chars[values[i] % 32];
  }
  return secret;
}

// Generate TOTP code from secret
async function generateTOTP(secret) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  
  // Decode base32
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.toUpperCase()) {
    const val = base32chars.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const keyBytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }

  // Counter to bytes (big-endian 8 bytes)
  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, counterBytes);
  const hmac = new Uint8Array(sig);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

export default function SettingsPage() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [step, setStep] = useState(0); // 0=overview, 1=setup, 2=verify
  const [currentCode, setCurrentCode] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const saved = localStorage.getItem(TOTP_KEY);
    if (saved) {
      const { enabled, secret: s } = JSON.parse(saved);
      setIs2FAEnabled(enabled);
      setSecret(s);
    }
  }, []);

  // Update current TOTP code every second
  useEffect(() => {
    if (!secret) return;
    const update = async () => {
      const code = await generateTOTP(secret);
      setCurrentCode(code);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  const startSetup = () => {
    const newSecret = generateSecret();
    setSecret(newSecret);
    setStep(1);
  };

  const verifyAndEnable = async () => {
    const expected = await generateTOTP(secret);
    if (verifyCode === expected) {
      localStorage.setItem(TOTP_KEY, JSON.stringify({ enabled: true, secret }));
      setIs2FAEnabled(true);
      setStep(0);
      toast.success('Two-Factor Authentication enabled!');
    } else {
      toast.error('Invalid code. Please try again.');
    }
  };

  const disable2FA = () => {
    localStorage.setItem(TOTP_KEY, JSON.stringify({ enabled: false, secret: '' }));
    setIs2FAEnabled(false);
    setSecret('');
    setStep(0);
    toast.success('2FA disabled');
  };

  const otpAuthUri = `otpauth://totp/CipherVault:${user?.email || 'user'}?secret=${secret}&issuer=CipherVault&digits=6&period=30`;

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
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Security Settings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your account security preferences</p>
        </motion.div>

        {/* 2FA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
              <HiOutlineShieldCheck className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Two-Factor Authentication</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add TOTP-based 2FA for extra login security</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              is2FAEnabled ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-accent-rose/20 text-accent-rose'
            }`}>
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {step === 0 && (
            <div>
              {is2FAEnabled ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <HiOutlineCheckCircle className="w-4 h-4 inline mr-2 text-accent-emerald" />
                      Your account is protected with two-factor authentication.
                    </p>
                    {currentCode && (
                      <p className="mt-2 text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--brand-primary)' }}>
                        {currentCode.slice(0, 3)} {currentCode.slice(3)}
                      </p>
                    )}
                  </div>
                  <button onClick={disable2FA} className="btn-secondary text-sm text-accent-rose">
                    Disable 2FA
                  </button>
                </div>
              ) : (
                <button onClick={startSetup} className="btn-primary gap-2">
                  <HiOutlineKey className="w-4 h-4" />
                  Set Up 2FA
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="inline-block p-4 rounded-xl bg-white">
                  <QRCodeSVG value={otpAuthUri} size={180} level="M" fgColor="#1e1b4b" />
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Manual entry key:</p>
                <p className="font-mono text-sm tracking-wider break-all" style={{ color: 'var(--brand-light)' }}>{secret}</p>
              </div>

              <button onClick={() => setStep(2)} className="btn-primary w-full py-3">
                I've scanned the code — Verify
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Enter the 6-digit code from your authenticator app to complete setup.
              </p>
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && verifyAndEnable()}
                  placeholder="000000"
                  className="input-field text-center text-2xl font-mono tracking-[0.5em] max-w-[200px]"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-2.5 text-sm">
                  Back
                </button>
                <button
                  onClick={verifyAndEnable}
                  disabled={verifyCode.length !== 6}
                  className="btn-primary flex-1 py-2.5 text-sm gap-1"
                >
                  <HiOutlineLockClosed className="w-4 h-4" />
                  Enable 2FA
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
