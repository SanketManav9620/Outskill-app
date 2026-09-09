import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Outskill Monorepo Portal',
  description: 'Next.js 14 App Router + NextAuth + Tailwind CSS Frontend connected to Express TS Backend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
