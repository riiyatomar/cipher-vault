'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isDemoMode } from '@/lib/api';
import ThemeSelector from '@/components/ThemeSelector';
import { useState, useEffect } from 'react';
import {
  HiOutlineShieldCheck, HiOutlineHome, HiOutlineCloudUpload,
  HiOutlineCollection, HiOutlineLogout, HiOutlineMenu, HiOutlineX,
  HiOutlineLogin, HiOutlineClipboardList, HiOutlineCog
} from 'react-icons/hi';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: HiOutlineCollection, auth: true },
  { href: '/upload', label: 'Upload', icon: HiOutlineCloudUpload, auth: true },
  { href: '/activity', label: 'Activity', icon: HiOutlineClipboardList, auth: true },
  { href: '/settings', label: 'Settings', icon: HiOutlineCog, auth: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => { setDemo(isDemoMode()); }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card"
      style={{ borderBottom: '1px solid var(--border-primary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-accent-cyan group-hover:shadow-glow transition-shadow">
              <HiOutlineShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Cipher<span style={{ color: 'var(--brand-primary)' }}>Vault</span>
            </span>
            {demo && (
              <span className="px-2 py-0.5 rounded-md bg-accent-amber/20 text-accent-amber text-[10px] font-bold uppercase tracking-wider">
                Demo
              </span>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.filter(item => !item.auth || isAuthenticated).map(item => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--brand-primary) 15%, transparent)' : 'transparent',
                    color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <ThemeSelector />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)' }}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center text-xs font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.username}</span>
                </div>
                <button onClick={logout} className="p-2 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-accent-rose/10 transition-colors">
                  <HiOutlineLogout className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-2">
                <HiOutlineLogin className="w-4 h-4 mr-2" />
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-surface-300 hover:bg-white/5"
          >
            {mobileOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {NAV_ITEMS.filter(item => !item.auth || isAuthenticated).map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-surface-300 hover:bg-white/5"
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              {isAuthenticated ? (
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-accent-rose hover:bg-accent-rose/10 w-full"
                >
                  <HiOutlineLogout className="w-5 h-5" />
                  Sign Out
                </button>
              ) : (
                <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-center text-sm">
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
