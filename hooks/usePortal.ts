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
   * This delegates to the server-side admin client for Supabase Auth user creation.
   */
  const createUser = useCallback(async (data: PortalUserFormData) => {
    const res = await fetch('/api/portal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? 'Failed to create portal user');
    }
    setUsers((prev) => [json.user, ...prev]);
  }, []);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    try {
      await portalService.toggleUserActive(id, active);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, active } : u)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle user status');
    }
  }, []);

  /**
   * Deletes a portal user via the users API route.
   * This delegates to the server-side admin client to also delete the Auth identity.
   */
  const deleteUser = useCallback(async (id: string) => {
    const res = await fetch(`/api/portal/auth/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? 'Failed to delete portal user');
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  return { users, loading, error, reload: load, createUser, toggleActive, deleteUser };
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

  return { shares, loading, error, reload: load, shareRecord, removeShare };
}
