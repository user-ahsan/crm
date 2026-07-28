/**
 * CSRF / Origin Validation Utility
 *
 * Validates that incoming mutation requests (POST, PUT, PATCH, DELETE)
 * originate from the same origin as the server. This prevents CSRF
 * attacks where an external site tricks a user into submitting requests
 * against the API.
 *
 * Usage:
 *   import { validateCsrf } from '@/lib/csrf';
 *
 *   export async function POST(request: NextRequest) {
 *     if (!validateCsrf(request)) {
 *       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 *     }
 *     // ...
 *   }
 *
 * 🔒 SECURITY NOTES:
 *   - In production, the ALLOWED_ORIGIN environment variable should be set
 *     to the application's canonical URL (e.g., https://app.example.com).
 *   - If ALLOWED_ORIGIN is not set, the check falls back to matching the
 *     request's Origin header against the Host header (same-origin check).
 *   - Requests without an Origin header are blocked because browser
 *     same-origin requests always include it for POST/PUT/DELETE.
 */

export function validateCsrf(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // If ALLOWED_ORIGIN is configured, use it as the single allowed value
  const allowedOrigin = process.env.CORS_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;

  if (allowedOrigin) {
    return origin === allowedOrigin;
  }

  // Fallback: validate that origin matches the Host header
  if (!origin || !host) {
    return false;
  }

  // Parse the origin to extract host (strips protocol and port)
  try {
    const originUrl = new URL(origin);
    // Accept same-origin requests (origin host matches host header)
    // Also accept localhost in development
    if (originUrl.host === host) {
      return true;
    }
    // Allow localhost origins in non-production
    if (
      process.env.NODE_ENV !== 'production' &&
      (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
