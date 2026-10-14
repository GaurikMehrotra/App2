module.exports = {
  preset: "jest-expo",
  rootDir: ".",
  testMatch: ["**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo.*|@expo(nent)?/.*|expo-router|@app2/.*|react-native-url-polyfill|react-native-safe-area-context|react-native-screens)/)",
  ],
};
