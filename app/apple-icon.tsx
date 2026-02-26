import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          borderRadius: 28,
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 200 240"
          fill="none"
          style={{ marginTop: -20 }}
        >
          <defs>
            <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#B91C1C" />
            </linearGradient>
          </defs>
          <path
            d="M100 0 L180 40 L180 160 Q180 200 160 220 Q140 240 100 240 Q60 240 40 220 Q20 200 20 160 L20 40 Z"
            fill="url(#redGrad)"
            stroke="#1E3A8A"
            strokeWidth="2"
          />
          <path
            d="M100 0 L180 40 L180 80 L20 80 L20 40 Z"
            fill="#1E3A8A"
          />
          <g fill="#FFFFFF">
            <path d="M50 30 L52 36 L58 36 L53 40 L55 46 L50 42 L45 46 L47 40 L42 36 L48 36 Z" />
            <path d="M80 30 L82 36 L88 36 L83 40 L85 46 L80 42 L75 46 L77 40 L72 36 L78 36 Z" />
            <path d="M110 30 L112 36 L118 36 L113 40 L115 46 L110 42 L105 46 L107 40 L102 36 L108 36 Z" />
            <path d="M140 30 L142 36 L148 36 L143 40 L145 46 L140 42 L135 46 L137 40 L132 36 L138 36 Z" />
            <path d="M35 50 L37 56 L43 56 L38 60 L40 66 L35 62 L30 66 L32 60 L27 56 L33 56 Z" />
            <path d="M65 50 L67 56 L73 56 L68 60 L70 66 L65 62 L60 66 L62 60 L57 56 L63 56 Z" />
            <path d="M95 50 L97 56 L103 56 L98 60 L100 66 L95 62 L90 66 L92 60 L87 56 L93 56 Z" />
            <path d="M125 50 L127 56 L133 56 L128 60 L130 66 L125 62 L120 66 L122 60 L117 56 L123 56 Z" />
            <path d="M155 50 L157 56 L163 56 L158 60 L160 66 L155 62 L150 66 L152 60 L147 56 L153 56 Z" />
          </g>
          <rect x="20" y="80" width="160" height="22.86" fill="#DC2626" />
          <rect x="20" y="102.86" width="160" height="22.86" fill="#FFFFFF" />
          <rect x="20" y="125.72" width="160" height="22.86" fill="#DC2626" />
          <rect x="20" y="148.58" width="160" height="22.86" fill="#FFFFFF" />
          <rect x="20" y="171.44" width="160" height="22.86" fill="#DC2626" />
          <rect x="20" y="194.3" width="160" height="22.86" fill="#FFFFFF" />
          <rect x="20" y="217.16" width="160" height="22.84" fill="#DC2626" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
