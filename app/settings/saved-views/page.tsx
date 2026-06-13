'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { IconEye, IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { SavedView, ViewEntityType } from '@/types/saved-view.types';
import { savedViewService } from '@/services/saved-view.service';
import { PageHeader } from '@/components/common/PageHeader';
import { SavedViewList } from '@/components/saved-views/SavedViewList';
import { SavedViewDialog } from '@/components/saved-views/SavedViewDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

type ViewsMap = Record<ViewEntityType, SavedView[]>;
type LoadingMap = Record<ViewEntityType, boolean>;
type ErrorMap = Record<ViewEntityType, string | null>;

const ENTITY_TABS: { value: ViewEntityType; label: string }[] = [
  { value: 'lead', label: 'Leads' },
  { value: 'contact', label: 'Contacts' },
  { value: 'company', label: 'Companies' },
  { value: 'deal', label: 'Deals' },
  { value: 'task', label: 'Tasks' },
  { value: 'meeting', label: 'Meetings' },
];

function createInitialMap<T>(initial: T): Record<ViewEntityType, T> {
  return {
    lead: initial,
    contact: initial,
    company: initial,
    deal: initial,
    task: initial,
    meeting: initial,
  };
}

export default function SavedViewsPage() {
  const [activeTab, setActiveTab] = useState<ViewEntityType>('lead');
  const [viewsMap, setViewsMap] = useState<ViewsMap>(createInitialMap<SavedView[]>([]));
  const [loadingMap, setLoadingMap] = useState<LoadingMap>(createInitialMap(true));
  const [errorMap, setErrorMap] = useState<ErrorMap>(createInitialMap<string | null>(null));
  const fetchedRef = useRef<Set<ViewEntityType>>(new Set());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavedView | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);

  const fetchViews = useCallback(async (entityType: ViewEntityType, silent = false) => {
    if (!silent) {
      setLoadingMap((prev) => ({ ...prev, [entityType]: true }));
    }
    setErrorMap((prev) => ({ ...prev, [entityType]: null }));
    try {
      const data = await savedViewService.getViews(entityType);
      setViewsMap((prev) => ({ ...prev, [entityType]: data }));
      fetchedRef.current.add(entityType);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load saved views';
      setErrorMap((prev) => ({ ...prev, [entityType]: message }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [entityType]: false }));
    }
  }, []);

  // Fetch views for the active tab on mount and tab change
  useEffect(() => {
    if (!fetchedRef.current.has(activeTab)) {
      fetchViews(activeTab);
    }
  }, [activeTab, fetchViews]);

  const handleOpenCreate = useCallback(() => {
    setEditTarget(null);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((view: SavedView) => {
    setEditTarget(view);
    setEditDialogOpen(true);
  }, []);

  const handleOpenDelete = useCallback((view: SavedView) => {
    setDeleteTarget(view);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    fetchViews(activeTab);
  }, [activeTab, fetchViews]);

  const handleEditSuccess = useCallback(() => {
    fetchViews(activeTab);
  }, [activeTab, fetchViews]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const success = await savedViewService.delete(deleteTarget.id);
      if (success) {
        toast.success(`"${deleteTarget.name}" deleted`);
        fetchViews(activeTab);
      } else {
        toast.error('Failed to delete view');
      }
    } catch {
      toast.error('Failed to delete view');
    }
    setDeleteTarget(null);
  }, [deleteTarget, activeTab, fetchViews]);

  const handleApply = useCallback((view: SavedView) => {
    toast.success(`Applied view: "${view.name}"`);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Views"
        description="Manage saved filter and sort views for all entity types"
      >
        <Button onClick={handleOpenCreate}>
          <IconPlus className="mr-2 size-4" />
          New View
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Saved Views</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(val) => val && setActiveTab(val as ViewEntityType)}>
            <TabsList className="mb-6 flex-wrap">
              {ENTITY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <IconEye className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {ENTITY_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <SavedViewList
                  entityType={tab.value}
                  views={viewsMap[tab.value]}
                  loading={loadingMap[tab.value]}
                  error={errorMap[tab.value]}
                  onRefresh={() => fetchViews(tab.value)}
                  onApply={handleApply}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <SavedViewDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        view={null}
        defaultEntityType={activeTab}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <SavedViewDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        view={editTarget}
        defaultEntityType={activeTab}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete View"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
