'use client';

import React from 'react';

interface TelemetryPoint {
  timestamp: string | Date;
  value: number;
}

interface SensorChartProps {
  data: TelemetryPoint[];
  unit?: string;
  color?: string;
}

export default function SensorChart({ data, unit = '', color = '#38bdf8' }: SensorChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-gray-500 bg-background/50 rounded-lg border border-border">
        No telemetry logged yet
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const width = 300;
  const height = 80;
  const padding = 10;

  const points = data
    .map((d, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((d.value - minVal) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  const currentVal = values[values.length - 1];

  return (
    <div className="bg-background/60 p-3 rounded-lg border border-border">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-400">Telemetry History ({data.length} pts)</span>
        <span className="text-sm font-mono font-bold text-cyan-400">
          {currentVal.toFixed(1)} {unit}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
        {/* Fill Area */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill={color}
          fillOpacity="0.15"
        />
        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {/* Highlight latest point */}
        {data.length > 0 && (
          <circle
            cx={width - padding}
            cy={height - padding - ((currentVal - minVal) / range) * (height - 2 * padding)}
            r="4"
            fill={color}
            className="animate-pulse"
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
        <span>Min: {minVal.toFixed(1)}</span>
        <span>Max: {maxVal.toFixed(1)}</span>
      </div>
    </div>
  );
}
