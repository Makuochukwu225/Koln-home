'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu, LayoutDashboard, Zap, Radio } from 'lucide-react';
import { useDeviceSocket } from '@/hooks/useDeviceSocket';

export default function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useDeviceSocket();

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Flash Device', href: '/flash', icon: Zap },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 text-cyan-400 font-bold text-lg tracking-wide">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <span>Koln <span className="text-white">Home</span></span>
          </Link>

          {/* Real-time WebSocket indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
            title={isConnected ? 'Connected to Node.js WebSocket backend' : 'Connecting to WebSocket...'}
          >
            <Radio className={`w-3 h-3 ${isConnected ? 'animate-pulse' : ''}`} />
            <span>{isConnected ? 'Live WebSocket Sync' : 'Polling Fallback'}</span>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surfaceHover'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
