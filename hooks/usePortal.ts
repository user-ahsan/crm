'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PortalUser, PortalUserFormData, PortalShare, PortalShareFormData } from '@/types/portal.types';
import { portalService } from '@/services/portal.service';

export function usePortalUsers() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await portalService.getUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portal users');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await portalService.getUsers();
        if (!cancelled) setUsers(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portal users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Creates a portal user via the registration API route.
   * This delegates to the server-side admin client for Supabase Auth user
   * creation. Failures are surfaced through `error` and rethrown so the
   * caller's own error handling fires (AGENTS.md §2.4).
   */
  const createUser = useCallback(async (data: PortalUserFormData) => {
    try {
      const res = await fetch('/api/portal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({})) as { user?: PortalUser; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to create portal user');
      }
      if (json.user) {
        const user = json.user;
        setUsers((prev) => [user, ...prev]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create portal user');
      throw e instanceof Error ? e : new Error('Failed to create portal user');
    }
  }, []);

  /**
   * Toggles a portal user's active flag via the server-side PATCH route
   * (F18: portalService.toggleUserActive is server-only and throws a
   * CONFIG_ERROR from the browser — the auth ban/unban must run server-side).
   * Optimistic update with rollback on failure; rethrows so callers can toast.
   */
  const toggleActive = useCallback(async (id: string, active: boolean) => {
    let previous: PortalUser | undefined;
    setUsers((prev) => {
      previous = prev.find((u) => u.id === id);
      return prev.map((u) => (u.id === id ? { ...u, active } : u));
    });
    try {
      const res = await fetch(`/api/portal/auth/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({})) as { user?: PortalUser; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to update portal user');
      }
      if (json.user) {
        const user = json.user;
        setUsers((prev) => prev.map((u) => (u.id === id ? user : u)));
      }
      setError(null);
    } catch (e) {
      if (previous) {
        setUsers((prev) => prev.map((u) => (u.id === id && previous ? { ...u, active: previous.active } : u)));
      }
      setError(e instanceof Error ? e.message : 'Failed to toggle user status');
      throw e instanceof Error ? e : new Error('Failed to toggle user status');
    }
  }, []);

  /**
   * Deletes a portal user via the users API route.
   * This delegates to the server-side admin client to also delete the Auth
   * identity. Failures are surfaced through `error` and rethrown (AGENTS.md §2.4).
   */
  const deleteUser = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/portal/auth/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to delete portal user');
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete portal user');
      throw e instanceof Error ? e : new Error('Failed to delete portal user');
    }
  }, []);

  return {
    users,
    loading,
    error,
    reload: load,
    createUser,
    toggleActive,
    toggleUser: toggleActive,
    deleteUser,
  };
}

export function usePortalShares(portalUserId: string | null) {
  const [shares, setShares] = useState<PortalShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!portalUserId) {
      setShares([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await portalService.getShares(portalUserId);
      setShares(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [portalUserId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!portalUserId) {
      setShares([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await portalService.getShares(portalUserId);
        if (!cancelled) setShares(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load shares');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [portalUserId]);

  const shareRecord = useCallback(async (data: PortalShareFormData) => {
    try {
      const share = await portalService.shareRecord(data);
      setShares((prev) => [share, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to share record');
    }
  }, []);

  const removeShare = useCallback(async (id: string) => {
    try {
      await portalService.removeShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove share');
    }
  }, []);

  return {
    shares,
    loading,
    error,
    reload: load,
    shareRecord,
    createShare: shareRecord,
    removeShare,
  };
}
