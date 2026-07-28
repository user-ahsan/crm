/**
 * ─── Twilio Client Wrapper (Server-Only) ──────────────────────────────
 *
 * Dynamic import so it never gets bundled into client chunks.
 * Call from server code only — client callers get a clear error message.
 *
 * Client-safe config functions (isTwilioConfigured, getTwilioFromNumber)
 * are re-exported from ./twilio-config for backward compatibility.
 * ────────────────────────────────────────────────────────────────────────
 */

export { getTwilioFromNumber, isTwilioConfigured } from './twilio-config';

export async function getTwilioClientAsync(): Promise<{
  messages: {
    create: (opts: {
      body: string;
      from: string;
      to: string;
    }) => Promise<{ sid: string; status: string; errorCode: number | null; errorMessage: string | null }>;
  };
}> {
  // Guard: refuse to pretend we can use Twilio on the browser
  if (typeof window !== 'undefined') {
    throw new Error('Twilio client is server-only. Call /api/sms/send instead.');
  }
  try {
    const twilio = await import('twilio');
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN env vars');
    return twilio.default(sid, token);
  } catch (e) {
    throw e;
  }
}
