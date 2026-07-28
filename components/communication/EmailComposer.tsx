'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconMail, IconSend, IconFileDescription, IconCheck, IconX } from '@tabler/icons-react';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailComposerProps {
  toAddress?: string;
  relatedToType?: string;
  relatedToId?: string;
  onSend: (data: { toAddress: string; subject: string; body: string }) => Promise<SendResult | void>;
  onSaveDraft?: (data: { toAddress: string; subject: string; body: string }) => Promise<void>;
  onClose?: () => void;
  isTestSend?: boolean;
}

export function EmailComposer({ toAddress = '', onSend, onSaveDraft, onClose, isTestSend }: EmailComposerProps) {
  const [to, setTo] = useState(toAddress);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<SendResult | null>(null);

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    setDeliveryStatus(null);
    try {
      const result = await onSend({ toAddress: to, subject, body });
      if (result) {
        setDeliveryStatus(result);
      }
      if (!result || result.success) {
        setTo('');
        setSubject('');
        setBody('');
        onClose?.();
      }
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
          {isTestSend && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              TEST
            </span>
          )}
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

        {deliveryStatus && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              deliveryStatus.success
                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            }`}
          >
            {deliveryStatus.success ? (
              <IconCheck className="size-4 shrink-0" />
            ) : (
              <IconX className="size-4 shrink-0" />
            )}
            <span className="text-xs">
              {deliveryStatus.success
                ? `Sent via Resend${deliveryStatus.messageId ? ` (${deliveryStatus.messageId.slice(0, 12)}...)` : ''}`
                : `Send failed: ${deliveryStatus.error ?? 'Unknown error'}`}
            </span>
          </div>
        )}
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
            {sending ? 'Sending...' : isTestSend ? 'Send Test' : 'Send'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
