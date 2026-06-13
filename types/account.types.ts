/* ── Account / Current User Types ──────────────────────────── */

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  /** URL or null */
  avatarUrl: string | null;
}
