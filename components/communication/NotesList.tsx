'use client';

import { useState, useCallback } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NoteEditor } from './NoteEditor';
import { MarkdownContent } from '@/components/common/MarkdownContent';
import { formatRelativeTime, getInitials } from '@/lib/formatters';
import { getUserName } from '@/lib/user-utils';
import { USERS } from '@/data/mock-users';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconNote,
  IconPlus,
  IconTrash,
  IconEdit,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';

interface NotesListProps {
  entityType?: string;
  entityId?: string;
}

export function NotesList({ entityType, entityId }: NotesListProps) {
  const { notes, loading, error, refresh, createNote, updateNote, deleteNote } = useNotes(entityType, entityId);
  const { user: currentUser } = useCurrentUser();
  const [showEditor, setShowEditor] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async (title: string, body: string) => {
    setSaving(true);
    try {
      const result = await createNote({ title, body, relatedToType: entityType, relatedToId: entityId, createdBy: currentUser?.id ?? USERS[0]?.id ?? 'system' });
      if (result) setShowEditor(false);
    } finally {
      setSaving(false);
    }
  }, [createNote, entityType, entityId, currentUser?.id]);

  const handleUpdate = useCallback(async (id: string, title: string, body: string) => {
    setSaving(true);
    try {
      const result = await updateNote(id, { title, body });
      if (result) setEditingNoteId(null);
    } finally {
      setSaving(false);
    }
  }, [updateNote]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await deleteNote(id);
  }, [deleteNote]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Notes {notes.length > 0 && <span className="text-muted-foreground">({notes.length})</span>}
        </h3>
        {!showEditor && (
          <Button size="sm" onClick={() => setShowEditor(true)}>
            <IconPlus className="size-4" />
            Add Note
          </Button>
        )}
      </div>

      {showEditor && (
        <NoteEditor
          onSave={handleCreate}
          onCancel={() => setShowEditor(false)}
          saving={saving}
        />
      )}

      {notes.length === 0 && !showEditor ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <IconNote className="mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notes yet. Add one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const isExpanded = expandedIds.has(note.id);
            const isEditing = editingNoteId === note.id;
            const preview = note.body.length > 100 ? note.body.slice(0, 100) + '...' : note.body;
            const authorName = getUserName(note.createdBy, 'Unknown');

            if (isEditing) {
              return (
                <NoteEditor
                  key={note.id}
                  initialTitle={note.title}
                  initialBody={note.body}
                  onSave={(title, body) => handleUpdate(note.id, title, body)}
                  onCancel={() => setEditingNoteId(null)}
                  saving={saving}
                />
              );
            }

            return (
              <div key={note.id} className="rounded-lg border bg-card transition-colors hover:bg-muted/30">
                <div className="flex items-start gap-3 p-3">
                  <Avatar size="sm" className="size-7 shrink-0">
                    <AvatarFallback className="text-[9px]">{getInitials(authorName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{authorName}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(note.createdAt)}</span>
                      {note.updatedAt !== note.createdAt && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                      )}
                    </div>
                    {note.title && (
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{note.title}</p>
                    )}
                    <div className="mt-0.5">
                      <MarkdownContent
                        content={isExpanded ? note.body : preview}
                        className="text-sm text-foreground/80"
                      />
                    </div>
                    {note.body.length > 100 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(note.id)}
                        className="mt-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />}
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(note.id)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit note"
                    >
                      <IconEdit className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Delete note"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
