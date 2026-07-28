/**
 * Returns CORS headers with origin validated against the allowlist.
 *
 * In production, set the CORS_ORIGIN environment variable to your
 * application's origin (e.g. 'https://app.example.com').
 * In development, it defaults to 'http://localhost:3000'.
 *
 * Multiple origins are not supported — configure your reverse proxy
 * (nginx, Cloudflare, etc.) to handle multi-origin CORS if needed.
 */
export function corsHeaders(): Record<string, string> {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}
