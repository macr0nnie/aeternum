// =============================================================================
// Aeternum — Unified Health API
// =============================================================================
// Platform-aware façade. Callers import from this file only — never directly
// from healthConnect.ts (Android) or healthKit.ts (iOS).
// =============================================================================

import { Platform } from 'react-native'
import type { HealthConnectSession } from '@/types'

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
