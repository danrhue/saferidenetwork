'use client';

import { useRouter } from 'next/navigation';

interface AdminNavProps {
  title?: string;
  subtitle?: string;
  current?: string;
}

export default function AdminNav({ title = 'Admin Dashboard', subtitle = 'Platform administration and oversight', current = 'dashboard' }: AdminNavProps) {
  const router = useRouter();

  const navButtons = [
    { label: 'Dashboard', path: '/admin', key: 'dashboard' },
    { label: 'Active Trips (Live)', path: '/admin/active-trips', key: 'active-trips' },
    { label: 'Document Review', path: '/admin/documents', key: 'documents' },
    { label: 'Seating Review', path: '/admin/seating-approvals', key: 'seating-approvals' },
    { label: 'Manage Updates', path: '/admin/updates', key: 'updates' },
    { label: 'Pricing Config', path: '/admin/pricing', key: 'pricing' },
    { label: 'Exit Admin', path: '/dashboard', key: 'exit' },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-blue-950">{title}</h1>
        <p className="text-blue-800">{subtitle}</p>
      </div>

      <div className="flex gap-2 flex-wrap text-sm">
        {navButtons.map((btn, idx) => {
          const isCurrent = btn.key === current || (current === 'dashboard' && btn.key === 'dashboard');
          const isExit = btn.key === 'exit';
          return (
            <button
              key={idx}
              onClick={() => router.push(btn.path)}
              className={`px-4 py-1.5 rounded-2xl text-sm font-medium transition ${
                isCurrent 
                  ? 'bg-[#1E3A8A] text-white shadow-sm' 
                  : isExit 
                    ? 'border border-blue-200 hover:bg-blue-50 text-blue-800' 
                    : 'border border-blue-200 hover:bg-blue-50 text-blue-800'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
