import { registerPlugin } from "@capacitor/core";
import type { ColdstreakMusickitPlugin } from "./definitions";

const ColdstreakMusickit = registerPlugin<ColdstreakMusickitPlugin>(
  "ColdstreakMusickit",
  {
    // Web fallback — this plugin is iOS-only. The web path uses MusicKit JS
    // (see client/src/lib/appleMusic.ts).
    web: () => ({
      requestAuthorization: async () => {
        throw new Error("ColdstreakMusickit is iOS-only");
      },
      getUserToken: async () => {
        throw new Error("ColdstreakMusickit is iOS-only");
      },
    }),
  },
);

export * from "./definitions";
export { ColdstreakMusickit };
