import { AuthProvider } from '@/app/app/providers/auth-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
