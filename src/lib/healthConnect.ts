// =============================================================================
// Aeternum — Health Connect Interface (react-native-health-connect v3)
// =============================================================================
// Wraps react-native-health-connect behind a clean interface so the rest of
// the app never imports that library directly.
//
// Why the abstraction: Health Connect permissions are per record type and can
// be revoked at any time. This module centralises all error handling and
// permission checks. If we ever add HealthKit for iOS, only this file changes.
//
// Why post-run sync only: the player runs with their phone in their pocket.
// We read the completed ExerciseSession after the run — no real-time polling,
// no GPS, no battery drain during activity.
// =============================================================================

import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
} from 'react-native-health-connect'
import type { HealthConnectSession } from '@/types'

// ---------------------------------------------------------------------------
// Permission configuration
// ---------------------------------------------------------------------------
// We only request what we actually use. Requesting unused permissions
// triggers Play Store review flags and degrades user trust.

const REQUIRED_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
]

// ---------------------------------------------------------------------------
// Check existing grants (safe to call from any context — no dialog)
// ---------------------------------------------------------------------------

export async function checkHealthConnect(): Promise<boolean> {
  try {
    const isAvailable = await initialize()
    if (!isAvailable) return false

    const granted = await getGrantedPermissions()
    const requiredTypes = REQUIRED_PERMISSIONS.map(p => p.recordType)
    return requiredTypes.every(type =>
      granted.some((g: { recordType: string }) => g.recordType === type),
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Request permissions (MUST be called from a user interaction / Activity context)
// Calling this from a background useEffect will crash on Android.
// ---------------------------------------------------------------------------

export async function initHealthConnect(): Promise<boolean> {
  try {
    const isAvailable = await initialize()
    if (!isAvailable) return false

    const granted = await requestPermission(REQUIRED_PERMISSIONS)
    return granted.length >= REQUIRED_PERMISSIONS.length
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Read the most recent completed exercise session
// ---------------------------------------------------------------------------
// Returns null if no session found or permissions are missing.
// We always read the most recent session — the player explicitly taps
// "Sync Run" after their run, so the last session is the intended one.

export async function readLastRun(): Promise<HealthConnectSession | null> {
  try {
    // Look back 48 hours to catch runs done the day before syncing
    const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const endTime = new Date().toISOString()

    const sessionResult = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })

    const sessions = sessionResult.records
    if (!sessions || sessions.length === 0) return null

    // Most recent session is last in the array
    const session = sessions[sessions.length - 1]
    if (!session) return null

    const sessionStart = session.startTime as string
    const sessionEnd = session.endTime as string

    // Aggregate steps, distance, and heart rate within this session window
    const [stepsResult, distanceResult, heartRateResult] = await Promise.all([
      readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: sessionStart, endTime: sessionEnd },
      }),
      readRecords('Distance', {
        timeRangeFilter: { operator: 'between', startTime: sessionStart, endTime: sessionEnd },
      }),
      readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: sessionStart, endTime: sessionEnd },
      }),
    ])

    const totalSteps = (stepsResult.records as Array<{ count: number }>)
      .reduce((sum, r) => sum + (r.count ?? 0), 0)

    const totalDistanceMeters = (distanceResult.records as Array<{ distance?: { inMeters?: number } }>)
      .reduce((sum, r) => sum + (r.distance?.inMeters ?? 0), 0)

    const allHeartSamples = (heartRateResult.records as Array<{ samples?: Array<{ beatsPerMinute?: number }> }>)
      .flatMap((r) => r.samples ?? [])
    const avgHeartRate =
      allHeartSamples.length > 0
        ? Math.round(
            allHeartSamples.reduce((sum, s) => sum + (s.beatsPerMinute ?? 0), 0) /
              allHeartSamples.length,
          )
        : null

    if (totalDistanceMeters < 100) {
      // Less than 100m — likely a false trigger or app glitch, not a real run
      return null
    }

    return {
      startTime: sessionStart,
      endTime: sessionEnd,
      distanceMeters: totalDistanceMeters,
      steps: totalSteps,
      avgHeartRateBpm: avgHeartRate,
    }
  } catch {
    return null
  }
}
