// =============================================================================
// Aeternum — Error Boundary
// =============================================================================
// Catches render/lifecycle errors anywhere in the subtree and shows a
// recoverable fallback instead of letting a single crash break the whole app.
// =============================================================================

import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { COLORS, FONTS, FONT_SIZES, SPACING, LETTER_SPACING } from '@/theme/tokens'
import { captureException } from '@/lib/crashReporter'

interface Props {
  children: React.ReactNode
  /** Optional label so we can tell which boundary tripped. */
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Forward to the crash reporter (logs now; Sentry later when configured).
    captureException(error, {
      boundary: this.props.label ?? 'unknown',
      componentStack: info.componentStack,
    })
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>SYSTEM FAULT</Text>
          <Text style={styles.subtitle}>
            Something glitched while rendering. Your progress is safe.
          </Text>
          <Text style={styles.message} numberOfLines={6}>
            {error.message || String(error)}
          </Text>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>RETRY</Text>
          </Pressable>
        </ScrollView>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xl,
    color: COLORS.warning,
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  message: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  button: {
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 2,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  buttonText: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
    letterSpacing: LETTER_SPACING.wide,
  },
})
