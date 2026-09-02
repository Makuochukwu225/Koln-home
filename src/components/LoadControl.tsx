'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, Power, Gauge, Activity } from 'lucide-react';

interface LoadControlProps {
  chipId: string;
  localIp?: string;
  pin: number;
  type: string;
  label: string;
  initialState: number;
  onCommand: (pin: number, action: 'set' | 'toggle', value?: number) => Promise<void>;
}

export default function LoadControl({
  pin,
  type,
  label,
  initialState,
  onCommand,
}: LoadControlProps) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const isInteractingRef = useRef(false);

  // Sync state whenever external device updates MongoDB (unless currently interacting)
  useEffect(() => {
    if (!isInteractingRef.current) {
      setState(initialState);
    }
  }, [initialState]);

  if (type === 'UNASSIGNED') return null;

  const handleToggle = async () => {
    if (loading) return;
    const next = state > 0.5 ? 0 : 1;
    isInteractingRef.current = true;
    setState(next); // Immediate optimistic UI update
    setLoading(true);

    try {
      // Send explicit idempotent 'set' with 1 or 0 to eliminate toggle race conditions
      await onCommand(pin, 'set', next);
    } finally {
      setTimeout(() => {
        isInteractingRef.current = false;
        setLoading(false);
      }, 300);
    }
  };

  const lastSliderSentRef = useRef<number>(0);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isInteractingRef.current = true;
    const val = Number(e.target.value);
    setState(val);

    const now = Date.now();
    if (now - lastSliderSentRef.current > 50) {
      lastSliderSentRef.current = now;
      onCommand(pin, 'set', val);
    }
  };

  const handleSliderCommit = async () => {
    await onCommand(pin, 'set', state);
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 300);
  };

  return (
    <div className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col justify-between gap-3 shadow-sm hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-surfaceHover border border-border">
            {type === 'RELAY' && <Power className={`w-4 h-4 ${state > 0.5 ? 'text-emerald-400' : 'text-gray-500'}`} />}
            {type === 'PWM_LED' && <Lightbulb className={`w-4 h-4 ${state > 0 ? 'text-amber-400' : 'text-gray-500'}`} />}
            {type === 'SENSOR_ANALOG' && <Gauge className="w-4 h-4 text-cyan-400" />}
            {type === 'SENSOR_DHT22' && <Activity className="w-4 h-4 text-rose-400" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-200">{label || `Pin ${pin}`}</h4>
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">{type} • GPIO {pin}</span>
          </div>
        </div>

        {type === 'RELAY' && (
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              state > 0.5
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-900/40'
                : 'bg-surfaceHover text-gray-400 border border-border hover:bg-gray-800'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${loading ? 'animate-spin opacity-50' : ''}`} />
            <span>{state > 0.5 ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      {type === 'PWM_LED' && (
        <div className="space-y-1 mt-1">
          <div className="flex justify-between text-xs text-gray-400 font-mono">
            <span>Brightness</span>
            <span>{Math.round((state / 255) * 100)}% ({Math.round(state)})</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={state}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            className="w-full cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {(type === 'SENSOR_ANALOG' || type === 'SENSOR_DHT22') && (
        <div className="mt-1 flex items-baseline justify-between bg-background/40 px-3 py-2 rounded-lg border border-border/50 font-mono">
          <span className="text-xs text-gray-400">Live Reading</span>
          <span className="text-base font-bold text-cyan-400">
            {state.toFixed(1)} {type === 'SENSOR_DHT22' ? '°C' : '%'}
          </span>
        </div>
      )}
    </div>
  );
}
