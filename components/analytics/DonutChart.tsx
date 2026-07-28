'use client';

import { useId } from 'react';

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 28,
  centerLabel,
  centerSubLabel,
  className,
}: DonutChartProps) {
  const uid = useId();
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          fontSize={14}
        >
          No data
        </text>
      </svg>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const nonZero = segments.filter((s) => s.value > 0);

  // ponytail: single-segment shortcut — full circle
  if (nonZero.length === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={nonZero[0].color}
          strokeWidth={strokeWidth}
        />
        {centerLabel && (
          <text
            x={center}
            y={centerSubLabel ? center - 6 : center}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground"
            fontSize={22}
            fontWeight={700}
          >
            {centerLabel}
          </text>
        )}
        {centerSubLabel && (
          <text
            x={center}
            y={center + 16}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            fontSize={12}
          >
            {centerSubLabel}
          </text>
        )}
      </svg>
    );
  }

  // Pre-compute segment offsets immutably — avoids react-hooks/immutability error
  const segmentsWithOffset = nonZero.reduce<{ value: number; segLen: number; offset: number; color: string; label: string }[]>(
    (acc, seg) => {
      const segLen = (seg.value / total) * circumference;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].segLen : 0;
      acc.push({ value: seg.value, segLen, offset, color: seg.color, label: seg.label });
      return acc;
    },
    [],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      {segmentsWithOffset.map((seg, i) => (
        <circle
          key={`${uid}-${i}`}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.segLen} ${circumference - seg.segLen}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-opacity duration-200 hover:opacity-80"
          style={{ cursor: 'pointer' }}
        />
      ))}
      {centerLabel && (
        <text
          x={center}
          y={centerSubLabel ? center - 6 : center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground"
          fontSize={22}
          fontWeight={700}
        >
          {centerLabel}
        </text>
      )}
      {centerSubLabel && (
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          fontSize={12}
        >
          {centerSubLabel}
        </text>
      )}
    </svg>
  );
}

export default DonutChart;
