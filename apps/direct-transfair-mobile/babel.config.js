// apps/direct-transfair-mobile/babel.config.js
// =========================================================
// BABEL CONFIG — Expo SDK 56 / reanimated v4 (le fichier DOIT s'appeler babel.config.js pour être lu par Metro)
// babel-preset-expo gère le plugin reanimated automatiquement.
// Ne PAS rajouter le plugin à la main (sinon "duplicate plugin").
// =========================================================

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};