export type ColdstreakMusickitAuthStatus =
  | "authorized"
  | "denied"
  | "restricted"
  | "notDetermined"
  | "unknown";

export interface ColdstreakMusickitPlugin {
  /** Triggers the iOS Apple Music permission prompt (one-time per install). */
  requestAuthorization(): Promise<{
    status: ColdstreakMusickitAuthStatus;
    authorized: boolean;
  }>;

  /**
   * Exchanges the server-issued developer token for a per-user
   * music-user-token. Must be called after requestAuthorization() resolves
   * with authorized: true.
   */
  getUserToken(opts: { developerToken: string }): Promise<{ userToken: string }>;

  /**
   * Plays an Apple Music playlist via iOS's `ApplicationMusicPlayer`.
   * Accepts either a catalog URL (music.apple.com/<country>/playlist/...)
   * or a library URL (music.apple.com/library/playlist/...). The plugin
   * auto-prompts for Apple Music permission if needed.
   */
  playPlaylist(opts: { url: string }): Promise<{ played: boolean }>;
}
