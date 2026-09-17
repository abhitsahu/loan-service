import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loan Repayment Service',
  description: 'Manage loan repayment schedules, track payments, and monitor loan position.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
