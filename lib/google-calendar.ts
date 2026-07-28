/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — Future feature: Google Calendar OAuth integration.
// Package version conflicts with google-auth-library/googleapis types.
// Remove this line once types are resolved or packages are updated.
/* eslint-enable @typescript-eslint/ban-ts-comment */
/**
 * ─── Google Calendar OAuth & API Helpers ────────────────────────────────────
 *
 * Token encryption: Uses AES-256-GCM with a key derived from
 * GOOGLE_TOKEN_ENCRYPTION_KEY (or SUPABASE_SERVICE_ROLE_KEY as fallback).
 * All token I/O goes through the calendar_integrations table.
 *
 * Server-only module — never import from client code.
 * ───────────────────────────────────────────────────────────────────────────
 */

import crypto from 'node:crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toServiceError } from '@/services/supabase.service';

// Dynamic imports for heavy packages (server-only, lazy-loaded)
let _OAuth2Client: typeof import('google-auth-library').OAuth2Client | null = null;
let _google: typeof import('googleapis').google | null = null;

async function getGoogleApis() {
  if (!_OAuth2Client) {
    const mod = await import('google-auth-library');
    _OAuth2Client = mod.OAuth2Client;
  }
  return _OAuth2Client!;
}

async function getGoogleCalendar() {
  if (!_google) {
    const mod = await import('googleapis');
    _google = mod.google;
  }
  return _google!;
}

// ── Crypto helpers (AES-256-GCM) ─────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    throw new Error(
      'Missing GOOGLE_TOKEN_ENCRYPTION_KEY env var — tokens cannot be encrypted',
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── OAuth2 Client factory ────────────────────────────────────────────────

let _oauth2Client: import('google-auth-library').OAuth2Client | null = null;

async function getOAuth2Client(): Promise<import('google-auth-library').OAuth2Client> {
  if (_oauth2Client) return _oauth2Client;

  const OAuth2Client = await getGoogleApis();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    'http://localhost:3000/api/integrations/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables',
    );
  }

  _oauth2Client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  return _oauth2Client;
}

// ── Token types ──────────────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
}

// ── Token storage ────────────────────────────────────────────────────────

/**
 * Retrieve a user's Google OAuth tokens from the database.
 * Returns `null` if no integration or tokens exist for the user.
 */
export async function getStoredTokens(
  userId: string,
): Promise<GoogleTokens | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('created_by', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (error) throw toServiceError(error);
  if (!data || !data.access_token) return null;

  const accessToken = decrypt(data.access_token);
  const refreshToken = data.refresh_token
    ? decrypt(data.refresh_token)
    : null;
  const expiryDate = data.expires_at
    ? new Date(data.expires_at).getTime()
    : null;

  return { accessToken, refreshToken, expiryDate };
}

/**
 * Save Google OAuth tokens to the database.
 * Creates or updates the calendar_integrations record for this user.
 */
export async function storeTokens(
  userId: string,
  tokens: GoogleTokens & { email: string },
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const encryptedAccess = encrypt(tokens.accessToken);
  const encryptedRefresh = tokens.refreshToken
    ? encrypt(tokens.refreshToken)
    : null;
  const expiresAt = tokens.expiryDate
    ? new Date(tokens.expiryDate).toISOString()
    : null;

  // Check if a google integration already exists for this user
  const { data: existing } = await supabase
    .from('calendar_integrations')
    .select('id')
    .eq('created_by', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('calendar_integrations')
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        email: tokens.email,
      })
      .eq('id', existing.id);

    if (error) throw toServiceError(error);
  } else {
    const { error } = await supabase.from('calendar_integrations').insert({
      provider: 'google',
      email: tokens.email,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      sync_enabled: true,
      created_by: userId,
    });

    if (error) throw toServiceError(error);
  }
}

/**
 * Remove stored tokens for a user's Google Calendar integration.
 */
export async function deleteStoredTokens(userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('calendar_integrations')
    .delete()
    .eq('created_by', userId)
    .eq('provider', 'google');

  if (error) throw toServiceError(error);
}

// ── Auth client factory ──────────────────────────────────────────────────

/**
 * Get an authenticated OAuth2Client for the given user.
 * Automatically refreshes the access token if it has expired.
 */
