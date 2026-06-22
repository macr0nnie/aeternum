// =============================================================================
// Aeternum — Octagram (8-stat polygon renderer)
// =============================================================================
// Hand-built in React Native Skia. No charting library is used — this gives
// us full control over the angular aesthetic and element accent integration.
//
// The octagram renders two concentric polygons:
//   outer — the player's current stat values (normalised 0–1)
//   inner — a faint baseline grid showing max extent
//
// All 8 stats are positioned at 45° intervals starting from the top (ATK).
// Stat ordering is clockwise: ATK → SPD → INT → LCK → DEF → END → PER → CHA
// =============================================================================

import React, { useMemo } from 'react'
import { Canvas, Path, Skia, Circle, Text as SkiaText, useFont } from '@shopify/react-native-skia'
import { View } from 'react-native'
import { COLORS, FONT_SIZES, elementAccent } from '@/theme/tokens'
import { STAT_KEYS, type Stats, type StatKey, type Element } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OctagramProps {
  stats: Stats
  maxStat?: number
  element?: Element | null
  size?: number
  showLabels?: boolean
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.sin(angleRad),
    y: cy - radius * Math.cos(angleRad),
  }
}

function buildPolygonPath(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  offsetRad = 0,
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make()
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides + offsetRad
    const { x, y } = polarToCartesian(cx, cy, radius, angle)
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.close()
  return path
}

function buildStatPath(
  cx: number,
  cy: number,
  maxRadius: number,
  values: number[], // normalised 0–1, length === 8
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make()
  values.forEach((value, i) => {
    const angle = (2 * Math.PI * i) / 8
    const radius = maxRadius * Math.max(0, Math.min(1, value))
    const { x, y } = polarToCartesian(cx, cy, radius, angle)
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  })
  path.close()
  return path
}


function labelPositions(
  cx: number,
  cy: number,
  radius: number,
): Array<{ x: number; y: number }> {
  return STAT_KEYS.map((_, i) => {
    const angle = (2 * Math.PI * i) / 8
    return polarToCartesian(cx, cy, radius + 18, angle)
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Octagram: React.FC<OctagramProps> = ({
  stats,
  maxStat = 100,
  element = null,
  size = 240,
  showLabels = true,
}) => {
  const palette = elementAccent(element)
  const cx = size / 2
  const cy = size / 2
  const outerRadius = (size / 2) * 0.72

  const font = useFont(require('../../assets/fonts/ShareTechMono_400Regular.ttf'), FONT_SIZES.xs)

  const normalisedValues = useMemo(
    () => STAT_KEYS.map((key) => stats[key] / maxStat),
    [stats, maxStat],
  )

  // Grid rings (4 rings at 25%, 50%, 75%, 100%)
  const gridRings = useMemo(
    () => [0.25, 0.5, 0.75, 1.0].map((fraction) =>
      buildPolygonPath(cx, cy, outerRadius * fraction, 8),
    ),
    [cx, cy, outerRadius],
  )

  // Spoke lines from centre to each vertex
  const spokePaths = useMemo(
    () => STAT_KEYS.map((_, i) => {
      const angle = (2 * Math.PI * i) / 8
      const { x, y } = polarToCartesian(cx, cy, outerRadius, angle)
      const path = Skia.Path.Make()
      path.moveTo(cx, cy)
      path.lineTo(x, y)
      return path
    }),
    [cx, cy, outerRadius],
  )

  // Stat polygon
  const statPath = useMemo(
    () => buildStatPath(cx, cy, outerRadius, normalisedValues),
    [cx, cy, outerRadius, normalisedValues],
  )

  // Vertex dots
  const vertexPoints = useMemo(
    () => STAT_KEYS.map((key, i) => {
      const angle = (2 * Math.PI * i) / 8
      const radius = outerRadius * Math.max(0, Math.min(1, stats[key] / maxStat))
      return polarToCartesian(cx, cy, radius, angle)
    }),
    [cx, cy, outerRadius, stats, maxStat],
  )

  const labels = useMemo(
    () => labelPositions(cx, cy, outerRadius),
    [cx, cy, outerRadius],
  )

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {/* Grid rings */}
        {gridRings.map((path, i) => (
          <Path
            key={`ring-${i}`}
            path={path}
            color={COLORS.borderLow}
            style="stroke"
            strokeWidth={1}
          />
        ))}

        {/* Spokes */}
        {spokePaths.map((path, i) => (
          <Path
            key={`spoke-${i}`}
            path={path}
            color={COLORS.borderLow}
            style="stroke"
            strokeWidth={1}
          />
        ))}

        {/* Stat fill */}
        <Path
          path={statPath}
          color={palette.mid + '80'} // 50% alpha fill
          style="fill"
        />

        {/* Stat outline */}
        <Path
          path={statPath}
          color={palette.base}
          style="stroke"
          strokeWidth={2}
        />

        {/* Vertex dots */}
        {vertexPoints.map((point, i) => (
          <Circle
            key={`vertex-${i}`}
            cx={point.x}
            cy={point.y}
            r={3}
            color={palette.bright}
          />
        ))}

        {/* Centre dot */}
        <Circle cx={cx} cy={cy} r={2} color={palette.base} />

        {/* Stat labels */}
        {showLabels && font && labels.map((pos, i) => {
          const label = STAT_KEYS[i] as StatKey
          const textX = pos.x - (label.length * 4)
          const textY = pos.y + FONT_SIZES.xs / 2
          return (
            <SkiaText
              key={`label-${label}`}
              x={textX}
              y={textY}
              text={label}
              font={font}
              color={COLORS.textSecondary}
            />
          )
        })}
      </Canvas>
    </View>
  )
}
