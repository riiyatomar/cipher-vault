'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineCloudUpload,
  HiOutlineClock, HiOutlineFingerPrint, HiOutlineEye,
  HiOutlineKey, HiOutlineDocumentText, HiOutlineChartBar,
  HiOutlineArrowRight
} from 'react-icons/hi';

const features = [
  {
    icon: HiOutlineLockClosed,
    title: 'Zero-Knowledge Encryption',
    desc: 'Files are encrypted in your browser using AES-256-GCM before upload. We never see your data.',
    color: 'from-brand-500 to-brand-700',
  },
  {
    icon: HiOutlineFingerPrint,
    title: 'Password Protected',
    desc: 'Each file is locked with your password. PBKDF2 derives encryption keys with 600K iterations.',
    color: 'from-accent-cyan to-blue-700',
  },
  {
    icon: HiOutlineClock,
    title: 'Auto-Expiration',
    desc: 'Files automatically expire and are permanently deleted after 24 hours. No data lingers.',
    color: 'from-accent-emerald to-green-700',
  },
  {
    icon: HiOutlineEye,
    title: 'Tamper Detection',
    desc: 'SHA-256 hashes verify file integrity on every download. Any manipulation is detected instantly.',
    color: 'from-accent-amber to-orange-700',
  },
  {
    icon: HiOutlineKey,
    title: 'Envelope Encryption',
    desc: 'Per-file keys encrypted with a master key. Shamir Secret Sharing splits keys for secure recovery.',
    color: 'from-purple-500 to-purple-700',
  },
  {
    icon: HiOutlineDocumentText,
    title: 'PDF Protection',
    desc: 'PDF files get additional protection — printing, copying, and editing are disabled.',
    color: 'from-accent-rose to-rose-700',
  },
];

const stats = [
  { label: 'Encryption Standard', value: 'AES-256' },
  { label: 'Key Derivation', value: 'PBKDF2' },
  { label: 'Hash Algorithm', value: 'SHA-256' },
  { label: 'Architecture', value: 'Microservices' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }),
};

export default function LandingPage() {
  return (
    <div className="bg-grid min-h-screen">
      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-hero-glow opacity-60 pointer-events-none" />
        <div className="absolute top-40 right-20 w-72 h-72 bg-accent-cyan/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-60 left-20 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-8"
            >
              <HiOutlineShieldCheck className="w-4 h-4" />
              Enterprise-Grade Security
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-6">
              Protect Your Files with
              <br />
              <span className="gradient-text">Zero-Knowledge</span>
              <br />
              Encryption
            </h1>

            <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload PDFs and images, encrypt them in your browser, and share securely.
              Your files are protected with military-grade AES-256 encryption —
              <span className="text-surface-200 font-medium"> we never see your data</span>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="btn-primary text-lg px-8 py-4 gap-2">
                Get Started Free
                <HiOutlineArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/login" className="btn-secondary text-lg px-8 py-4">
                Sign In
              </Link>
            </div>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 max-w-3xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center px-4 py-3 glass-card">
                <div className="text-xl font-bold text-brand-400">{stat.value}</div>
                <div className="text-xs text-surface-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Security Without Compromise
          </h2>
          <p className="text-surface-400 max-w-xl mx-auto">
            Every layer of CipherVault is designed to protect your most sensitive documents.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="glass-card-hover p-6 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-surface-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-surface-400">Three simple steps to secure your documents.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Upload & Set Password', desc: 'Select your PDF or image file and choose a strong password.', icon: HiOutlineCloudUpload },
            { step: '02', title: 'Browser Encrypts', desc: 'Your file is encrypted with AES-256-GCM in your browser before uploading.', icon: HiOutlineLockClosed },
            { step: '03', title: 'Access Securely', desc: 'Only you can decrypt with your password. Files auto-expire in 24 hours.', icon: HiOutlineShieldCheck },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="relative text-center"
              >
                <div className="text-7xl font-black text-brand-500/10 absolute -top-4 left-1/2 -translate-x-1/2">
                  {item.step}
                </div>
                <div className="relative z-10 pt-8">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-surface-400 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-card p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-accent-cyan/10 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Secure Your Documents?
            </h2>
            <p className="text-surface-400 max-w-lg mx-auto mb-8">
              Start protecting your sensitive files today. Free, fast, and truly private.
            </p>
            <Link href="/register" className="btn-primary text-lg px-10 py-4 gap-2">
              Start Encrypting
              <HiOutlineArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HiOutlineShieldCheck className="w-5 h-5 text-brand-400" />
            <span className="text-sm text-surface-400">CipherVault — Zero-Knowledge Document Protection</span>
          </div>
          <div className="text-sm text-surface-500">
            Built with AES-256-GCM • PBKDF2 • SHA-256
          </div>
        </div>
      </footer>
    </div>
  );
}
