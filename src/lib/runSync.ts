// =============================================================================
// Aeternum — Run Sync Pipeline
// =============================================================================
// Orchestrates the full flow: Health Connect read → Supabase Edge Function.
//
// This module is the only place that knows about both Health Connect and
// Supabase. Screens call syncRun() and receive a resolved RunSession;
// they never touch the underlying APIs directly.
// =============================================================================

import { supabase } from '@/lib/supabase'
import { initHealthConnect, readLastRun } from '@/lib/healthConnect'
import type { SyncRunRequest, SyncRunResponse } from '@/types'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'HEALTH_CONNECT_UNAVAILABLE'
      | 'NO_SESSION_FOUND'
      | 'NOT_AUTHENTICATED'
      | 'EDGE_FUNCTION_FAILED'
      | 'NETWORK_ERROR',
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

// ---------------------------------------------------------------------------
// syncRun
// ---------------------------------------------------------------------------
// Full sync pipeline. Throws SyncError on any failure — callers should catch
// and present an appropriate UI message.

export async function syncRun(playerId: string): Promise<SyncRunResponse> {
  // 1. Initialise Health Connect and request permissions
  const ready = await initHealthConnect()
  if (!ready) {
    throw new SyncError(
      'Health Connect is not available or permissions were denied.',
      'HEALTH_CONNECT_UNAVAILABLE',
    )
  }

  // 2. Read the last completed session
  const session = await readLastRun()
  if (!session) {
    throw new SyncError(
      'No completed run session found in the last 48 hours. Complete a run first.',
      'NO_SESSION_FOUND',
    )
  }

  // 3. Verify the user is authenticated
  const { data: { session: authSession } } = await supabase.auth.getSession()
  if (!authSession) {
    throw new SyncError('Not authenticated. Please sign in.', 'NOT_AUTHENTICATED')
  }

  // 4. Build the request payload
  const durationSeconds = Math.round(
    (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000,
  )
  const distanceKm = session.distanceMeters / 1000

  const payload: SyncRunRequest = {
    player_id: playerId,
    mode: 'sync',
    distance_km: Number(distanceKm.toFixed(3)),
    duration_seconds: durationSeconds,
    steps: session.steps,
    started_at: session.startTime,
    ended_at: session.endTime,
    ...(session.avgHeartRateBpm !== null ? { avg_heart_rate: session.avgHeartRateBpm } : {}),
  }

  // 5. Call the Edge Function
  try {
    const { data, error } = await supabase.functions.invoke<SyncRunResponse>('resolve-run', {
      body: payload,
    })

    if (error) {
      throw new SyncError(
        `Edge function error: ${error.message}`,
        'EDGE_FUNCTION_FAILED',
      )
    }

    if (!data) {
      throw new SyncError('Empty response from server.', 'EDGE_FUNCTION_FAILED')
    }

    return data
  } catch (err) {
    if (err instanceof SyncError) throw err
    throw new SyncError(
      `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'NETWORK_ERROR',
    )
  }
}

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
// Utility for display — converts seconds to HH:MM:SS or MM:SS.

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// formatDistance
// ---------------------------------------------------------------------------

export function formatDistance(km: number): string {
  return `${km.toFixed(2)} km`
}

// ---------------------------------------------------------------------------
// formatPace
// ---------------------------------------------------------------------------
// Returns pace as MM:SS per km.

export function formatPace(distanceKm: number, durationSeconds: number): string {
  if (distanceKm === 0) return '--:--'
  const paceSeconds = durationSeconds / distanceKm
  const m = Math.floor(paceSeconds / 60)
  const s = Math.round(paceSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}
