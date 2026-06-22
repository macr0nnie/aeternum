// =============================================================================
// Aeternum — Unified Health API
// =============================================================================
// Platform-aware façade. Callers import from this file only — never directly
// from healthConnect.ts (Android) or healthKit.ts (iOS).
// =============================================================================

import { Platform } from 'react-native'
import type { HealthConnectSession } from '@/types'

export type HealthConnectStatus =
  | 'granted' | 'denied' | 'needs-install' | 'needs-update' | 'unavailable'

// Detailed connect flow for the UI — returns a status so we can guide the user
// (install Health Connect, update it, retry, etc.). Call from a user gesture.
export async function connectHealth(): Promise<HealthConnectStatus> {
  try {
    if (Platform.OS === 'android') {
      const { connectHealthConnect } = await import('./healthConnect')
      return connectHealthConnect()
    }
    if (Platform.OS === 'ios') {
      const { initHealthKit } = await import('./healthKit')
      return (await initHealthKit()) ? 'granted' : 'denied'
    }
  } catch {
    return 'unavailable'
  }
  return 'unavailable'
}

// Request permissions — only call from a user-triggered interaction (button press etc.)
// On Android this launches the Health Connect permission dialog via ActivityResultLauncher.
// Calling it from a background useEffect will crash.
export async function initHealth(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const { initHealthConnect } = await import('./healthConnect')
      return initHealthConnect()
    }
    if (Platform.OS === 'ios') {
      const { initHealthKit } = await import('./healthKit')
      return initHealthKit()
    }
  } catch {
    // Native permission delegate not initialized or permission dialog failed
    return false
  }
  return false
}

// Open the platform's health-permission UI in-app (denial fallback — no device
// Settings digging).
export async function openHealthPermissions(): Promise<void> {
  if (Platform.OS === 'android') {
    const { openHealthPermissionUI } = await import('./healthConnect')
    openHealthPermissionUI()
  }
  // iOS has no deep link to the per-app Health screen — the request dialog is
  // the only entry point, so there is nothing to open.
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
