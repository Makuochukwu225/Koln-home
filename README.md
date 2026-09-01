# Koln Home Controller 🏡⚡

A modern, full-stack Next.js web dashboard and Web Serial flasher for DIY ESP32 home automation boards, relays, dimmers, and sensors.

![Koln Home Controller](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-cyan?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Key Features 🚀

- **⚡ Web Serial Firmware Flasher**: Flash blank ESP32 microcontrollers directly from your browser over USB using `esptool-js` with zero local IDE installation required.
- **📁 Firmware Library Management**:
  - Store multiple `.bin` binaries on the server (`public/firmware`).
  - Upload custom compiled firmware `.bin` files via drag-and-drop or file selector.
  - Set uploaded binaries as the default system firmware.
  - List and delete firmware files directly from the UI dashboard.
- **🎛️ ESP32 Provisioning & Device Control**:
  - Live status tracking of registered ESP32 boards.
  - Filter devices by name or Chip ID.
  - Captive Portal integration for easy Wi-Fi credential provisioning.
- **📱 Progressive Web App (PWA)**:
  - Mobile-first responsive UI.
  - Offline app shell caching powered by a service worker.

---

## Tech Stack 🛠️

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) via Mongoose
- **Hardware Flashing**: [`esptool-js`](https://github.com/espressif/esptool-js) (Web Serial API)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started ⚙️

### 1. Prerequisites

- **Node.js**: `v18.x` or higher
- **Browser**: Google Chrome, Microsoft Edge, or Opera (required for Web Serial API support)
- **Database**: Local MongoDB instance or MongoDB Atlas cluster

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/koln-home.git
cd koln-home
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory based on `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Update your `.env.local` configuration:

```env
MONGODB_URI=mongodb://localhost:27017/koln_home
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development Server

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure 📂

```text
koln-home/
├── public/
│   ├── firmware/          # Firmware binary storage (.bin)
│   ├── manifest.json      # PWA web manifest
│   └── sw.js              # Service Worker for PWA shell caching
├── src/
│   ├── app/
│   │   ├── api/           # API routes (devices, firmware management)
│   │   ├── flash/         # Web Serial flasher page component
│   │   ├── layout.tsx     # Root layout & meta configuration
│   │   └── page.tsx       # System dashboard page
│   ├── components/        # Reusable UI components (Navbar, DeviceCard)
│   ├── lib/               # Utility libraries (MongoDB connection)
│   └── models/            # Database Mongoose schemas
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Flashing ESP32 Boards ⚡

1. Connect your ESP32 board to your computer using a data-capable USB cable.
2. Navigate to **Flash Device** in the navbar (`/flash`).
3. Select your firmware:
   - Pick a pre-compiled binary from the **Server Firmware Library**.
   - Or upload a custom `.bin` file directly from your computer.
4. Choose the **Baud Rate** (460800 recommended) and **Flash Address Offset** (`0x10000` for standard app binaries, `0x0000` for merged binaries).
5. Click **Connect Port & Flash ESP32**, select your serial device port, and monitor progress in the live terminal console output.

---

## License 📜

Distributed under the MIT License. See `LICENSE` for details.
