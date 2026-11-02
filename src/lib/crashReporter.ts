// =============================================================================
// Aeternum — Crash Reporter
// =============================================================================
// A thin, pluggable crash/exception sink. Today it logs errors. When you're ready, set a real reporter
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

let reporter: CrashReporter | null = null

export function setCrashReporter(r: CrashReporter | null): void {
  reporter = r
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  // Always log; forward to the real reporter when one is configured.
  console.error('[crash]', message, context ?? '')
  try {
    reporter?.capture(error, context)
  } catch {
    // Never let the reporter itself throw.
  }
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
