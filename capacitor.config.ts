import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coldstreak.app",
  appName: "ColdStreak",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    iosScheme: "https",
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
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0f1f3d",
    minVersion: "15.0",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0f1f3d",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
