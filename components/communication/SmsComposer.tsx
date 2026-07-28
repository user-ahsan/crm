'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconDeviceMobileMessage, IconSend, IconCheck, IconX } from '@tabler/icons-react';

interface SmsComposerProps {
  toNumber?: string;
  relatedToType?: string;
  relatedToId?: string;
  onSend: (data: { toNumber: string; body: string }) => Promise<void>;
  onClose?: () => void;
}

const MAX_CHARS = 160;

export function SmsComposer({ toNumber = '', onSend, onClose }: SmsComposerProps) {
  const [to, setTo] = useState(toNumber);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sendErrorMsg, setSendErrorMsg] = useState('');

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    setSendStatus('idle');
    try {
      await onSend({ toNumber: to, body });
      setSendStatus('success');
      setTimeout(() => {
        setTo('');
        setBody('');
        onClose?.();
      }, 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send SMS';
      setSendErrorMsg(msg);
      setSendStatus('error');
      toast.error('Failed to send SMS', { description: msg });
    } finally {
      setSending(false);
    }
  };

  const isValid = to.trim().length > 0 && body.trim().length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <IconDeviceMobileMessage className="size-4" />
          Compose SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sms-to">To</Label>
          <Input
            id="sms-to"
            type="tel"
            placeholder="+15551234567"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sms-body">Message</Label>
          <Textarea
            id="sms-body"
            placeholder="Type your SMS message..."
            rows={4}
            maxLength={MAX_CHARS}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {body.length}/{MAX_CHARS}
          </p>
        </div>

        {/* Delivery status indicator */}
        {sendStatus === 'success' && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
            <IconCheck className="size-4 shrink-0" />
            <span>SMS sent successfully</span>
          </div>
        )}
        {sendStatus === 'error' && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <IconX className="size-4 shrink-0" />
            <span className="flex-1">{sendErrorMsg}</span>
            <button onClick={() => setSendStatus('idle')} className="text-red-500 hover:text-red-700">
              <IconX className="size-3.5" />
            </button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {sendStatus === 'error' && (
            <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
              <IconSend className="size-4" />
              Retry
            </Button>
          )}
          <Button size="sm" onClick={handleSend} disabled={!isValid || sending || sendStatus === 'success'}>
            <IconSend className="size-4" />
            {sending ? 'Sending...' : sendStatus === 'success' ? 'Sent!' : 'Send'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
