const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// React Native Skia requires wasm and worklet support in Metro
config.resolver.assetExts.push('wasm')
config.resolver.sourceExts.push('mjs')

module.exports = config
