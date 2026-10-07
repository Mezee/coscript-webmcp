"use client";

import { useId } from "react";

/**
 * Filled silhouette of the coscript mark, used to clip the sliding bars.
 *
 * Traced from the brand asset: a bold "C" open to the right, drawn as an
 * outer ellipse of 316x378 with a uniform 125 unit stroke, arcing from 38.5°
 * to 323°. The disc is a separate subpath, offset right of centre.
 */
const C_PATH =
  "M247.3 235.31A316 378 0 1 1 252.37 -227.49L152.54 -152.26A191 253 0 1 0 149.48 157.5Z";
const DOT = { cx: 55, cy: -5, r: 126 };

const VIEW_W = 632;
const VIEW_H = 756;

// Each row is a pair of rounded bars with a slot between them, both running far
// past the silhouette so the C's outline never breaks as the pair slides — only
// the slot travels across, sweeping the mark's cut-outs left and right.
// Uneven slot centres and widths give every row its own bar lengths, and odd
// rows run the reversed keyframes so neighbours sweep against each other.
// The mark is a thin ring, so the slots stay narrow: wider ones punch straight
// through the C's band and leave the shape unreadable at 44px.
const SLOTS = [
  { center: -150, width: 70 },
  { center: 40, width: 110 },
  { center: -30, width: 90 },
  { center: 120, width: 80 },
];
const ROW_GAP = 68;
const ROW_HEIGHT = (VIEW_H - (SLOTS.length - 1) * ROW_GAP) / SLOTS.length;
const OVERHANG = 760;
/** Seconds between neighbouring rows, applied as a negative delay so the slots fan out. */
const ROW_STAGGER = 0.11;

export default function LogoLoader({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // Ids must be unique per instance, and React's contain colons that trip up url().
  const clipId = `logo-c-${useId().replace(/:/g, "")}`;
  const markHeight = size * 0.56;

  return (
    <div
      role="img"
      aria-label="Loading"
      className={`flex items-center justify-center rounded-[22%] bg-transparent text-zinc-900 dark:text-zinc-100 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={(markHeight * VIEW_W) / VIEW_H}
        height={markHeight}
        viewBox={`${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`}
        fill="none"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={C_PATH} />
            <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`} fill="currentColor">
          {SLOTS.map(({ center, width }, i) => {
            const y = -VIEW_H / 2 + i * (ROW_HEIGHT + ROW_GAP);
            const slotStart = center - width / 2;
            return (
              <g
                key={i}
                className={i % 2 ? "logo-bar logo-bar-alt" : "logo-bar"}
                style={{ animationDelay: `${-i * ROW_STAGGER}s` }}
              >
                <rect
                  x={-OVERHANG}
                  y={y}
                  width={OVERHANG + slotStart}
                  height={ROW_HEIGHT}
                  rx={ROW_HEIGHT / 2}
                />
                <rect
                  x={slotStart + width}
                  y={y}
                  width={OVERHANG}
                  height={ROW_HEIGHT}
                  rx={ROW_HEIGHT / 2}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