export async function getGoogleAuthClient(
  userId: string,
): Promise<import('google-auth-library').OAuth2Client> {
  const tokens = await getStoredTokens(userId);
  if (!tokens) {
    throw new Error(
      'No Google Calendar integration found — connect a Google account first',
    );
  }

  const auth = await getOAuth2Client();
  auth.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: tokens.expiryDate ?? undefined,
  });

  // If the token is expired, attempt a refresh
  if (tokens.expiryDate && Date.now() >= tokens.expiryDate) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      if (credentials.access_token) {
        // Preserve existing email by re-reading from stored tokens
        await storeTokens(userId, {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token ?? tokens.refreshToken,
          expiryDate: credentials.expiry_date ?? null,
          email: '',
        });
      }
    } catch (e) {
      throw new Error(
        `Google token refresh failed: ${e instanceof Error ? e.message : 'Unknown error'}. Reconnect your account.`,
      );
    }
  }

  return auth;
}

// ── OAuth URL generation ─────────────────────────────────────────────────

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Generate the Google OAuth consent URL.
 */
export async function getGoogleAuthUrl(state?: string): Promise<string> {
  const auth = await getOAuth2Client();
  return auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
    include_granted_scopes: true,
  });
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ tokens: GoogleTokens; email: string }> {
  const auth = await getOAuth2Client();
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  if (!tokens.access_token) {
    throw new Error('No access token returned from Google');
  }

  // Fetch user email from the token info endpoint
  let email = '';
  try {
    const google = await getGoogleCalendar();
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const { data: tokenInfo } = await oauth2.userinfo.get();
    email = tokenInfo.email ?? '';
  } catch {
    // email may not be available — that's acceptable
  }

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
    },
    email,
  };
}

/**
 * Revoke Google OAuth tokens for a user.
 */
export async function revokeGoogleTokens(userId: string): Promise<void> {
  const tokens = await getStoredTokens(userId);
  if (!tokens) return;

  try {
    const auth = await getOAuth2Client();
    auth.setCredentials({ access_token: tokens.accessToken });
    await auth.revokeToken(tokens.accessToken);
  } catch {
    // revoke failure is non-fatal — we still remove local tokens
  }

  await deleteStoredTokens(userId);
}

// ── Calendar API helpers ─────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  htmlLink: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch upcoming events from the user's primary Google Calendar.
 */
export async function listEvents(
  userId: string,
  maxResults: number = 50,
  timeMin?: string,
): Promise<CalendarEvent[]> {
  const auth = await getGoogleAuthClient(userId);
  const google = await getGoogleCalendar();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: 'primary',
    maxResults,
    timeMin: timeMin ?? new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items ?? [];
  return events.map(mapGoogleEvent);
}

/**
 * Create an event on the user's primary Google Calendar.
 */
export async function createEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
  },
): Promise<CalendarEvent> {
  const auth = await getGoogleAuthClient(userId);
  const google = await getGoogleCalendar();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return mapGoogleEvent(response.data);
}

/**
 * Sync events from Google Calendar into the local database.
 * Returns the list of events that were upserted.
 */
export async function syncEvents(
  userId: string,
  integrationId: string,
): Promise<CalendarEvent[]> {
  const events = await listEvents(userId, 250);
  const supabase = await createServerSupabaseClient();

  for (const event of events) {
    const { error } = await supabase.from('meetings').upsert(
      {
        id: `google-${event.id}`,
        title: event.summary,
        participants: [],
        date_time:
          'dateTime' in event.start
            ? event.start.dateTime
            : event.start.date,
        duration: 60,
        type: 'meeting',
        notes: event.description,
        outcome: null,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.error(`[google-calendar] sync error for event ${event.id}:`, error);
    }
  }

  // Update last_synced_at
  await supabase
    .from('calendar_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integrationId);

  return events;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function mapGoogleEvent(item: Record<string, unknown>): CalendarEvent {
  return {
    id: String(item.id ?? ''),
    summary: String(item.summary ?? '(no title)'),
    description: item.description ? String(item.description) : null,
    start: item.start as CalendarEvent['start'],
    end: item.end as CalendarEvent['end'],
    htmlLink: String(item.htmlLink ?? ''),
    status: String(item.status ?? 'confirmed'),
    createdAt: String(item.created ?? new Date().toISOString()),
    updatedAt: String(item.updated ?? new Date().toISOString()),
  };
}
