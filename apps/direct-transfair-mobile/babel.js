// apps/direct-transfair-mobile/babel.js
// =========================================================
// BABEL CONFIG — SDK 54 / reanimated v4
// babel-preset-expo gère le plugin reanimated automatiquement.
// Ne PAS rajouter le plugin à la main (sinon "duplicate plugin").
// =========================================================

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};