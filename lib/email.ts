import { Resend } from 'resend';
import { isFeatureEnabled } from './feature-gates';

let _resend: Resend | null = null;

/** Gated: true when Resend feature gate AND RESEND_API_KEY are set. Delegates to centralized feature-gates. */
export function isResendConfigured(): boolean {
  return isFeatureEnabled('email') && !!process.env.RESEND_API_KEY;
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
