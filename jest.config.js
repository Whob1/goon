module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'tests/**/*.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true
};