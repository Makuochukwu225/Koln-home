'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, Cpu, Globe, Activity, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import LoadControl from '@/components/LoadControl';
import SensorChart from '@/components/SensorChart';
import { useDeviceSocket } from '@/hooks/useDeviceSocket';
import { getSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';

const LOAD_TYPES = [
  { value: 'UNASSIGNED', label: 'Unassigned (Disabled)' },
  { value: 'PWM_LED', label: 'PWM Dimmer LED (LEDC)' },
  { value: 'RELAY', label: 'Relay (On / Off)' },
  { value: 'SENSOR_DHT22', label: 'DHT22 Temperature Sensor' },
  { value: 'SENSOR_ANALOG', label: 'Analog Voltage / ADC Sensor' },
];

export default function DeviceDetailPage({ params }: { params: Promise<{ chipId: string }> }) {
  const resolvedParams = use(params);
  const chipId = resolvedParams.chipId;
  const router = useRouter();

  const [device, setDevice] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingPin, setSavingPin] = useState<number | null>(null);
  const [savedPin, setSavedPin] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetStatusMessage, setResetStatusMessage] = useState<string | null>(null);

  const fetchDevice = async () => {
    try {
      const data = await apiFetch(`/api/devices/${chipId}`);
      if (data.success) {
        setDevice(data.device);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTelemetry = async (pin: number) => {
    try {
      const data = await apiFetch(`/api/devices/${chipId}/telemetry?pin=${pin}&limit=30`);
      if (data.success) {
        setTelemetry((prev) => ({ ...prev, [pin]: data.telemetry }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Instant real-time WebSocket state update
  const handleSocketUpdate = useCallback(
    (updatedDevice: any) => {
      if (updatedDevice.chipId === chipId) {
        setDevice(updatedDevice);
      }
    },
    [chipId]
  );

  const { sendCommand } = useDeviceSocket(handleSocketUpdate);

  // Live WebSocket sensor readings listener
  useEffect(() => {
    const socket = getSocket();
    const handleTelemetryNew = (reading: any) => {
      if (reading.deviceChipId === chipId) {
        setTelemetry((prev) => {
          const existing = prev[reading.pin] || [];
          return {
            ...prev,
            [reading.pin]: [...existing.slice(-29), reading],
          };
        });
      }
    };

    socket.on('telemetry:new', handleTelemetryNew);
    return () => {
      socket.off('telemetry:new', handleTelemetryNew);
    };
  }, [chipId]);

  useEffect(() => {
    fetchDevice();
    const interval = setInterval(fetchDevice, 3000); // Background fallback sync
    return () => clearInterval(interval);
  }, [chipId]);

  useEffect(() => {
    if (device?.loads) {
      device.loads.forEach((l: any) => {
        if (l.type === 'SENSOR_DHT22' || l.type === 'SENSOR_ANALOG') {
          fetchTelemetry(l.pin);
        }
      });
    }
  }, [device?.lastSeen]);

  const handleUpdateLoad = async (pin: number, type: string, label: string) => {
    setSavingPin(pin);
    try {
      const data = await apiFetch(`/api/devices/${chipId}/loads/${pin}`, {
        method: 'PATCH',
        body: JSON.stringify({ type, label }),
      });
      if (data.success) {
        setSavedPin(pin);
        setTimeout(() => setSavedPin(null), 2000);
        fetchDevice();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPin(null);
    }
  };

  const handleCommand = async (pin: number, action: 'set' | 'toggle', value?: number) => {
    await sendCommand(chipId, pin, action, value, device?.localIp);
  };

  const handleDeleteDevice = async () => {
    if (!confirm('Are you sure you want to delete this device and all its history?')) return;
    await apiFetch(`/api/devices/${chipId}`, { method: 'DELETE' });
    router.push('/');
  };

  const handleResetDevice = async () => {
    if (
      !confirm(
        'WARNING: Factory resetting this device will erase its saved Wi-Fi credentials and Backend URL. The ESP32 will reboot into Setup Mode (ESP32-Setup-XXXX).\n\nDo you want to proceed?'
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const data = await apiFetch(`/api/devices/${chipId}/reset`, { method: 'POST' });
      if (data.success) {
        setResetStatusMessage(
          'Factory reset command sent! The device is clearing flash memory and rebooting into Captive Portal mode (ESP32-Setup-XXXX).'
        );
      } else {
        alert(data.error || 'Failed to dispatch reset command');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing reset request');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !device) {
    return <div className="py-20 text-center text-gray-500">Loading device configuration...</div>;
  }

  const isOnline = Date.now() - new Date(device.lastSeen).getTime() < 45000;
  const configuredLoads = (device.loads || []).filter((l: any) => l.type !== 'UNASSIGNED');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      {/* Header Info */}
      <div className="bg-surface p-6 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surfaceHover rounded-xl border border-border">
            <Cpu className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{device.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Chip ID: {device.chipId} • FW: v{device.firmwareVersion} • IP: {device.localIp || 'Unknown'}
            </p>
          </div>
        </div>

        {device.localIp && (
          <a
            href={`http://${device.localIp}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 bg-surfaceHover border border-border rounded-xl text-xs font-semibold text-gray-200 hover:bg-gray-700 transition"
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Direct LAN Interface</span>
          </a>
        )}
      </div>

      {/* Live Interactive Controls */}
      {configuredLoads.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Live Load Controls</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </section>
      )}

      {/* Telemetry Charts for Configured Sensors */}
      {configuredLoads.some((l: any) => l.type === 'SENSOR_DHT22' || l.type === 'SENSOR_ANALOG') && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">Sensor Telemetry History</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {configuredLoads
              .filter((l: any) => l.type === 'SENSOR_DHT22' || l.type === 'SENSOR_ANALOG')
              .map((sensor: any) => (
                <div key={sensor.pin} className="bg-surface p-4 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-gray-200">{sensor.label || `GPIO ${sensor.pin}`}</h3>
                    <span className="text-xs text-gray-400 font-mono uppercase">{sensor.type}</span>
                  </div>
                  <SensorChart
                    data={telemetry[sensor.pin] || []}
                    unit={sensor.type === 'SENSOR_DHT22' ? '°C' : '%'}
                    color={sensor.type === 'SENSOR_DHT22' ? '#f43f5e' : '#38bdf8'}
                  />
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Pin Assignment & Configuration Matrix */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white">GPIO Pin Allocation Matrix</h2>
          <p className="text-xs text-gray-400 mt-1">
            Assign hardware capabilities (PWM Dimmer, Relay Switch, or Sensor) dynamically to each physical pin.
          </p>
        </div>

        <div className="divide-y divide-border/60">
          {(device.loads || []).map((load: any) => (
            <PinConfigRow
              key={load.pin}
              load={load}
              isSaving={savingPin === load.pin}
              isSaved={savedPin === load.pin}
              onSave={(type, label) => handleUpdateLoad(load.pin, type, label)}
            />
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <div className="p-6 bg-rose-500/5 rounded-2xl border border-rose-500/20 space-y-4">
        {resetStatusMessage && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{resetStatusMessage}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-amber-400">Reconfigure / Remote Factory Reset</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Wipe Wi-Fi credentials & Backend URL from ESP32 flash memory and reboot into Setup Mode (<code className="text-amber-300">ESP32-Setup-XXXX</code>).
            </p>
          </div>
          <button
            onClick={handleResetDevice}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-semibold transition shrink-0"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetting ? 'Resetting...' : 'Reset & Re-provision'}</span>
          </button>
        </div>

        <hr className="border-rose-500/20" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-rose-400">Remove Device</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Delete this device record and purge all historic telemetry from the database.
            </p>
          </div>
          <button
            onClick={handleDeleteDevice}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded-xl text-xs font-semibold transition shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Device</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PinConfigRow({
  load,
  isSaving,
  isSaved,
  onSave,
}: {
  load: any;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (type: string, label: string) => void;
}) {
  const [type, setType] = useState(load.type);
  const [label, setLabel] = useState(load.label);
  const isDirty = type !== load.type || label !== load.label;

  return (
    <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-[120px]">
        <span className="w-8 h-8 rounded-lg bg-surfaceHover border border-border flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
          {load.pin}
        </span>
        <span className="text-sm font-medium text-gray-300">GPIO {load.pin}</span>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
        >
          {LOAD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={label}
          placeholder="Friendly Label (e.g. Ceiling Lamp)"
          onChange={(e) => setLabel(e.target.value)}
          className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave(type, label)}
          disabled={!isDirty || isSaving}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            isSaved
              ? 'bg-emerald-500 text-white'
              : isDirty
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-surfaceHover text-gray-500 cursor-not-allowed border border-border'
          }`}
        >
          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Apply'}</span>
        </button>
      </div>
    </div>
  );
}
