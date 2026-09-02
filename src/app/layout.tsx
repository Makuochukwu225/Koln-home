import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ESP32 Live Controller',
  description: 'Real-time WebSocket Pivot Controller for ESP32',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
