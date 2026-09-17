import { redirect } from 'next/navigation';

/**
 * Root page — redirects to the app shell.
 * AuthGate inside /app handles unauthenticated users.
 */
export default function RootPage() {
  redirect('/app');
}
