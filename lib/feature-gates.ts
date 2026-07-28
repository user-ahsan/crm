/**
 * ─── Centralized Feature-Gate System ─────────────────────────────────────
 *
 * Single source of truth for ALL external-service feature gates.
 * Every feature must gracefully degrade when its gate is off so the dev
 * environment runs with ZERO external dependencies.
 *
 * Usage (server-side only — client components should NOT call directly):
 *
 *   // In an API route handler:
 *   const gate = withFeatureGate('calendar_sync');
 *   if (gate) return gate;
 *
 *   // In a service:
 *   if (!isFeatureEnabled('email')) return fallback;
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';

// ── Gate identifiers ───────────────────────────────────────────────────

export type FeatureGate =
  | 'email'               // Resend — NEXT_PUBLIC_ENABLE_EMAIL
  | 'sms'                 // Twilio — NEXT_PUBLIC_ENABLE_SMS
  | 'webhooks'            // n8n — NEXT_PUBLIC_ENABLE_WEBHOOKS
  | 'email_sequences'     // Campaign scheduler — NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES
  | 'workflow_editor'     // Visual workflow editor — NEXT_PUBLIC_ENABLE_WORKFLOW_EDITOR
  | 'calendar_sync'       // Google Calendar OAuth — NEXT_PUBLIC_ENABLE_CALENDAR_SYNC
  | 'portal'              // Portal auth — NEXT_PUBLIC_ENABLE_PORTAL
  | 'realtime'            // WebSocket push — NEXT_PUBLIC_ENABLE_REALTIME
  | 'invoices'            // Invoice pages — NEXT_PUBLIC_ENABLE_INVOICES
  | 'standalone_invoice'; // Standalone invoice form — NEXT_PUBLIC_ENABLE_STANDALONE_INVOICE

// ── Env-var mapping ────────────────────────────────────────────────────

const ENV_MAP: Record<FeatureGate, string> = {
  email: 'NEXT_PUBLIC_ENABLE_EMAIL',
  sms: 'NEXT_PUBLIC_ENABLE_SMS',
  webhooks: 'NEXT_PUBLIC_ENABLE_WEBHOOKS',
  email_sequences: 'NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES',
  workflow_editor: 'NEXT_PUBLIC_ENABLE_WORKFLOW_EDITOR',
  calendar_sync: 'NEXT_PUBLIC_ENABLE_CALENDAR_SYNC',
  portal: 'NEXT_PUBLIC_ENABLE_PORTAL',
  realtime: 'NEXT_PUBLIC_ENABLE_REALTIME',
  invoices: 'NEXT_PUBLIC_ENABLE_INVOICES',
  standalone_invoice: 'NEXT_PUBLIC_ENABLE_STANDALONE_INVOICE',
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Single source of truth — checks whether a feature gate is enabled.
 *
 * Reads the corresponding `NEXT_PUBLIC_ENABLE_*` env var and returns
 * `true` only when the value is exactly `"true"` (case-insensitive).
 * Defaults to `false` (disabled) when the var is unset or any other value.
 *
 * This is a SERVER-ONLY check. Client components should not call this
 * directly — guard UI components server-side or use the hook equivalent.
 */
export function isFeatureEnabled(gate: FeatureGate): boolean {
  return process.env[ENV_MAP[gate]]?.toLowerCase() === 'true';
}

/**
 * For API routes: returns a 501 JSON response immediately if the feature
 * is disabled. Use as the first check in a route handler:
 *
 *   const gate = withFeatureGate('calendar_sync');
 *   if (gate) return gate;
 *
 * Returns `null` when the feature IS enabled (safe to proceed).
 */
export function withFeatureGate(gate: FeatureGate): NextResponse | null {
  if (!isFeatureEnabled(gate)) {
    return NextResponse.json(
      {
        success: false,
        error: `Feature "${gate}" is not enabled. Set ${ENV_MAP[gate]}=true in your environment.`,
        feature: gate,
        env_var: ENV_MAP[gate],
      },
      { status: 501, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return null;
}
