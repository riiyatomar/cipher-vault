import './globals.css';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'CipherVault — Secure Document Protection',
  description: 'Upload, encrypt, and securely share PDF and image files with zero-knowledge encryption. Your files are encrypted in the browser — we never see your data.',
  keywords: 'secure documents, file encryption, zero knowledge, AES-256, PDF protection',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <Providers>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
