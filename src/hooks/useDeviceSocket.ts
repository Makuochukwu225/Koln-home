'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

export function useDeviceSocket(onDeviceUpdate?: (device: any) => void) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    if (onDeviceUpdate) {
      socket.on('device:updated', onDeviceUpdate);
      socket.on('device:registered', onDeviceUpdate);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (onDeviceUpdate) {
        socket.off('device:updated', onDeviceUpdate);
        socket.off('device:registered', onDeviceUpdate);
      }
    };
  }, [onDeviceUpdate]);

  const sendCommand = useCallback(
    async (chipId: string, pin: number, action: 'set' | 'toggle', value?: number, localIp?: string) => {
      // 1. Instant Direct LAN Execution (if on same local network, ~10ms)
      if (localIp) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 600);
          const lanUrl =
            action === 'toggle'
              ? `http://${localIp}/toggle?pin=${pin}`
              : `http://${localIp}/set?pin=${pin}&value=${value}`;

          fetch(lanUrl, { method: 'GET', mode: 'cors', signal: controller.signal })
            .catch(() => {})
            .finally(() => clearTimeout(timeoutId));
        } catch {
          // Direct LAN fallback
        }
      }

      // 2. Transmit via persistent WebSocket channel (sub-2ms overhead)
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('device:command', { chipId, pin, action, value });
        return;
      }

      // 3. Fallback to standard HTTP POST if WebSocket is disconnected
      await fetch(`/api/devices/${chipId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action, value }),
      });
    },
    []
  );

  return { isConnected, sendCommand };
}
