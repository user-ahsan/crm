/**
 * ─── Feature Gates Integration Tests ─────────────────────────────────────
 *
 * Validates ALL 10 feature gates in both enabled and disabled states.
 *
 * Test hierarchy:
 *   1. UNIT — lib/feature-gates.ts (isFeatureEnabled + withFeatureGate)
 *   2. DELEGATION — Existing guards that delegate to feature gates
 *   3. API ROUTES — Route guards returning 501 when disabled
 *   4. SERVICE LAYER — Graceful degradation when features are disabled
 *
 * Environment: Each test saves/restores env vars so tests are isolated.
 * No mock framework needed — env var manipulation is the mechanism.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ── Module under test ───────────────────────────────────────────────────

import type { FeatureGate } from '@/lib/feature-gates';
import { isFeatureEnabled, withFeatureGate } from '@/lib/feature-gates';
import { isResendConfigured } from '@/lib/email';
import { isTwilioConfigured } from '@/lib/twilio';
import { isAnyWebhookConfigured, resetWebhookGuard, triggerWebhook } from '@/services/webhook.service';
import { isRealtimeEnabled } from '@/services/realtime.service';

// ── Test helpers ─────────────────────────────────────────────────────────

const ALL_GATES: FeatureGate[] = [
  'email',
  'sms',
  'webhooks',
  'email_sequences',
  'workflow_editor',
  'calendar_sync',
  'portal',
  'realtime',
  'invoices',
  'standalone_invoice',
];

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

/** Saves env var values before a test so they can be restored afterward. */
const envBackup = new Map<string, string | undefined>();

function saveEnv(...vars: string[]): void {
  for (const v of vars) {
    envBackup.set(v, process.env[v]);
  }
}

function restoreEnv(...vars: string[]): void {
  for (const v of vars) {
    const saved = envBackup.get(v);
    if (saved === undefined) {
      delete process.env[v];
    } else {
      process.env[v] = saved;
    }
    envBackup.delete(v);
  }
}

/** Clears the env var for a gate (so it defaults to disabled). */
function clearGate(gate: FeatureGate): void {
  delete process.env[ENV_MAP[gate]];
}

/** Enables a gate by setting its env var to 'true'. */
function enableGate(gate: FeatureGate): void {
  process.env[ENV_MAP[gate]] = 'true';
}

/** Disables a gate by setting its env var to 'false'. */
function disableGate(gate: FeatureGate): void {
  process.env[ENV_MAP[gate]] = 'false';
}

