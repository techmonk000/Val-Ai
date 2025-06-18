import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Val AI',
  description: 'Val AI Admin Panel - System Administration',
  robots: 'noindex, nofollow', // Admin pages should not be indexed
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 