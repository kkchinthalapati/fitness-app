import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fitness.app",
  appName: "Fitness App",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    // Camera permissions handled via AndroidManifest
  },
};

export default config;
