import { Resend } from 'resend';

let _resend: Resend | null = null;

/** Gated: true when RESEND_API_KEY is set — controls whether email sends actually hit the Resend API. */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Resend client singleton. Throws only when called but not configured — guard with isResendConfigured() first. */
export function getResendClient(): Resend {
  if (!isResendConfigured()) {
    throw new Error('Cannot initialize Resend client: RESEND_API_KEY is not configured');
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}
