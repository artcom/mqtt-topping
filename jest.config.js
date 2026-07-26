export default {
  testEnvironment: "node",
  clearMocks: true,
  restoreMocks: true,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { rootDir: "." } }],
  },
}
