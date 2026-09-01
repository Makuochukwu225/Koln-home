'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu, RefreshCw, Zap, Search } from 'lucide-react';
import DeviceCard from '@/components/DeviceCard';

export default function DashboardPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.chipId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">System Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your provisioned ESP32 boards, relays, dimmers, and sensors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDevices}
            className="p-2.5 rounded-xl bg-surface border border-border text-gray-300 hover:text-white hover:bg-surfaceHover transition"
            title="Refresh Devices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            href="/flash"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-lg shadow-cyan-900/30 transition"
          >
            <Zap className="w-4 h-4" />
            <span>Flash New Device</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Filter devices by name or Chip ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Device Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-surface/50 rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-16 bg-surface/40 rounded-2xl border border-dashed border-border">
          <Cpu className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-300">No Devices Found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1 mb-5">
            You have not registered any ESP32 devices yet. Connect a board via USB to flash it now.
          </p>
          <Link
            href="/flash"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 transition"
          >
            <Zap className="w-4 h-4" />
            <span>Flash ESP32</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDevices.map((device) => (
            <DeviceCard key={device.chipId} device={device} onRefresh={fetchDevices} />
          ))}
        </div>
      )}
    </div>
  );
}
