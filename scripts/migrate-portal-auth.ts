/**
 * ─── Portal Auth Migration Script ─────────────────────────────────────────
 *
 * One-off migration script that creates Supabase Auth identities for existing
 * portal_users who were previously authenticated via bcrypt password hashes.
 *
 * After migration:
 *   - portal_users.password_hash is cleared (null)
 *   - An auth.users identity is created with the same UUID
 *   - A password reset email is sent so the user can set their own password
 *   - portal_users table continues to serve as profile metadata store
 *
 * Usage:
 *   bun run scripts/migrate-portal-auth.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (admin operations)
 *   NEXT_PUBLIC_SITE_URL       — Site URL for password reset redirect (optional)
 * ───────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: { email: string; reason: string }[];
}

async function migrate(): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

  // ── Validate env ──────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Set these environment variables before running the migration.');
    process.exit(1);
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const anonClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log('🔍 Fetching portal users with bcrypt password hashes...');

  // ── Fetch unmigrated users ─────────────────────────────────────────────────
  const { data: users, error: fetchError } = await anonClient
    .from('portal_users')
    .select('*')
    .not('password_hash', 'is', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch portal_users:', fetchError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('✅ No unmigrated portal users found. All users already have Supabase Auth identities.');
    return result;
  }

  const portalUsers = users;
  console.log(`📋 Found ${portalUsers.length} user(s) to migrate.\n`);

  // ── Migrate each user ─────────────────────────────────────────────────────
  for (const user of portalUsers) {
    process.stdout.write(`  Migrating ${user.email}... `);

    try {
      // Generate a secure migration password (user will reset it)
      const migrationPassword =
        crypto.randomUUID().replace(/-/g, '').slice(0, 16) +
        'A1!' +
        Math.random().toString(36).slice(2, 6);

      // Create auth user with the SAME ID as the portal_users row
      const { error: createError } = await adminClient.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: migrationPassword,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          portal_user: true,
          migrated_from_bcrypt: true,
          migrated_at: new Date().toISOString(),
        },
      });

      if (createError) {
        const msg = createError.message?.toLowerCase() ?? '';

        if (msg.includes('already exists') || msg.includes('already been registered') || msg.includes('duplicate')) {
          // Auth identity already exists — just clear the password_hash
          console.log('⏭️  Auth user already exists, clearing password_hash');
          await anonClient
            .from('portal_users')
            .update({ password_hash: null })
            .eq('id', user.id);
          result.skipped++;
          continue;
        }

        console.log('❌', createError.message);
        result.errors.push({ email: user.email, reason: createError.message });
        continue;
      }

      // Clear password_hash to mark as migrated
      await anonClient
        .from('portal_users')
        .update({ password_hash: null })
        .eq('id', user.id);

      // Send password reset email
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${siteUrl}/portal/auth/callback`,
      });

      if (resetError) {
        console.log(`⚠️  Auth identity created but password reset email failed: ${resetError.message}`);
      } else {
        console.log('✅ Password reset email sent');
      }

      result.migrated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.log('❌', msg);
      result.errors.push({ email: user.email, reason: msg });
    }
  }

  return result;
}

// ── Run ──────────────────────────────────────────────────────────────────────

migrate()
  .then((result) => {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Migration Summary');
    console.log('═'.repeat(50));
    console.log(`  ✅ Migrated:  ${result.migrated}`);
    console.log(`  ⏭️  Skipped:   ${result.skipped}`);
    console.log(`  ❌ Errors:    ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      for (const err of result.errors) {
        console.log(`   - ${err.email}: ${err.reason}`);
      }
      console.log('\n💡 Re-run the script to retry failed migrations.');
    }

    if (result.migrated > 0) {
      console.log('\n🔑 Migrated users should receive a password reset email.');
      console.log('   They can click the link in the email to set their own password.');
    }

    if (result.migrated === 0 && result.errors.length === 0) {
      console.log('\n✅ No users needed migration.');
    }

    process.exit(result.errors.length > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error('\n❌ Migration failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
