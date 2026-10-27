'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';

/**
 * ============================================================================
 * CLIENT CONTEXT PROVIDERS WRAPPER (components/Providers.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Creates a Client Component boundary (`'use client'`) to wrap React context providers.
 * - Injects NextAuth's `SessionProvider` into the React component tree.
 * 
 * WHY IS THIS A SEPARATE FILE? (INTERVIEW CONCEPT):
 * In Next.js App Router, `layout.tsx` is a Server Component by default. Server Components
 * cannot use React Context (`createContext`) directly. By isolating `SessionProvider`
 * inside a dedicated Client Component (`Providers.tsx`), the root layout remains a Server
 * Component while allowing deep child components (like `useSession()`) to access user sessions.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

