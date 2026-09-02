import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:5000`;
    }
  }
  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000'
    : 'https://koln-api.jaxlabs.site';
}

export function getSocket(): Socket {
  const backendUrl = getBackendUrl();
  if (!socket || (socket as any).io?.uri !== backendUrl) {
    if (socket) {
      socket.disconnect();
    }
    socket = io(backendUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend server at ${backendUrl} (ID: ${socket?.id})`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected from backend: ${reason}`);
    });
  }

  return socket;
}
