// =============================================================================
// Aeternum — Unified Health API
// =============================================================================
// Platform-aware façade. Callers import from this file only — never directly
// from healthConnect.ts (Android) or healthKit.ts (iOS).
// =============================================================================

import { Platform } from 'react-native'
import type { HealthConnectSession } from '@/types'

// Request permissions — only call from a user-triggered interaction (button press etc.)
// On Android this launches the Health Connect permission dialog via ActivityResultLauncher.
// Calling it from a background useEffect will crash.
export async function initHealth(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const { initHealthConnect } = await import('./healthConnect')
    return initHealthConnect()
  }
  if (Platform.OS === 'ios') {
    const { initHealthKit } = await import('./healthKit')
    return initHealthKit()
  }
  return false
}

// Check existing grants without showing a dialog — safe to call from anywhere.
export async function checkHealth(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const { checkHealthConnect } = await import('./healthConnect')
    return checkHealthConnect()
  }
  if (Platform.OS === 'ios') {
    const { initHealthKit } = await import('./healthKit')
    return initHealthKit() // HealthKit init is safe to call repeatedly without a dialog
  }
  return false
}

export async function readLastRun(): Promise<HealthConnectSession | null> {
  if (Platform.OS === 'android') {
    const { readLastRun: readAndroid } = await import('./healthConnect')
    return readAndroid()
  }
  if (Platform.OS === 'ios') {
    const { readLastRunIOS } = await import('./healthKit')
    return readLastRunIOS()
  }
  return null
}
