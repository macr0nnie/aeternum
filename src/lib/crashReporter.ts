// =============================================================================
// Aeternum — Crash Reporter
// =============================================================================
// A thin, pluggable crash/exception sink. Today it logs and buffers the last N
// errors (viewable in-app for alpha). When you're ready, set a real reporter
// (Sentry, etc.) via `setCrashReporter` — no call sites change.
//
// To wire Sentry later:
//   import * as Sentry from '@sentry/react-native'
//   Sentry.init({ dsn: '…' })
//   setCrashReporter({ capture: (e, ctx) => Sentry.captureException(e, { extra: ctx }) })
// =============================================================================

export interface CrashReporter {
  capture: (error: unknown, context?: Record<string, unknown>) => void
}

interface BufferedError {
  at: string
  message: string
  context?: Record<string, unknown>
}

// Ring buffer of recent errors so alpha testers/devs can inspect them in-app.
const recent: BufferedError[] = []
const MAX_BUFFERED = 25

let reporter: CrashReporter | null = null

export function setCrashReporter(r: CrashReporter | null): void {
  reporter = r
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  recent.unshift({ at: new Date().toISOString(), message, ...(context ? { context } : {}) })
  if (recent.length > MAX_BUFFERED) recent.pop()

  // Always log; forward to the real reporter when one is configured.
  console.error('[crash]', message, context ?? '')
  try {
    reporter?.capture(error, context)
  } catch {
    // Never let the reporter itself throw.
  }
}

export function getRecentErrors(): readonly BufferedError[] {
  return recent
}

// Install a global handler for unhandled promise rejections (RN exposes this
// via the HermesInternal / global `process`-like API). Call once at startup.
export function installGlobalHandlers(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => any; setGlobalHandler: (h: any) => void }
  }
  // Chain onto RN's global error handler so we still get the red box in dev.
  if (g.ErrorUtils?.getGlobalHandler && g.ErrorUtils.setGlobalHandler) {
    const prev = g.ErrorUtils.getGlobalHandler()
    g.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      captureException(error, { fatal: !!isFatal, source: 'global' })
      prev?.(error, isFatal)
    })
  }
}
