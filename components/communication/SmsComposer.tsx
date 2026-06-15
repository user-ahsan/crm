'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconDeviceMobileMessage, IconSend } from '@tabler/icons-react';

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

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    try {
      await onSend({ toNumber: to, body });
      setTo('');
      setBody('');
      onClose?.();
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
      </CardContent>
      <CardFooter className="flex justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend} disabled={!isValid || sending}>
          <IconSend className="size-4" />
          {sending ? 'Sending...' : 'Send'}
        </Button>
      </CardFooter>
    </Card>
  );
}
