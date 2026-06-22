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
  openHealthConnectSettings,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect'

// Result of attempting to connect Health Connect, so the UI can guide the user
// instead of just showing a vague success/fail.
export type HealthConnectResult =
  | 'granted'         // we have at least the data we need
  | 'denied'          // user dismissed / granted nothing usable
  | 'needs-install'   // Health Connect app not installed
  | 'needs-update'    // Health Connect needs updating
  | 'unavailable'     // device/SDK can't support it

// Open the Health Connect permission UI directly (in-app, no device Settings
// digging). Used as a fallback when the user previously denied — Android won't
// re-show the popup, but this jumps straight to the right screen.
export function openHealthPermissionUI(): void {
  try {
    openHealthConnectSettings()
  } catch {
    // no-op — module unavailable
  }
}
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

// Detailed connect flow: initializes Health Connect, then requests permissions —
// returning a status the UI can act on. The app targets Android 14+ where Health
// Connect is built into the OS, so install/update states are rare safety nets.
export async function connectHealthConnect(): Promise<HealthConnectResult> {
  try {
    const status = await getSdkStatus()
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'needs-install'
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update'

    const ok = await initialize()
    if (!ok) return 'unavailable'

    const granted = await requestPermission(REQUIRED_PERMISSIONS)
    // Usable if we got the core movement data — steps OR distance. Heart rate /
    // exercise-session are nice-to-have, so don't fail the whole flow on them.
    const types = granted.map((g: { recordType: string }) => g.recordType)
    const usable = types.includes('Steps') || types.includes('Distance')
    return usable ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

// Back-compat boolean wrapper.
export async function initHealthConnect(): Promise<boolean> {
  return (await connectHealthConnect()) === 'granted'
}

// ---------------------------------------------------------------------------
// Read the most recent completed exercise session
// ---------------------------------------------------------------------------
// Returns null if no session found or permissions are missing.
// We always read the most recent session — the player explicitly taps
// "Sync Run" after their run, so the last session is the intended one.

// Fallback when there's no recorded ExerciseSession: aggregate raw Steps +
// Distance over the last 24h. Lets people who just walk (no started workout)
// still sync. Returns null only if there's truly no meaningful activity.
async function readDailyActivity(): Promise<HealthConnectSession | null> {
  try {
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const end = new Date().toISOString()

    const [stepsResult, distanceResult] = await Promise.all([
      readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: start, endTime: end } }),
      readRecords('Distance', { timeRangeFilter: { operator: 'between', startTime: start, endTime: end } }),
    ])

    const steps = (stepsResult.records as Array<{ count: number }>)
      .reduce((sum, r) => sum + (r.count ?? 0), 0)
    const distanceMeters = (distanceResult.records as Array<{ distance?: { inMeters?: number } }>)
      .reduce((sum, r) => sum + (r.distance?.inMeters ?? 0), 0)

    // Require some real movement (steps OR ≥100m) to count as a sync.
    if (steps < 100 && distanceMeters < 100) return null

    // Estimate distance from steps if Health Connect has steps but no distance
    // record (~0.762 m per step average stride).
    const effectiveDistance = distanceMeters >= 100 ? distanceMeters : steps * 0.762

    return {
      startTime: start,
      endTime: end,
      distanceMeters: effectiveDistance,
      steps,
      avgHeartRateBpm: null,
    }
  } catch {
    return null
  }
}

export async function readLastRun(): Promise<HealthConnectSession | null> {
  try {
    // Look back 48 hours to catch runs done the day before syncing
    const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const endTime = new Date().toISOString()

    const sessionResult = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })

    const sessions = sessionResult.records
    // No recorded workout? Fall back to raw steps/distance from the last 24h so
    // walkers (who don't start an "exercise session") can still sync.
    if (!sessions || sessions.length === 0) {
      return readDailyActivity()
    }

    // Most recent session is last in the array
    const session = sessions[sessions.length - 1]
    if (!session) return readDailyActivity()

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
