'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconMail, IconSend, IconFileDescription } from '@tabler/icons-react';

interface EmailComposerProps {
  toAddress?: string;
  relatedToType?: string;
  relatedToId?: string;
  onSend: (data: { toAddress: string; subject: string; body: string }) => Promise<void>;
  onSaveDraft?: (data: { toAddress: string; subject: string; body: string }) => Promise<void>;
  onClose?: () => void;
}

export function EmailComposer({ toAddress = '', relatedToType, relatedToId, onSend, onSaveDraft, onClose }: EmailComposerProps) {
  const [to, setTo] = useState(toAddress);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    try {
      await onSend({ toAddress: to, subject, body });
      setTo('');
      setSubject('');
      setBody('');
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!to.trim()) return;
    if (!onSaveDraft) return;
    setSaving(true);
    try {
      await onSaveDraft({ toAddress: to, subject, body });
      setTo('');
      setSubject('');
      setBody('');
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const isValid = to.trim().length > 0 && body.trim().length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <IconMail className="size-4" />
          Compose Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="composer-to">To</Label>
          <Input
            id="composer-to"
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="composer-subject">Subject</Label>
          <Input
            id="composer-subject"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="composer-body">Message</Label>
          <Textarea
            id="composer-body"
            placeholder="Write your message..."
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={!to.trim() || saving}>
              <IconFileDescription className="size-4" />
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
          )}
          <Button size="sm" onClick={handleSend} disabled={!isValid || sending}>
            <IconSend className="size-4" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