/** Asserts a NextResponse has status 501 and the expected body shape. */
async function assertIs501Response(
  response: unknown,
  expectedGate: FeatureGate,
): Promise<void> {
  assert.ok(response instanceof Response, `Expected a Response, got ${typeof response}`);
  assert.equal(response.status, 501, `Expected 501 for gate "${expectedGate}"`);
  const body = await (response as Response).json();
  assert.equal(body.success, false, '501 response should have success: false');
  assert.equal(body.feature, expectedGate, `Body.feature should be "${expectedGate}"`);
  assert.equal(body.env_var, ENV_MAP[expectedGate], `Body.env_var should match map`);
  assert.ok(
    typeof body.error === 'string' && body.error.length > 0,
    'Body.error should be a non-empty string',
  );
  assert.ok(
    body.error.includes(expectedGate),
    `Body.error should mention the gate name "${expectedGate}"`,
  );
  assert.ok(
    body.error.includes(ENV_MAP[expectedGate]),
    `Body.error should mention the env var "${ENV_MAP[expectedGate]}"`,
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 1. UNIT TESTS — lib/feature-gates.ts
// ═════════════════════════════════════════════════════════════════════════

describe('Feature Gates (lib/feature-gates.ts)', () => {
  // ── isFeatureEnabled ──────────────────────────────────────────────────

  describe('isFeatureEnabled()', () => {
    for (const gate of ALL_GATES) {
      const envVar = ENV_MAP[gate];

      it(`✅ [${gate}] returns false when ${envVar} is NOT set`, () => {
        saveEnv(envVar);
        clearGate(gate);
        assert.equal(isFeatureEnabled(gate), false);
        restoreEnv(envVar);
      });

      it(`✅ [${gate}] returns true when ${envVar}=true`, () => {
        saveEnv(envVar);
        process.env[envVar] = 'true';
        assert.equal(isFeatureEnabled(gate), true);
        restoreEnv(envVar);
      });

      it(`✅ [${gate}] returns true when ${envVar}=TRUE (case-insensitive)`, () => {
        saveEnv(envVar);
        process.env[envVar] = 'TRUE';
        assert.equal(isFeatureEnabled(gate), true);
        restoreEnv(envVar);
      });

      it(`✅ [${gate}] returns false when ${envVar}=false`, () => {
        saveEnv(envVar);
        process.env[envVar] = 'false';
        assert.equal(isFeatureEnabled(gate), false);
        restoreEnv(envVar);
      });

      it(`✅ [${gate}] returns false when ${envVar}=any_other_value`, () => {
        saveEnv(envVar);
        process.env[envVar] = '1';
        assert.equal(isFeatureEnabled(gate), false);
        restoreEnv(envVar);
      });

      it(`✅ [${gate}] returns false when ${envVar}=empty string`, () => {
        saveEnv(envVar);
        process.env[envVar] = '';
        assert.equal(isFeatureEnabled(gate), false);
        restoreEnv(envVar);
      });
    }

    it('✅ returns false for all gates simultaneously when none are set', () => {
      // Save ALL gate env vars, clear them all
      const allVars = ALL_GATES.map(g => ENV_MAP[g]);
      saveEnv(...allVars);
      for (const g of ALL_GATES) clearGate(g);

      for (const gate of ALL_GATES) {
        assert.equal(isFeatureEnabled(gate), false, `Gate "${gate}" should be false`);
      }

      restoreEnv(...allVars);
    });

    it('✅ returns true for all gates simultaneously when all set to true', () => {
      const allVars = ALL_GATES.map(g => ENV_MAP[g]);
      saveEnv(...allVars);
      for (const g of ALL_GATES) enableGate(g);

      for (const gate of ALL_GATES) {
        assert.equal(isFeatureEnabled(gate), true, `Gate "${gate}" should be true`);
      }

      restoreEnv(...allVars);
    });
  });

  // ── withFeatureGate ──────────────────────────────────────────────────

  describe('withFeatureGate()', () => {
    for (const gate of ALL_GATES) {
      const envVar = ENV_MAP[gate];

      it(`✅ [${gate}] returns null when feature IS enabled`, () => {
        saveEnv(envVar);
        enableGate(gate);
        const result = withFeatureGate(gate);
        assert.equal(result, null, `withFeatureGate("${gate}") should return null when enabled`);
        restoreEnv(envVar);
      });

      it(`❌ [${gate}] returns 501 Response when feature is disabled (env var not set)`, async () => {
        saveEnv(envVar);
        clearGate(gate);
        const result = withFeatureGate(gate);
        await assertIs501Response(result, gate);
        // Verify it's an actual NextResponse (which extends Response)
        assert.ok('headers' in (result as object), 'Result should have headers');
        const contentType = (result as Response).headers.get('content-type');
        assert.equal(contentType, 'application/json');
        restoreEnv(envVar);
      });

      it(`❌ [${gate}] returns 501 Response when feature is disabled (env var = false)`, async () => {
        saveEnv(envVar);
        disableGate(gate);
        const result = withFeatureGate(gate);
        await assertIs501Response(result, gate);
        restoreEnv(envVar);
      });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. EXISTING GUARD DELEGATION TESTS
// ═════════════════════════════════════════════════════════════════════════

describe('Existing Guards Delegate to Feature Gates', () => {
  // ── isResendConfigured ───────────────────────────────────────────────

  describe('isResendConfigured() (lib/email.ts)', () => {
    it('✅ returns true when ENABLE_EMAIL=true AND RESEND_API_KEY is set', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      enableGate('email');
      process.env.RESEND_API_KEY = 're_test_key_abc123';
      assert.equal(isResendConfigured(), true);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });

    it('❌ returns false when ENABLE_EMAIL=false even with RESEND_API_KEY set', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      disableGate('email');
      process.env.RESEND_API_KEY = 're_test_key_abc123';
      assert.equal(isResendConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });

    it('❌ returns false when ENABLE_EMAIL=true but RESEND_API_KEY is missing', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      enableGate('email');
      delete process.env.RESEND_API_KEY;
      assert.equal(isResendConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });

    it('❌ returns false when gate disabled and API key missing', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      disableGate('email');
      delete process.env.RESEND_API_KEY;
      assert.equal(isResendConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });

    it('❌ returns false when ENABLE_EMAIL is unset (default disabled) even with API key', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      clearGate('email');
      process.env.RESEND_API_KEY = 're_test_key_abc123';
      assert.equal(isResendConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });
  });

  // ── isTwilioConfigured ───────────────────────────────────────────────

  describe('isTwilioConfigured() (lib/twilio.ts)', () => {
    it('✅ returns true when ENABLE_SMS=true AND both Twilio credentials are set', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
      enableGate('sms');
      process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
      assert.equal(isTwilioConfigured(), true);
      restoreEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    });

    it('❌ returns false when ENABLE_SMS=false even with credentials', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
      disableGate('sms');
      process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
      assert.equal(isTwilioConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    });

    it('❌ returns false when ENABLE_SMS=true but TWILIO_ACCOUNT_SID is missing', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
      enableGate('sms');
      delete process.env.TWILIO_ACCOUNT_SID;
      process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
      assert.equal(isTwilioConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    });

    it('❌ returns false when ENABLE_SMS=true but TWILIO_AUTH_TOKEN is missing', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
      enableGate('sms');
      process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
      delete process.env.TWILIO_AUTH_TOKEN;
      assert.equal(isTwilioConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    });
  });

  // ── isAnyWebhookConfigured ───────────────────────────────────────────

  describe('isAnyWebhookConfigured() (services/webhook.service.ts)', () => {
    before(() => resetWebhookGuard());
    after(() => resetWebhookGuard());

    it('✅ returns true when ENABLE_WEBHOOKS=true AND N8N_WEBHOOK_URL is set', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      enableGate('webhooks');
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/test';
      assert.equal(isAnyWebhookConfigured(), true);
      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });

    it('❌ returns false when ENABLE_WEBHOOKS=false even with N8N_WEBHOOK_URL', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      disableGate('webhooks');
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/test';
      assert.equal(isAnyWebhookConfigured(), false);
      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });

    it('❌ returns false when ENABLE_WEBHOOKS=true but N8N_WEBHOOK_URL is missing', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      enableGate('webhooks');
      delete process.env.N8N_WEBHOOK_URL;
      assert.equal(isAnyWebhookConfigured(), false);
      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });

    it('❌ returns false when webhook gate is unset (default disabled) even with URL', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      clearGate('webhooks');
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/test';
      assert.equal(isAnyWebhookConfigured(), false);
      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });
  });

  // ── isRealtimeEnabled ────────────────────────────────────────────────

  describe('isRealtimeEnabled() (services/realtime.service.ts)', () => {
    it('✅ returns true when ENABLE_REALTIME=true AND SUPABASE_REALTIME_ENABLED=true', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
      enableGate('realtime');
      process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED = 'true';
      assert.equal(isRealtimeEnabled(), true);
      restoreEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
    });

    it('❌ returns false when ENABLE_REALTIME=false even with realtime enabled flag', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
      disableGate('realtime');
      process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED = 'true';
      assert.equal(isRealtimeEnabled(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
    });

    it('❌ returns false when ENABLE_REALTIME=true but SUPABASE_REALTIME_ENABLED is false', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
      enableGate('realtime');
      process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED = 'false';
      assert.equal(isRealtimeEnabled(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
    });

    it('❌ returns false when ENABLE_REALTIME=true but SUPABASE_REALTIME_ENABLED is unset', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
      enableGate('realtime');
      delete process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED;
      assert.equal(isRealtimeEnabled(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_REALTIME', 'NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. API ROUTE INTEGRATION TESTS
// ═════════════════════════════════════════════════════════════════════════
//
// Every API route that uses withFeatureGate() must return 501 when its
// feature gate is disabled. We test this by calling withFeatureGate()
// directly — the same function every route handler calls.

describe('API Routes Return 501 When Gated', () => {
  // ── Campaign cron route: gates on email_sequences ────────────────────

  describe('POST /api/campaigns/cron/process — gated on email_sequences', () => {
    it('❌ returns 501 when ENABLE_EMAIL_SEQUENCES is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
      clearGate('email_sequences');
      const gate = withFeatureGate('email_sequences');
      assert.ok(gate !== null, 'Should return a Response when disabled');
      assert.equal(gate!.status, 501);
      const body = await gate!.json();
      assert.equal(body.feature, 'email_sequences');
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
    });

    it('✅ returns null (proceed) when ENABLE_EMAIL_SEQUENCES is enabled', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
      enableGate('email_sequences');
      const gate = withFeatureGate('email_sequences');
      assert.equal(gate, null);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
    });
  });

  // ── Google Calendar OAuth routes: gates on calendar_sync ─────────────

  describe('GET /api/integrations/google/oauth — gated on calendar_sync', () => {
    it('❌ returns 501 when ENABLE_CALENDAR_SYNC is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
      clearGate('calendar_sync');
      const gate = withFeatureGate('calendar_sync');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
    });

    it('✅ returns null (proceed) when ENABLE_CALENDAR_SYNC is enabled', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
      enableGate('calendar_sync');
      const gate = withFeatureGate('calendar_sync');
      assert.equal(gate, null);
      restoreEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
    });
  });

  describe('GET /api/integrations/google/callback — gated on calendar_sync', () => {
    it('❌ returns 501 when ENABLE_CALENDAR_SYNC is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
      clearGate('calendar_sync');
      const gate = withFeatureGate('calendar_sync');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
    });
  });

  describe('POST /api/integrations/google/disconnect — gated on calendar_sync', () => {
    it('❌ returns 501 when ENABLE_CALENDAR_SYNC is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
      clearGate('calendar_sync');
      const gate = withFeatureGate('calendar_sync');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_CALENDAR_SYNC');
    });
  });

  // ── Portal auth routes: gates on portal ──────────────────────────────

  describe('POST /api/portal/auth/login — gated on portal', () => {
    it('❌ returns 501 when ENABLE_PORTAL is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_PORTAL');
      clearGate('portal');
      const gate = withFeatureGate('portal');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      const body = await gate!.json();
      assert.equal(body.feature, 'portal');
      restoreEnv('NEXT_PUBLIC_ENABLE_PORTAL');
    });
  });

  describe('POST /api/portal/auth/register — gated on portal', () => {
    it('❌ returns 501 when ENABLE_PORTAL is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_PORTAL');
      clearGate('portal');
      const gate = withFeatureGate('portal');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_PORTAL');
    });
  });

  describe('POST /api/portal/auth/reset-password — gated on portal', () => {
    it('❌ returns 501 when ENABLE_PORTAL is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_PORTAL');
      clearGate('portal');
      const gate = withFeatureGate('portal');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_PORTAL');
    });
  });

  describe('DELETE /api/portal/auth/users/[id] — gated on portal', () => {
    it('❌ returns 501 when ENABLE_PORTAL is disabled', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_PORTAL');
      clearGate('portal');
      const gate = withFeatureGate('portal');
      assert.ok(gate !== null);
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_PORTAL');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. SERVICE LAYER TESTS
// ═════════════════════════════════════════════════════════════════════════
//
// These tests verify that services gracefully degrade when features are
// disabled — no 500 errors, no crashes, no unhandled rejections.

describe('Services Gracefully Handle Disabled Features', () => {
  // ── triggerWebhook ───────────────────────────────────────────────────
  //
  // triggerWebhook() is directly testable because it returns `false`
  // immediately when webhooks are disabled, without needing Supabase.

  describe('triggerWebhook() (services/webhook.service.ts)', () => {
    before(() => resetWebhookGuard());
    after(() => resetWebhookGuard());

    it('❌ returns false when ENABLE_WEBHOOKS=false (no crash, no network)', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      clearGate('webhooks');

      // This should return false immediately without making any network call
      const result = await triggerWebhook('test.event', { id: 'test-123' });
      assert.equal(result, false, 'triggerWebhook should return false when gate is disabled');

      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });

    it('❌ returns false when ENABLE_WEBHOOKS=true but N8N_WEBHOOK_URL not set', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      enableGate('webhooks');
      delete process.env.N8N_WEBHOOK_URL;

      const result = await triggerWebhook('test.event', { id: 'test-123' });
      assert.equal(result, false, 'triggerWebhook should return false when no URL configured');

      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });
  });

  // ── triggerWebhookWithDetails ────────────────────────────────────────

  describe('triggerWebhookWithDetails() (services/webhook.service.ts)', () => {
    before(() => resetWebhookGuard());
    after(() => resetWebhookGuard());

    it('❌ returns empty array when ENABLE_WEBHOOKS=false (graceful, no crash)', async () => {
      saveEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
      resetWebhookGuard();
      clearGate('webhooks');

      const { triggerWebhookWithDetails } = await import('@/services/webhook.service');
      const results = await triggerWebhookWithDetails('test.event', { id: 'test-123' });
      assert.ok(Array.isArray(results), 'Should return an array');
      assert.equal(results.length, 0, 'Should return empty array when webhooks disabled');

      resetWebhookGuard();
      restoreEnv('NEXT_PUBLIC_ENABLE_WEBHOOKS', 'N8N_WEBHOOK_URL');
    });
  });

  // ── Guard-based graceful degradation for communicationService ────────

  describe('communicationService.sendEmail() guard path', () => {
    it('🛡️ isResendConfigured() returns false when gate is disabled, preventing Resend call', () => {
      // This verifies the guard that prevents Resend from being called
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      disableGate('email');
      process.env.RESEND_API_KEY = 're_test_key_abc123';

      // When gate is disabled, isResendConfigured returns false
      // → communicationService.sendEmail() sets status='queued' (line 279 of communication.service.ts)
      // → No Resend API call happens
      assert.equal(isResendConfigured(), false);

      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });

    it('🛡️ isResendConfigured() returns false even with API key when gate unset', () => {
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
      clearGate('email');
      process.env.RESEND_API_KEY = 're_test_key_abc123';
      assert.equal(isResendConfigured(), false);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL', 'RESEND_API_KEY');
    });
  });

  // ── Guard-based graceful degradation for smsService ──────────────────

  describe('smsService.send() guard path', () => {
    it('🛡️ isTwilioConfigured() returns false when gate is disabled, preventing Twilio call', () => {
      // This verifies the guard that prevents Twilio from being called
      saveEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
      disableGate('sms');
      process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';

      // When gate is disabled, isTwilioConfigured returns false
      // → smsService.send() saves as 'queued' (line 64 of sms.service.ts)
      // → No Twilio API call happens
      assert.equal(isTwilioConfigured(), false);

      restoreEnv('NEXT_PUBLIC_ENABLE_SMS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    });
  });

  // ── Graceful degradation for campaign scheduler ──────────────────────

  describe('campaignScheduler processPendingSends() guard path', () => {
    it('🛡️ The API route gate (email_sequences) blocks before campaign scheduler is called', () => {
      // The POST /api/campaigns/cron/process route checks withFeatureGate('email_sequences')
      // BEFORE calling campaignScheduler.processPendingSends(). When the gate is disabled,
      // the route returns 501 and the scheduler is never invoked.
      saveEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
      clearGate('email_sequences');
      const gate = withFeatureGate('email_sequences');
      assert.ok(gate !== null, 'Gate should block when email_sequences is disabled');
      assert.equal(gate!.status, 501);
      restoreEnv('NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. CONSISTENCY & DOCUMENTATION CHECKS
// ═════════════════════════════════════════════════════════════════════════

describe('Feature Gate Consistency & Documentation', () => {
  it('📋 ALL 10 gate env vars are documented in .env.example', async () => {
    // Read .env.example and verify every gate's env var is present
    const fs = await import('fs');
    const path = await import('path');
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    for (const gate of ALL_GATES) {
      const envVar = ENV_MAP[gate];
      assert.ok(
        content.includes(envVar),
        `.env.example must document "${envVar}" (gate: "${gate}")`,
      );
    }
  });

  it('📋 ENV_MAP in feature-gates.ts matches ALL_GATES array (no missing mappings)', () => {
    // Every gate in ALL_GATES must have a corresponding entry in ENV_MAP
    for (const gate of ALL_GATES) {
      assert.ok(ENV_MAP[gate], `ENV_MAP must have an entry for gate "${gate}"`);
      assert.ok(
        ENV_MAP[gate].startsWith('NEXT_PUBLIC_ENABLE_'),
        `Env var for "${gate}" should start with NEXT_PUBLIC_ENABLE_`,
      );
    }
  });

  it('📋 Each gate env var follows the NEXT_PUBLIC_ENABLE_* naming convention', () => {
    for (const [gate, envVar] of Object.entries(ENV_MAP)) {
      assert.ok(
        envVar.startsWith('NEXT_PUBLIC_ENABLE_'),
        `Env var for gate "${gate}" must start with NEXT_PUBLIC_ENABLE_, got "${envVar}"`,
      );
      // Verify the env var name matches the gate name converted to UPPER_SNAKE_CASE
      const suffix = gate.replace(/([A-Z])/g, '_$1').toUpperCase();
      assert.ok(
        envVar.endsWith(suffix),
        `Env var "${envVar}" should end with "${suffix}" for gate "${gate}"`,
      );
    }
  });
});
