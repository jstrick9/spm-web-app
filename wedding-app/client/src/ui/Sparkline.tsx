import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/**
 * Tiny inline area chart for use inside StatCards. No axes, no legend,
 * no tooltip — just a visual hint of the trend.
 *
 *   <Sparkline data={[3, 7, 9, 12, 14, 18, 22]} />
 */
export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Tailwind color class to derive stroke + fill (e.g. 'text-brand'). */
  className?: string;
}

export function Sparkline({ data, width = 80, height = 32, className }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height }} className={className} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="currentColor" stopOpacity={0.3} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="url(#sparkfill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
