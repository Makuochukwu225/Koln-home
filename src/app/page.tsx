'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Power,
  Activity,
  Clock,
  Cpu,
  Server,
  Zap,
  RotateCw,
  Sliders,
  SunMedium
} from 'lucide-react';

interface WebSocketMessage {
  type?: string;
  action?: string;
  count?: number;
  pin4?: boolean;
  slider?: number;
  lastUpdated?: string;
  source?: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [backendUrl, setBackendUrl] = useState('ws://localhost:5000');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Independent States
  const [count, setCount] = useState<number | null>(null);
  const [pin4State, setPin4State] = useState<boolean>(false);
  const [sliderValue, setSliderValue] = useState<number>(50);

  // Telemetry metadata
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const [ticksReceived, setTicksReceived] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Rate-limiting throttle for slider socket emission
  const lastSliderSendRef = useRef<number>(0);

  // Mark client mounted to prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backend_socket_url');
      if (saved) {
        setBackendUrl(saved);
      } else {
        const host = window.location.hostname || 'localhost';
        setBackendUrl(`ws://${host}:5000`);
      }
    }
  }, []);

  const connectToBackend = useCallback((urlToConnect = backendUrl) => {
    if (!urlToConnect) return;

    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.close();
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setIsConnecting(true);

    try {
      const ws = new WebSocket(urlToConnect);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('backend_socket_url', urlToConnect);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          // CHANNEL 1: Counter Stream (Strictly touches 'count' ONLY)
          if (data.type === 'count_stream' || (typeof data.count === 'number' && typeof data.slider !== 'number')) {
            if (typeof data.count === 'number') {
              setCount(data.count);
              setLastReceived(new Date().toLocaleTimeString());
              setTicksReceived((prev) => prev + 1);

              setIsPulsing(true);
              if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
              pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 250);
            }
          }

          // CHANNEL 2: Slider Value (Strictly touches 'sliderValue' ONLY)
          if (data.type === 'slider_control' || (typeof data.slider === 'number' && data.type !== 'count_stream')) {
            if (typeof data.slider === 'number') {
              setSliderValue(data.slider);
            }
          }

          // CHANNEL 3: Pin 4 State (Strictly touches 'pin4State' ONLY)
          if (data.type === 'pin4_control' || typeof data.pin4 === 'boolean') {
            if (typeof data.pin4 === 'boolean') {
              setPin4State(data.pin4);
            }
          }

          // Initial connection sync
          if (data.type === 'init') {
            if (typeof data.count === 'number') setCount(data.count);
            if (typeof data.pin4 === 'boolean') setPin4State(data.pin4);
            if (typeof data.slider === 'number') setSliderValue(data.slider);
          }
        } catch {
          const num = Number(event.data);
          if (!isNaN(num)) {
            setCount(num);
            setLastReceived(new Date().toLocaleTimeString());
            setTicksReceived((prev) => prev + 1);
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        reconnectTimerRef.current = setTimeout(() => {
          connectToBackend(urlToConnect);
        }, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch {
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (mounted) {
      connectToBackend(backendUrl);
    }
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, [mounted, backendUrl, connectToBackend]);

  // Pin 4 Switch Control (sends ONLY 'pin4')
  const setPin4 = (targetState: boolean) => {
    if (!isConnected || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    setPin4State(targetState);

    socketRef.current.send(
      JSON.stringify({
        action: 'setPin4',
        pin4: targetState,
      })
    );
  };

  const togglePin4 = () => {
    setPin4(!pin4State);
  };

  // Slider PWM Dimming Control (sends ONLY 'slider')
  const handleSliderChange = (newVal: number, isFinal = false) => {
    setSliderValue(newVal);

    if (newVal > 0 && !pin4State) {
      setPin4(true);
    }

    if (!isConnected || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    if (isFinal || now - lastSliderSendRef.current >= 60) {
      lastSliderSendRef.current = now;
      socketRef.current.send(
        JSON.stringify({
          action: 'setSlider',
          slider: newVal,
        })
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans antialiased select-none">
      <div className="max-w-xl w-full space-y-5">

        {/* Top Header Card */}
        <header className="bg-slate-900/90 border border-slate-800/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
              <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">ESP32 WebSocket Pivot</h1>
              <p className="text-xs text-slate-400">Independent Channels: Counter, Switch &amp; Slider</p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isConnecting
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                    : isConnecting
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              {isConnected ? 'Live Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </div>

            {mounted && !isConnected && (
              <button
                type="button"
                onClick={() => connectToBackend(backendUrl)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg border border-slate-700 transition-all cursor-pointer"
                title="Retry connection"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* PIN 4 OUTPUT SWITCH CARD */}
        <section
          className={`border rounded-3xl p-5 sm:p-6 shadow-2xl transition-all duration-300 relative overflow-hidden ${
            pin4State
              ? 'bg-gradient-to-b from-slate-900 via-amber-950/20 to-slate-900 border-amber-500/40 shadow-amber-500/10'
              : 'bg-slate-900/90 border-slate-800/80 shadow-black/40'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-2xl border transition-all duration-300 ${
                  pin4State
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/30 scale-105'
                    : 'bg-slate-800 border-slate-700 text-slate-500 scale-100'
                }`}
              >
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Pin 4 LED Switch</h2>
                  <span
                    className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full border transition-all duration-200 ${
                      pin4State
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    GPIO 4: {pin4State ? `ON (${sliderValue}%)` : 'OFF (0%)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct digital output toggle
                </p>
              </div>
            </div>

            {/* Smooth iOS-style Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={pin4State}
              onClick={togglePin4}
              className={`relative inline-flex h-10 w-20 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none active:scale-95 ${
                !isConnected ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                pin4State ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-slate-800 border-slate-700'
              }`}
            >
              <span className="sr-only">Toggle Pin 4</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-flex h-8 w-8 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-out ${
                  pin4State ? 'translate-x-10 text-amber-600' : 'translate-x-1 text-slate-400'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex gap-2.5">
            <button
              type="button"
              onClick={() => setPin4(true)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 border cursor-pointer ${
                !isConnected ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                pin4State
                  ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              Turn ON
            </button>
            <button
              type="button"
              onClick={() => setPin4(false)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 border cursor-pointer ${
                !isConnected ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                !pin4State
                  ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800'
              }`}
            >
              Turn OFF
            </button>
          </div>
        </section>

        {/* PIN 4 PWM BRIGHTNESS SLIDER CARD */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Pin 4 LED Brightness</h3>
                <p className="text-xs text-slate-400">PWM Output Level (0 - 100%)</p>
              </div>
            </div>

            {/* Value Badge */}
            <div className="flex items-baseline gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl">
              <SunMedium className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-lg font-black text-white font-mono">{sliderValue}%</span>
              <span className="text-[10px] text-slate-500 font-mono">({Math.round((sliderValue / 100) * 255)}/255)</span>
            </div>
          </div>

          {/* Range Slider Track */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                onMouseUp={() => handleSliderChange(sliderValue, true)}
                onTouchEnd={() => handleSliderChange(sliderValue, true)}
                className={`w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none ${
                  !isConnected ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Presets */}
            <div className="flex justify-between gap-2 pt-1">
              {[0, 25, 50, 75, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSliderChange(val, true)}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold font-mono border transition-all active:scale-95 cursor-pointer ${
                    !isConnected ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    sliderValue === val
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm shadow-amber-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* UNINTERRUPTED LIVE COUNTER CARD */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
          <div
            className={`absolute inset-0 bg-sky-500/10 blur-3xl transition-opacity duration-300 pointer-events-none ${
              isPulsing ? 'opacity-90' : 'opacity-20'
            }`}
          />

          <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20">
            Real-Time Hardware Stream
          </span>

          <div className="my-5">
            <span
              className={`text-7xl sm:text-8xl font-black tracking-tight text-white transition-all duration-150 inline-block ${
                isPulsing ? 'scale-105 text-sky-300 drop-shadow-[0_0_25px_rgba(56,189,248,0.4)]' : 'scale-100'
              }`}
            >
              {count !== null ? count : '--'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            {count !== null
              ? 'Continuously emitted every 1s by ESP32 without interruption'
              : 'Waiting for ESP32 hardware to emit number count...'}
          </p>
        </section>

        {/* Telemetry Stats Grid */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium mb-0.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Source
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-200">ESP32</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium mb-0.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Total Ticks
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-200">{ticksReceived}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium mb-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Last Tick
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-200">{lastReceived || 'None'}</p>
          </div>
        </section>

        {/* Backend Socket Endpoint Bar */}
        <section className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl flex items-center gap-3">
          <Server className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="ws://localhost:5000"
            className="flex-1 bg-transparent border-none text-xs text-slate-300 placeholder-slate-600 focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => connectToBackend(backendUrl)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Connect
          </button>
        </section>

      </div>
    </main>
  );
}
