import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  return 'https://koln-api.jaxlabs.site';
}

export function getSocket(): Socket {
  if (!socket) {
    const backendUrl = getBackendUrl();
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
