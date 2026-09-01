'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu, Settings, Wifi, WifiOff } from 'lucide-react';
import LoadControl from './LoadControl';
import { useDeviceSocket } from '@/hooks/useDeviceSocket';

interface DeviceCardProps {
  device: any;
  onRefresh: () => void;
}

export default function DeviceCard({ device, onRefresh }: DeviceCardProps) {
  const { sendCommand } = useDeviceSocket();

  // Device is considered online if seen in the last 45 seconds
  const isOnline = Date.now() - new Date(device.lastSeen).getTime() < 45000;

  const handleCommand = async (pin: number, action: 'set' | 'toggle', value?: number) => {
    try {
      await sendCommand(device.chipId, pin, action, value, device.localIp);
    } catch (err) {
      console.error('Command dispatch error:', err);
    }
  };

  const configuredLoads = (device.loads || []).filter((l: any) => l.type !== 'UNASSIGNED');

  return (
    <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-lg transition-all hover:border-gray-600">
      {/* Header */}
      <div className="p-5 border-b border-border/60 flex items-center justify-between bg-surface/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-surfaceHover rounded-xl border border-border">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-100 text-base">{device.name}</h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              ID: {device.chipId} • IP: {device.localIp || 'N/A'}
            </p>
          </div>
        </div>

        <Link
          href={`/devices/${device.chipId}`}
          className="p-2 rounded-lg bg-surfaceHover text-gray-300 hover:text-white border border-border hover:bg-gray-700 transition"
          title="Configure GPIO Pin Allocations"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>

      {/* Body: Configured Loads */}
      <div className="p-5">
        {configuredLoads.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl">
            <p className="text-xs text-gray-400">No GPIO loads assigned to this device yet.</p>
            <Link
              href={`/devices/${device.chipId}`}
              className="mt-2 inline-block text-xs font-semibold text-cyan-400 hover:underline"
            >
              Configure Pins &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {configuredLoads.map((load: any) => (
              <LoadControl
                key={load.pin}
                chipId={device.chipId}
                localIp={device.localIp}
                pin={load.pin}
                type={load.type}
                label={load.label}
                initialState={load.state}
                onCommand={handleCommand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
