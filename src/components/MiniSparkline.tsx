import React from 'react';

interface MiniSparklineProps {
  data: number[];
  strokeColor?: string;
  fillColor?: string;
  width?: number;
  height?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  strokeColor = '#FFFFFF',
  fillColor = '#FFFFFF',
  width = 64,
  height = 20,
}) => {
  // Ensure we have at least 7 points (or pad with 0s)
  const points = data.length >= 2 ? data : [0, 0, 0, 0, 0, 0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const padding = 2;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const coords = points.map((val, idx) => {
    const x = padding + (idx / (points.length - 1)) * drawWidth;
    const y = height - padding - ((val - min) / range) * drawHeight;
    return { x, y };
  });

  const pathD = coords.reduce((acc, curr, i) => {
    return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  const lastPoint = coords[coords.length - 1];

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`spark-grad-${strokeColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#spark-grad-${strokeColor.replace('#', '')})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint && (
          <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={strokeColor} />
        )}
      </svg>
    </div>
  );
};
