module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 ships its Babel transform via react-native-worklets.
      // Must remain the last plugin in the list.
      'react-native-worklets/plugin',
    ],
  }
}
