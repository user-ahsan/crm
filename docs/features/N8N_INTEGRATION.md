# n8n Integration Guide

> Connect your NexusCRM instance with n8n automation workflows to trigger actions based on CRM events — send Slack notifications, create follow-up tasks, send email reminders, and more.

---

## Overview

The n8n webhook integration allows external automation workflows (running in n8n) to receive real-time event notifications from NexusCRM. When entities are created, updated, deleted, or change state, the CRM sends a POST request to your configured n8n webhook endpoint.

### How It Works

```
NexusCRM Event (lead.created)
    │
    ▼
webhook.service.ts ──POST──► n8n Webhook Node ──► Workflow (Slack, Email, etc.)
    │                              │
    │  Authorization: Bearer {key} │
    └──────────────────────────────┘
```

The service layer (`services/webhook.service.ts`) is responsible for sending events. To integrate it into an existing service (e.g., `lead.service.ts`), insert a call to `triggerWebhook()` after any data mutation.

---

## Setup

### 1. Environment Variables

Add the following variables to your `.env.local` or Vercel environment:

```env
# Required: Your n8n webhook endpoint URL
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/nexuscrm

# Required: Shared secret for request authentication
N8N_WEBHOOK_SECRET=your-secure-random-secret-here
```

On Vercel, set these in Project Settings → Environment Variables.

### 2. Create an n8n Webhook Node

1. Open your n8n instance
2. Create a new workflow
3. Add a **Webhook** node as the trigger
4. Configure the node:

   | Setting | Value |
   |---------|-------|
   | **HTTP Method** | `POST` |
   | **Path** | `/nexuscrm` (or your preferred path) |
   | **Response Mode** | `Last Node` (or `Response Node` to send a confirmation back) |
   | **Options → Respond** | `JSON` |

5. Under **Add Header**, set:
   - **Name:** `Authorization`
   - **Value:** `Bearer {{N8N_WEBHOOK_SECRET}}`

6. **Save** the workflow — n8n will generate the webhook URL
7. Copy the full URL (e.g., `https://your-n8n-instance.com/webhook/nexuscrm`)
8. Set it as `N8N_WEBHOOK_URL` in your CRM environment

### 3. Activate the Workflow

Toggle the workflow from **Inactive** to **Active** in n8n. The webhook is now ready to receive events.

---

## Supported Events

### Lead Events

| Event | Triggered When | Sample Payload |
|-------|---------------|----------------|
| `lead.created` | A new lead is created | `{ event, timestamp, data: { id, fullName, email, status, estimatedValue } }` |
| `lead.updated` | An existing lead is modified | `{ event, timestamp, data: { id, fullName, ...changedFields } }` |
| `lead.deleted` | A lead is removed | `{ event, timestamp, data: { id, fullName } }` |
| `lead.status_changed` | Lead moves between pipeline stages | `{ event, timestamp, data: { id, fullName, previousStatus, status } }` |

### Contact Events

| Event | Triggered When | Sample Payload |
|-------|---------------|----------------|
| `contact.created` | A new contact is created | `{ event, timestamp, data: { id, name, email, companyId } }` |
| `contact.updated` | An existing contact is modified | `{ event, timestamp, data: { id, name, ...changedFields } }` |
| `contact.deleted` | A contact is removed | `{ event, timestamp, data: { id, name } }` |

### Company Events

| Event | Triggered When | Sample Payload |
|-------|---------------|----------------|
| `company.created` | A new company is created | `{ event, timestamp, data: { id, name, industry, revenue } }` |
| `company.updated` | An existing company is modified | `{ event, timestamp, data: { id, name, ...changedFields } }` |
| `company.deleted` | A company is removed | `{ event, timestamp, data: { id, name } }` |

### Task Events

| Event | Triggered When | Sample Payload |
|-------|---------------|----------------|
| `task.created` | A new task is created | `{ event, timestamp, data: { id, title, assignedTo, dueDate, priority } }` |
| `task.completed` | A task is marked complete | `{ event, timestamp, data: { id, title, assignedTo } }` |
| `task.overdue` | A task's due date has passed (triggered by n8n schedule) | `{ event, timestamp, data: { id, title, assignedTo, dueDate } }` |

### Meeting Events

