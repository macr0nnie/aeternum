const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname)

// React Native Skia requires wasm and worklet support in Metro
config.resolver.assetExts.push('wasm')
config.resolver.sourceExts.push('mjs')

module.exports = config