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
  aggregateRecord,
  openHealthConnectSettings,
  getSdkStatus,
  SdkAvailabilityStatus,
  ExerciseType,
} from 'react-native-health-connect'
import { Linking } from 'react-native'

// Result of attempting to connect Health Connect, so the UI can guide the user
// instead of just showing a vague success/fail.
export type HealthConnectResult =
  | 'granted'         // we have at least the data we need
  | 'denied'          // user dismissed / granted nothing usable
  | 'needs-install'   // Health Connect app not installed
  | 'needs-update'    // Health Connect needs updating
  | 'unavailable'     // device/SDK can't support it

// Open Aeternum's own page in Health Connect's permission settings. Used after
// the user denied — Android won't re-show the popup. Falls back to the general
// Health Connect settings if the system intent isn't handled.
export function openHealthPermissionUI(): void {
  Linking.sendIntent('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS', [
    { key: 'android.intent.extra.PACKAGE_NAME', value: 'com.aeternum.app' },
  ]).catch(() => {
    try {
      openHealthConnectSettings()
    } catch {
      // no-op — module unavailable
    }
  })
}

// Only runs count. Other workouts (cycling, yoga, walks) would fail the pace
// checks or award running stats for something else.
const RUN_TYPES: number[] = [ExerciseType.RUNNING, ExerciseType.RUNNING_TREADMILL]
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

// Usable if we can see the workout, its distance and steps (resolve-run
// requires all three). Heart rate is nice-to-have. Shared by connect and check so "Connected" in the UI always
// means Sync will actually run.
function hasUsableGrant(granted: Array<{ recordType: string }>): boolean {
  const types = granted.map(g => g.recordType)
  return ['ExerciseSession', 'Distance', 'Steps'].every(t => types.includes(t))
}

// ---------------------------------------------------------------------------
// Check existing grants (safe to call from any context — no dialog)
// ---------------------------------------------------------------------------

export async function checkHealthConnect(): Promise<boolean> {
  try {
    const isAvailable = await initialize()
    if (!isAvailable) return false

    const granted = await getGrantedPermissions()
    return hasUsableGrant(granted)
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
    return hasUsableGrant(granted) ? 'granted' : 'denied'
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

export async function readLastRun(): Promise<HealthConnectSession | null> {
  try {
    // Look back 48 hours to catch runs done the day before syncing
    const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const endTime = new Date().toISOString()

    const sessionResult = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })

    // Records aren't guaranteed to be ordered — pick the latest by end time.
    const sessions = (sessionResult.records ?? []).filter(r => RUN_TYPES.includes(r.exerciseType)).sort(
      (a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime(),
    )
    const session = sessions[sessions.length - 1]
    if (!session) return null

    const sessionStart = session.startTime as string
    const sessionEnd = session.endTime as string
    const window = { operator: 'between' as const, startTime: sessionStart, endTime: sessionEnd }

    // aggregateRecord de-duplicates overlapping sources (phone + watch + Samsung
    // Health all writing the same run); summing raw records double-counts.
    // Heart rate is an optional grant, so a failure there isn't fatal.
    const [steps, distance, heartRateResult] = await Promise.all([
      aggregateRecord({ recordType: 'Steps', timeRangeFilter: window }),
      aggregateRecord({ recordType: 'Distance', timeRangeFilter: window }),
      readRecords('HeartRate', { timeRangeFilter: window }).catch(() => ({ records: [] })),
    ])

    const totalSteps = steps?.COUNT_TOTAL ?? 0
    const totalDistanceMeters = distance?.DISTANCE?.inMeters ?? 0

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
