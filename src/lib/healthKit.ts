// =============================================================================
// Aeternum — HealthKit Interface (iOS)
// =============================================================================
// Wraps react-native-health for iOS. Uses dynamic require so the module is
// never evaluated on Android (where it does not exist).
//
// After install: run `npx pod-install` in the ios/ directory, then add the
// following keys to ios/Aeternum/Info.plist:
//   NSHealthShareUsageDescription — "Aeternum reads your workouts to sync runs"
//   NSHealthUpdateUsageDescription — "Aeternum does not write health data"
// =============================================================================

import type { HealthConnectSession } from '@/types'

type AppleHealthKitType = {
  initHealthKit: (options: object, callback: (err: string | null) => void) => void
  getSamples: (options: object, callback: (err: string | null, results: any[]) => void) => void
  getWorkouts: (options: object, callback: (err: string | null, results: any[]) => void) => void
  getStepCount: (options: object, callback: (err: string | null, result: any) => void) => void
  getHeartRateSamples: (options: object, callback: (err: string | null, results: any[]) => void) => void
  Constants: {
    Permissions: Record<string, string>
  }
}

let AppleHealthKit: AppleHealthKitType | null = null

try {
  // Dynamic require — only resolves on iOS with the package installed.
  // On Android (or if the package is missing), this silently fails.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AppleHealthKit = require('react-native-health').default
} catch {
  // Package not installed — iOS health sync will be unavailable
}

const HEALTH_PERMISSIONS = {
  permissions: {
    read: ['Steps', 'DistanceWalkingRunning', 'HeartRate', 'Workout', 'ActiveEnergyBurned'],
    write: [],
  },
}

export async function initHealthKit(): Promise<boolean> {
  if (!AppleHealthKit) return false
  return new Promise((resolve) => {
    AppleHealthKit!.initHealthKit(HEALTH_PERMISSIONS, (err) => {
      resolve(!err)
    })
  })
}

export async function readLastRunIOS(): Promise<HealthConnectSession | null> {
  if (!AppleHealthKit) return null

  const startDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const endDate = new Date().toISOString()

  return new Promise((resolve) => {
    AppleHealthKit!.getWorkouts({ startDate, endDate }, (err, workouts) => {
      if (err || !workouts || workouts.length === 0) {
        resolve(null)
        return
      }

      // Most recent workout
      const workout = workouts[workouts.length - 1]
      const sessionStart: string = workout.start || workout.startDate
      const sessionEnd: string = workout.end || workout.endDate

      const distanceMeters = (workout.distance ?? 0) * 1000

      if (distanceMeters < 100) {
        resolve(null)
        return
      }

      // Fetch steps within the session window
      AppleHealthKit!.getStepCount(
        { startDate: sessionStart, endDate: sessionEnd },
        (stepErr, stepResult) => {
          const steps = stepErr ? 0 : (stepResult?.value ?? 0)

          // Fetch heart rate within the session window
          AppleHealthKit!.getHeartRateSamples(
            { startDate: sessionStart, endDate: sessionEnd, ascending: false, limit: 1000 },
            (hrErr, hrSamples) => {
              let avgHeartRateBpm: number | null = null
              if (!hrErr && hrSamples && hrSamples.length > 0) {
                const total = hrSamples.reduce((sum: number, s: any) => sum + (s.value ?? 0), 0)
                avgHeartRateBpm = Math.round(total / hrSamples.length)
              }

              resolve({
                startTime: sessionStart,
                endTime: sessionEnd,
                distanceMeters,
                steps,
                avgHeartRateBpm,
              })
            },
          )
        },
      )
    })
  })
}
