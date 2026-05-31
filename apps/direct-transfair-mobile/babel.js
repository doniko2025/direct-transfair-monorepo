// apps/direct-transfair-mobile/babel.js
// =========================================================
// BABEL CONFIG
// ✅ react-native-reanimated/plugin DOIT être en dernier
//    (exigence officielle de la lib reanimated)
// ✅ react-native-reanimated/plugin reste ICI dans babel,
//    PAS dans app.json plugins Expo
// =========================================================

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // ⚠️ react-native-reanimated/plugin DOIT être en dernier
      "react-native-reanimated/plugin",
    ],
  };
};