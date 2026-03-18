import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coldstreak.app",
  appName: "ColdStreak",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    url: "https://coldstreakapp.com",
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0f1f3d",
      showSpinner: false,
    },
  },
};

export default config;
