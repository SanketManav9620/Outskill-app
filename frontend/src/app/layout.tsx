import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

/**
 * ============================================================================
 * ROOT HTML LAYOUT COMPONENT (app/layout.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Serves as the top-level shell for all pages in the Next.js App Router application.
 * - Injects SEO metadata tags into the HTML `<head>`.
 * - Imports global Tailwind CSS styles.
 * - Wraps child page hierarchies inside client-side context providers (`Providers`).
 * 
 * CONTROL FLOW:
 * Every route in Next.js (e.g. `/`, `/login`, `/dashboard`) renders inside this
 * RootLayout component. The `{children}` prop is replaced by the matching `page.tsx`.
 */

export const metadata: Metadata = {
  title: 'Outskill Monorepo Portal',
  description: 'Next.js 14 App Router + NextAuth + Tailwind CSS Frontend connected to Express TS Backend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        {/* NextAuth SessionProvider context wrapper */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

