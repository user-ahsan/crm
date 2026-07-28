/**
 * ─── Twilio Configuration (Client-Safe) ────────────────────────────────
 *
 * Env-var readers only — NO twilio package import.
 * Safe to import from client components.
 * ────────────────────────────────────────────────────────────────────────
 */

import { isFeatureEnabled } from './feature-gates';

export function getTwilioFromNumber(): string {
  return process.env.TWILIO_FROM_NUMBER || '+15551234567';
}

export function isTwilioConfigured(): boolean {
  return isFeatureEnabled('sms') && !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
