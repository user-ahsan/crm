'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconCalendarMonth } from '@tabler/icons-react';

interface BarGroup {
  key: string;
  value: number;
  color: string;
  label: string;
}

interface ChartDataPoint {
  label: string;
  groups: BarGroup[];
}

interface MonthlyTrendsChartProps {
  data: ChartDataPoint[];
  bars: { key: string; label: string; color: string }[];
}

export function MonthlyTrendsChart({ data, bars }: MonthlyTrendsChartProps) {
  const [hovered, setHovered] = useState<{ monthIdx: number; barKey: string } | null>(null);

  const { maxValue, yTicks } = useMemo(() => {
    const all = data.flatMap((d) => d.groups.map((g) => g.value));
    const mx = Math.max(...all, 1);
    // Round up to a nice number for Y-axis
    const pow = Math.pow(10, Math.floor(Math.log10(mx)));
    const nice = Math.ceil(mx / pow) * pow;
    // Generate 4 tick marks
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round((nice / 4) * i));
    }
    return { maxValue: nice, yTicks: ticks };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalendarMonth size={20} className="text-muted-foreground" />
            Monthly Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No monthly data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const barCount = bars.length;
  const barWidth = Math.min(28, Math.max(12, 320 / data.length / barCount));
  const groupGap = Math.max(4, Math.min(16, 320 / data.length));
  const chartHeight = 260;
  const plotHeight = chartHeight - 40; // leave room for X-axis labels

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCalendarMonth size={20} className="text-muted-foreground" />
          Monthly Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
          {bars.map((bar) => (
            <div key={bar.key} className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-sm"
                style={{ backgroundColor: bar.color }}
              />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="overflow-x-auto pb-2">
          <div className="relative" style={{ height: chartHeight, minWidth: data.length * (barWidth * barCount + groupGap) }}>
            {/* Y-axis gridlines */}
            {yTicks.map((tick) => {
              const y = plotHeight - (tick / maxValue) * plotHeight;
              return (
                <div key={tick} className="absolute left-0 right-0 flex items-center" style={{ bottom: y }}>
                  <span className="mr-2 text-xs text-muted-foreground">{tick}</span>
                  <div className="flex-1 border-t border-border/40" />
                </div>
              );
            })}

            {/* Bars */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-10" style={{ height: plotHeight }}>
              {data.map((item, idx) => {
                const groupWidth = barWidth * barCount + (barCount - 1) * 2;
                return (
                  <div
                    key={item.label}
                    className="flex items-end justify-center"
                    style={{ gap: 2, width: groupWidth }}
                  >
                    {item.groups.map((g) => {
                      const barH = maxValue > 0 ? (g.value / maxValue) * plotHeight : 0;
                      const isHovered = hovered?.monthIdx === idx && hovered?.barKey === g.key;
                      return (
                        <div key={g.key} className="relative flex flex-col items-center">
                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute -top-8 z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-sm">
                              {g.label}: {g.value}
                            </div>
                          )}
                          <div
                            className="rounded-t transition-all duration-150"
                            style={{
                              width: barWidth,
                              height: Math.max(barH, g.value > 0 ? 2 : 0),
                              backgroundColor: g.color,
                              opacity: hovered && !isHovered ? 0.6 : 1,
                            }}
                            onMouseEnter={() => setHovered({ monthIdx: idx, barKey: g.key })}
                            onMouseLeave={() => setHovered(null)}
                          />
                        </div>
                      );
                    })}
                    <span className="absolute -bottom-6 truncate text-xs text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MonthlyTrendsChart;
