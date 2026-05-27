// apps/direct-transfair-mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // ✅ react-native-reanimated DOIT être en dernier
      "react-native-reanimated/plugin",
    ],
  };
};