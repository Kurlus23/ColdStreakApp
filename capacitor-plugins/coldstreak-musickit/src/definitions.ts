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
}
