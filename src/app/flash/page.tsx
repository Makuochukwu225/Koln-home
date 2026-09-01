'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ESPLoader, Transport } from 'esptool-js';
import {
  Zap,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Usb,
  Upload,
  FileCode,
  Folder,
  HardDrive,
  X,
  Server,
  Loader2,
  Trash2,
  Check,
} from 'lucide-react';

interface FirmwareItem {
  filename: string;
  size: number;
  modifiedAt: string;
  isDefault: boolean;
  url: string;
}

export default function FlashPage() {
  const [step, setStep] = useState<'connect' | 'flashing' | 'done'>('connect');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(460800);

  // Server Firmware List State
  const [firmwareList, setFirmwareList] = useState<FirmwareItem[]>([]);
  const [selectedServerFirmware, setSelectedServerFirmware] = useState<string>('kolnhome_esp32.bin');
  const [loadingFirmware, setLoadingFirmware] = useState(true);

  // Firmware Selection Mode
  const [firmwareSource, setFirmwareSource] = useState<'bundled' | 'custom'>('bundled');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [flashAddress, setFlashAddress] = useState<number>(0x10000); // Default offset: 0x10000
  const [isDragging, setIsDragging] = useState(false);

  // Server Upload State
  const [uploadingServer, setUploadingServer] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const fetchFirmwareList = async () => {
    setLoadingFirmware(true);
    try {
      const res = await fetch('/api/firmware');
      const data = await res.json();
      if (data.success && data.firmware) {
        setFirmwareList(data.firmware);
        // If current selected firmware is no longer in list, default to first item
        if (data.firmware.length > 0) {
          const exists = data.firmware.some((f: FirmwareItem) => f.filename === selectedServerFirmware);
          if (!exists) {
            setSelectedServerFirmware(data.firmware[0].filename);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load firmware list:', err);
    } finally {
      setLoadingFirmware(false);
    }
  };

  useEffect(() => {
    fetchFirmwareList();
  }, []);

  const handleSelectServerFirmware = (firmware: FirmwareItem) => {
    setSelectedServerFirmware(firmware.filename);
    setError(null);

    // Auto detect flash address offset based on filename or size
    if (firmware.filename.includes('.merged.') || firmware.size > 2 * 1024 * 1024) {
      setFlashAddress(0x0000);
    } else {
      setFlashAddress(0x10000);
    }
  };

  const handleDeleteFirmware = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${filename}" from the server?`)) {
      return;
    }

    setError(null);
    setUploadSuccess(null);

    try {
      const res = await fetch(`/api/firmware?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete firmware file.');
      }
      setUploadSuccess(data.message);
      await fetchFirmwareList();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.bin') && !file.name.endsWith('.elf')) {
      setError('Please select a valid compiled binary file (.bin).');
      return;
    }
    setError(null);
    setUploadSuccess(null);
    setUploadedFile(file);

    // Auto-detect flash address offset based on binary size
    if (file.size > 2 * 1024 * 1024) {
      setFlashAddress(0x0000);
    } else {
      setFlashAddress(0x10000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSaveToPublicFolder = async (saveAsDefault: boolean) => {
    if (!uploadedFile) return;
    setUploadingServer(true);
    setUploadSuccess(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      if (saveAsDefault) {
        formData.append('saveAsDefault', 'true');
      }

      const res = await fetch('/api/firmware/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload firmware file to server.');
      }

      setUploadSuccess(data.message);
      await fetchFirmwareList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingServer(false);
    }
  };

  const handleFlash = async () => {
    setError(null);
    setLogs([]);
    setProgress(0);

    if (firmwareSource === 'custom' && !uploadedFile) {
      setError('Please upload or select a custom .bin firmware file before proceeding.');
      return;
    }

    if (!('serial' in navigator)) {
      setError('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return;
    }

    try {
      appendLog('[WebSerial] Requesting serial port...');
      const port = await (navigator as any).serial.requestPort();
      const transport = new Transport(port);

      const espLoader = new ESPLoader({
        transport,
        baudrate: baudRate,
        romBaudrate: 115200,
        terminal: {
          clean: () => setLogs([]),
          writeLine: (data: string) => appendLog(data),
          write: (data: string) => appendLog(data),
        },
      });

      appendLog('[ESPLoader] Initializing connection with ESP32...');
      setStep('flashing');

      await espLoader.main();
      appendLog(`[ESPLoader] Connected chip: ${espLoader.chip.CHIP_NAME}`);

      let arrayBuffer: ArrayBuffer;

      if (firmwareSource === 'bundled') {
        const targetUrl = `/firmware/${selectedServerFirmware}`;
        appendLog(`[ESPLoader] Fetching firmware binary from ${targetUrl}...`);
        const response = await fetch(targetUrl);
        if (!response.ok) {
          throw new Error(
            `Firmware binary file not found at ${targetUrl}. Please verify server file list.`
          );
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        appendLog(`[ESPLoader] Reading custom binary: ${uploadedFile!.name} (${(uploadedFile!.size / 1024).toFixed(1)} KB)...`);
        arrayBuffer = await uploadedFile!.arrayBuffer();
      }

      // Convert ArrayBuffer to binary string required by esptool-js
      const uint8 = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8.length; i++) {
        binaryString += String.fromCharCode(uint8[i]);
      }

      const hexAddress = `0x${flashAddress.toString(16).toUpperCase()}`;
      appendLog(
        `[ESPLoader] Binary loaded (${(binaryString.length / 1024).toFixed(1)} KB). Target Address: ${hexAddress}...`
      );

      const fileArray = [
        {
          data: binaryString,
          address: flashAddress,
        },
      ];

      await espLoader.writeFlash({
        fileArray,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setProgress(pct);
        },
      });

      appendLog('[ESPLoader] Flashing complete! Resetting chip...');
      await espLoader.hardReset();
      await transport.disconnect();

      setStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during flashing.');
      setStep('connect');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <Zap className="w-7 h-7 text-cyan-400" />
          <span>Web Serial Firmware Flasher</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Flash default Koln Home firmware, choose from saved binaries, or upload custom ESP32 images directly from your browser.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Success</p>
            <p className="text-xs text-emerald-400/90 mt-0.5">{uploadSuccess}</p>
          </div>
        </div>
      )}

      {/* Main Flasher Step Container */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl space-y-6">
        {step === 'connect' && (
          <div className="space-y-6">
            {/* Step 1: Firmware Source Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-gray-400 font-semibold tracking-wider uppercase">
                  Step 1: Choose Firmware Source
                </label>

                <button
                  type="button"
                  onClick={fetchFirmwareList}
                  className="text-xs text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 transition"
                  title="Refresh firmware list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFirmware ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 p-1 bg-background/60 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setFirmwareSource('bundled')}
                  className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                    firmwareSource === 'bundled'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surfaceHover'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span>Server Firmware Library</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFirmwareSource('custom')}
                  className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                    firmwareSource === 'custom'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surfaceHover'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Local .bin</span>
                </button>
              </div>

              {/* Server Firmware List Container */}
              {firmwareSource === 'bundled' && (
                <div className="space-y-2">
                  {loadingFirmware ? (
                    <div className="p-6 bg-background/30 rounded-xl border border-border text-center space-y-2">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                      <p className="text-xs text-gray-400">Loading firmware binaries from server...</p>
                    </div>
                  ) : firmwareList.length === 0 ? (
                    <div className="p-6 bg-background/30 rounded-xl border border-border text-center text-gray-400 text-xs">
                      No firmware files found in public/firmware directory.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {firmwareList.map((fw) => {
                        const isSelected = selectedServerFirmware === fw.filename;
                        return (
                          <div
                            key={fw.filename}
                            onClick={() => handleSelectServerFirmware(fw)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-sm'
                                : 'bg-background/40 hover:bg-background/70 border-border text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`p-2 rounded-lg border shrink-0 ${
                                  isSelected
                                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                                    : 'bg-surface border-border text-gray-400'
                                }`}
                              >
                                <FileCode className="w-4 h-4" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold truncate">{fw.filename}</p>
                                  {fw.isDefault && (
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded">
                                      DEFAULT
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                  {(fw.size / 1024).toFixed(1)} KB &bull; {(fw.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isSelected && (
                                <span className="p-1 rounded-md bg-cyan-500 text-black">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleDeleteFirmware(fw.filename, e)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title={`Delete ${fw.filename}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Firmware File Dropzone & Server Upload Options */}
              {firmwareSource === 'custom' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".bin,.elf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {!uploadedFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        isDragging
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-border hover:border-cyan-500/50 bg-background/30 hover:bg-background/50'
                      }`}
                    >
                      <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-bold text-gray-200">Click to browse or drop binary file</p>
                      <p className="text-xs text-gray-500 mt-1">Supports compiled ESP32 firmware binaries (.bin)</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-background/50 rounded-xl border border-cyan-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                            <HardDrive className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-200 truncate max-w-xs sm:max-w-md">
                              {uploadedFile.name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              Size: {(uploadedFile.size / 1024).toFixed(1)} KB &bull; {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            setUploadSuccess(null);
                          }}
                          className="p-1.5 rounded-lg bg-surface hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Options to upload file to public/firmware server directory */}
                      <div className="p-3 bg-background/40 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <Server className="w-4 h-4 text-cyan-400" />
                          <span>Save to server library (<code className="text-gray-400">public/firmware</code>)?</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={uploadingServer}
                            onClick={() => handleSaveToPublicFolder(false)}
                            className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surfaceHover border border-border text-xs font-semibold text-gray-200 transition flex items-center gap-1.5"
                          >
                            {uploadingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            <span>Save as {uploadedFile.name}</span>
                          </button>

                          <button
                            type="button"
                            disabled={uploadingServer}
                            onClick={() => handleSaveToPublicFolder(true)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-xs font-semibold text-cyan-300 transition flex items-center gap-1.5"
                          >
                            {uploadingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            <span>Save as Default Firmware</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Configuration (Baudrate & Address) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="p-4 bg-background/50 rounded-xl border border-border space-y-1.5">
                <label className="text-xs text-gray-400 font-mono">BAUD RATE</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value={115200}>115200 (Safe / Standard)</option>
                  <option value={460800}>460800 (Recommended)</option>
                  <option value={921600}>921600 (High Speed)</option>
                </select>
              </div>

              <div className="p-4 bg-background/50 rounded-xl border border-border space-y-1.5">
                <label className="text-xs text-gray-400 font-mono">FLASH ADDRESS (OFFSET)</label>
                <select
                  value={flashAddress}
                  onChange={(e) => setFlashAddress(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value={0x10000}>0x10000 (App Binary - Standard)</option>
                  <option value={0x0000}>0x0000 (Merged Factory Image)</option>
                </select>
              </div>
            </div>

            {/* Flash Button */}
            <button
              onClick={handleFlash}
              disabled={firmwareSource === 'custom' && !uploadedFile}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                firmwareSource === 'custom' && !uploadedFile
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-border'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/30'
              }`}
            >
              <Usb className="w-4 h-4" />
              <span>Connect Port & Flash Firmware</span>
            </button>
          </div>
        )}

        {step === 'flashing' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-cyan-400">Flashing Firmware in Progress...</span>
              <span className="font-mono text-gray-300">{progress}%</span>
            </div>

            <div className="w-full h-3 bg-background rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div>
              <h3 className="text-lg font-bold text-white">Firmware Flashed Successfully!</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                Your ESP32 has been successfully programmed.
              </p>
            </div>

            <div className="p-4 bg-background/80 rounded-xl border border-border text-left max-w-md mx-auto text-xs space-y-2">
              <p className="font-bold text-cyan-400">Next Steps (WiFi Provisioning):</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Connect your phone/laptop to WiFi AP: <strong>ESP32-Setup-XXXX</strong></li>
                <li>The Captive Portal setup form will pop up automatically.</li>
                <li>Enter your Home WiFi credentials and Backend URL.</li>
                <li>Click Save &mdash; the device will connect and register immediately!</li>
              </ol>
            </div>

            <button
              onClick={() => setStep('connect')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surfaceHover border border-border rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Flash Another Board</span>
            </button>
          </div>
        )}

        {/* Terminal Output Log */}
        <div className="bg-background rounded-xl p-4 border border-border space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 pb-2 border-b border-border/40">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Serial Console Output</span>
          </div>
          <div className="h-44 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-0.5">
            {logs.length === 0 ? (
              <span className="text-gray-600">Waiting for connection...</span>
            ) : (
              logs.map((line, idx) => <div key={idx}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