| Event | Triggered When | Sample Payload |
|-------|---------------|----------------|
| `meeting.created` | A meeting is scheduled | `{ event, timestamp, data: { id, title, dateTime, participants, type } }` |
| `meeting.completed` | A meeting is marked done | `{ event, timestamp, data: { id, title, outcome, notes } }` |

---

## Payload Format

Every webhook request follows this JSON structure:

```json
{
  "event": "lead.created",
  "timestamp": "2026-06-13T14:30:00.000Z",
  "data": {
    "id": "lead-abc123",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "companyName": "Acme Corp",
    "status": "new",
    "estimatedValue": 5000,
    "source": "website",
    "priority": "high"
  },
  "metadata": {
    "source": "crm-web-ui",
    "triggeredBy": "user-admin-001"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | `string` | Yes | One of the supported event types listed above |
| `timestamp` | `string` (ISO 8601) | Yes | When the event occurred in the CRM |
| `data` | `object` | Yes | The entity data relevant to the event |
| `metadata` | `object` | No | Additional context (user, source system, etc.) |

### Response from CRM (200 OK)

```json
{
  "success": true,
  "message": "Lead created: Jane Doe (lead-abc123)",
  "receivedAt": "2026-06-13T14:30:01.000Z"
}
```

### Error Responses

**401 Unauthorized** — Missing or incorrect `Authorization` header:
```json
{ "success": false, "error": "Unauthorized" }
```

**400 Bad Request** — Invalid or missing fields:
```json
{ "success": false, "error": "Missing required fields: event, timestamp, data" }
```

```json
{ "success": false, "error": "Unsupported event: lead.archived. Supported events: lead.created, lead.updated, ..." }
```

---

## Example n8n Workflows

### Workflow 1: Slack Notification on New Lead

**Trigger:** Webhook node receiving `lead.created`

**Nodes:**
1. **Webhook** — Receives the CRM event
2. **IF** — Filter: `{{ $json.event === 'lead.created' }}`
3. **Slack** — Send message to #leads channel

**Slack Message Template:**
```
🆕 New Lead Created
Name: {{ $json.data.fullName }}
Company: {{ $json.data.companyName || "N/A" }}
Value: ${{ $json.data.estimatedValue }}
Email: {{ $json.data.email }}
Status: {{ $json.data.status }}
```

### Workflow 2: Email Reminder for Overdue Tasks

**Trigger:** n8n Schedule (Cron: daily at 9 AM)

**Nodes:**
1. **Schedule** — Cron: `0 9 * * *`
2. **HTTP Request** — `GET /api/webhook/n8n/check-overdue` (or use the CRM's task API)
3. **IF** — Filter for tasks with `status === 'overdue'` or past due date
4. **Email (SMTP)** — Send reminder to the assigned user

**Alternative:** Set up a schedule in n8n to call the CRM's task endpoint directly, then trigger actions on overdue tasks.

### Workflow 3: Create Follow-up Task After Meeting

**Trigger:** Webhook node receiving `meeting.completed`

**Nodes:**
1. **Webhook** — Receives `meeting.completed`
2. **Set** — Build follow-up task payload:
   ```json
   {
     "title": "Follow-up: {{ $json.data.title }}",
     "description": "Follow up on meeting: {{ $json.data.notes }}",
     "dueDate": "{{ $now.plus(3, 'days').toISO() }}",
     "priority": "high",
     "relatedToType": "lead"
   }
   ```
3. **HTTP Request** — POST to CRM's internal task creation endpoint

### Workflow 4: Lead Status Change Alert

**Trigger:** Webhook node receiving `lead.status_changed`

**Nodes:**
1. **Webhook** — Receives `lead.status_changed`
2. **IF** — Check if new status is `won`
3. **Slack** — Send celebratory message to #sales-wins channel

**Slack Message Template (for `won`):**
```
🎉 Deal Won!
{{ $json.data.fullName }} — ${{ $json.data.estimatedValue }}
From: {{ $json.data.previousStatus }}
```

---

## Security

### Authentication

Every webhook request includes a bearer token:

```
Authorization: Bearer {N8N_WEBHOOK_SECRET}
```

This secret must match between the CRM environment variable and the n8n Webhook node configuration.

### Best Practices

1. **Use a strong, random secret** — at least 32 characters. Generate with:
   ```bash
   openssl rand -base64 32
   ```

2. **Never expose the webhook secret** in client-side code, logs, or version control.

3. **Use HTTPS** — Ensure both the CRM and n8n instances are served over HTTPS.

4. **Set reasonable timeouts** — The webhook service times out after 10 seconds to prevent hanging requests.

5. **Validate in n8n** — Add an IF node at the start of each workflow to verify the event type matches what you expect.

---

## Testing the Integration

### 1. Health Check

Verify the webhook endpoint is reachable:

```bash
curl https://your-crm.com/api/webhook/n8n \
  -H "x-api-key: your-webhook-secret"
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "webhook": "nexuscrm-n8n-integration",
  "supportedEvents": [...]
}
```

### 2. Send a Test Event

```bash
curl -X POST https://your-crm.com/api/webhook/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-webhook-secret" \
  -d '{
    "event": "lead.created",
    "timestamp": "2026-06-13T12:00:00.000Z",
    "data": {
      "id": "lead-test-001",
      "fullName": "Test Lead",
      "email": "test@example.com",
      "status": "new"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Lead created: Test Lead (lead-test-001)",
  "receivedAt": "2026-06-13T12:00:01.000Z"
}
```

### 3. Verify in n8n

- Open your n8n workflow
- Click **Webhook** → **Execute Node** to listen for events
- Trigger the event from your CRM
- Watch the execution log in n8n

---

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Webhook returns 401 | Secret mismatch | Verify `N8N_WEBHOOK_SECRET` matches between CRM and n8n |
| Webhook returns 400 "Missing required fields" | Payload structure incorrect | Verify `event`, `timestamp`, and `data` are all present |
| n8n doesn't receive event | `N8N_WEBHOOK_URL` not set or incorrect | Check environment variable and n8n webhook URL |
| n8n receives event but workflow doesn't run | Workflow not activated | Toggle workflow to Active in n8n |
| `triggerWebhook()` returns false silently | Webhooks not enabled or network error | Call `triggerWebhookWithDetails()` for diagnostics |
| CORS errors | Request coming from browser, not server | Webhooks are server-to-server only; never fire from client code |

---

## Integrating into CRM Services

To send webhook events from CRM services, add webhook triggers after data mutations.

### Example: Adding to Lead Service

```typescript
// In services/lead.service.ts, after creating a lead:
import { isWebhookEnabled, triggerWebhook } from '@/services/webhook.service';

