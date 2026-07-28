/**
 * ponytail: thin Twilio client wrapper, dynamic import so it never
 * gets bundled into client chunks. Call from server code only —
 * client callers get a clear error message.
 */
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

export function getTwilioFromNumber(): string {
  return process.env.TWILIO_FROM_NUMBER || '+15551234567';
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
