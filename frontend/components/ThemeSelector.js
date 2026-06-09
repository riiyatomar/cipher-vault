'use client';

/**
 * CipherVault — Theme Selector
 * Dropdown with visual theme previews.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { HiOutlineColorSwatch } from 'react-icons/hi';

export default function ThemeSelector() {
  const { themeName, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)' }}
        title="Change Theme"
      >
        <HiOutlineColorSwatch className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-64 rounded-2xl shadow-2xl z-50 overflow-hidden"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <div className="p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Choose Theme
              </p>
            </div>
            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => { setTheme(key); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                  style={{
                    background: themeName === key ? 'var(--bg-card-hover)' : 'transparent',
                    border: themeName === key ? '1px solid var(--border-hover)' : '1px solid transparent',
                  }}
                >
                  {/* Color preview dots */}
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: theme.colors['--bg-primary'] }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: theme.colors['--brand-primary'] }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: theme.colors['--text-primary'] }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {theme.emoji} {theme.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {theme.desc}
                    </p>
                  </div>
                  {themeName === key && (
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