// Inside the create() method, after successful creation:
if (isWebhookEnabled()) {
  // Fire-and-forget: do not await (don't block the response)
  triggerWebhook('lead.created', {
    id: newLead.id,
    fullName: newLead.fullName,
    email: newLead.email,
    status: newLead.status,
    estimatedValue: newLead.estimatedValue,
  }).catch(() => {
    // Logging is handled inside triggerWebhook
  });
}
```

### Best Practice: Fire-and-Forget

Webhook triggers should be fire-and-forget to avoid slowing down the primary operation:

```typescript
// ✅ Recommended pattern
if (isWebhookEnabled()) {
  triggerWebhook('lead.created', payload).catch(() => {});
}

// ❌ Avoid: awaiting blocks the response
await triggerWebhook('lead.created', payload);
```

---

## API Reference

### `POST /api/webhook/n8n`

Receive and process webhook events from n8n.

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {secret}` | Yes |
| `Content-Type` | `application/json` | Yes |

**Request Body:** See [Payload Format](#payload-format) above.

**Response Codes:**
| Code | Description |
|------|-------------|
| `200` | Event processed successfully |
| `400` | Invalid payload (missing fields, bad event, bad timestamp) |
| `401` | Missing or invalid Authorization header |
| `405` | Method not allowed |
| `500` | Internal server error |

### `GET /api/webhook/n8n`

Health check and capability discovery. Requires `x-api-key` header.

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| `x-api-key` | `{N8N_WEBHOOK_SECRET}` | Yes |

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "webhook": "nexuscrm-n8n-integration",
  "supportedEvents": ["lead.created", "lead.updated", ...]
}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `app/api/webhook/n8n/route.ts` | Next.js API route handler — receives POST events, returns health check on GET |
| `services/webhook.service.ts` | Service layer — sends events to n8n endpoint, config management |
| `docs/N8N_INTEGRATION.md` | This guide — setup instructions, workflows, troubleshooting |
