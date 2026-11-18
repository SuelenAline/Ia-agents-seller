module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: { "^@seller/domain$": "<rootDir>/packages/domain/src" },
  testTimeout: 15000,
};
