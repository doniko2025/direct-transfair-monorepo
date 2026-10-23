// apps/backend/jest.config.js
// Tests unitaires du backend : `pnpm --filter direct-transfair-backend test`.
// Les specs (src/**/*.spec.ts) construisent les services avec des doubles : aucune base de données requise.
module.exports = {
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, diagnostics: false, tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
};
