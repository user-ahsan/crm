# API Reference

## NexusCRM — n8n Webhook API

---

This document covers the n8n webhook API endpoints. The only external API exposed by NexusCRM is the n8n integration endpoint, which receives webhook events from n8n workflows and processes CRM entity changes.

---

## Endpoint: `/api/webhook/n8n`

**Base URL:** `https://your-crm.com/api/webhook/n8n`

### POST `/api/webhook/n8n`

Receives and processes webhook events from n8n workflows.

**Authentication:** `Authorization: Bearer {N8N_WEBHOOK_SECRET}`

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {secret}` | Yes |
| `Content-Type` | `application/json` | Yes |

**Request Body:**
```typescript
interface WebhookPayload {
  event: WebhookEvent;     // The event type (see catalog below)
  timestamp: string;       // ISO 8601 timestamp
  data: Record<string, unknown>;  // Event payload data
  metadata?: Record<string, unknown>;  // Optional additional context
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lead created: Jane Doe (lead-abc123)",
  "receivedAt": "2026-06-13T14:30:01.000Z"
}
```

**Error Responses:**

```json
// 400 — Missing required fields
{ "success": false, "error": "Missing required fields: event, timestamp, data" }

// 400 — Unsupported event
{ "success": false, "error": "Unsupported event: lead.archived. Supported events: lead.created, ..." }

// 400 — Invalid timestamp
{ "success": false, "error": "Invalid timestamp format. Must be ISO 8601." }

// 400 — Invalid JSON
{ "success": false, "error": "Invalid JSON payload" }

// 401 — Unauthorized
{ "success": false, "error": "Unauthorized" }

// 500 — Internal error
{ "success": false, "error": "Webhook secret not configured" }
```

**Response Codes:**
| Code | Description |
|------|-------------|
| `200` | Event processed successfully |
| `400` | Invalid payload (missing fields, bad event, bad timestamp) |
| `401` | Missing or invalid Authorization header |
| `405` | Method not allowed |
| `500` | Internal server error |

---

### GET `/api/webhook/n8n`

Health check and capability discovery.

**Authentication:** `x-api-key: {N8N_WEBHOOK_SECRET}`

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| `x-api-key` | `{secret}` | Yes |

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "webhook": "nexuscrm-n8n-integration",
  "supportedEvents": [
    "lead.created",
    "lead.updated",
    "lead.deleted",
    "lead.status_changed",
    "contact.created",
    "contact.updated",
    "contact.deleted",
    "company.created",
    "company.updated",
    "company.deleted",
    "task.created",
    "task.completed",
    "task.overdue",
    "meeting.created",
    "meeting.completed"
  ]
}
```

---

## Event Type Catalog (15 Events)

### Lead Events

| Event | Triggered When | Sample Data |
|-------|---------------|-------------|
| `lead.created` | A new lead is created | `{ id, fullName, email, status, estimatedValue, source, priority }` |
| `lead.updated` | An existing lead is modified | `{ id, fullName, ...changedFields }` |
| `lead.deleted` | A lead is removed | `{ id, fullName }` |
| `lead.status_changed` | Lead moves between pipeline stages | `{ id, fullName, previousStatus, status }` |

### Contact Events

| Event | Triggered When | Sample Data |
|-------|---------------|-------------|
| `contact.created` | A new contact is created | `{ id, name, email, companyId }` |
| `contact.updated` | An existing contact is modified | `{ id, name, ...changedFields }` |
| `contact.deleted` | A contact is removed | `{ id, name }` |

### Company Events

| Event | Triggered When | Sample Data |
|-------|---------------|-------------|
| `company.created` | A new company is created | `{ id, name, industry, revenue }` |
| `company.updated` | An existing company is modified | `{ id, name, ...changedFields }` |
| `company.deleted` | A company is removed | `{ id, name }` |

### Task Events

| Event | Triggered When | Sample Data |
|-------|---------------|-------------|
| `task.created` | A new task is created | `{ id, title, assignedTo, dueDate, priority }` |
| `task.completed` | A task is marked complete | `{ id, title, assignedTo }` |
| `task.overdue` | A task's due date has passed | `{ id, title, assignedTo, dueDate }` |

### Meeting Events

| Event | Triggered When | Sample Data |
|-------|---------------|-------------|
| `meeting.created` | A meeting is scheduled | `{ id, title, dateTime, participants, type }` |
| `meeting.completed` | A meeting is marked done | `{ id, title, outcome, notes }` |

---

## Webhook Payload JSON Schemas

### Lead Event Payloads

```json
// lead.created
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
  }
}

// lead.status_changed
{
  "event": "lead.status_changed",
  "timestamp": "2026-06-13T15:00:00.000Z",
  "data": {
    "id": "lead-abc123",
    "fullName": "Jane Doe",
    "previousStatus": "contacted",
    "status": "qualified"
  }
}
```

### Contact Event Payloads

```json
// contact.created
{
  "event": "contact.created",
  "timestamp": "2026-06-13T14:30:00.000Z",
  "data": {
    "id": "cont-def456",
    "name": "John Smith",
    "email": "john@example.com",
    "companyId": "comp-789"
  }
}
```

### Task Event Payloads

```json
// task.created
{
  "event": "task.created",
  "timestamp": "2026-06-13T14:30:00.000Z",
  "data": {
    "id": "task-ghi789",
    "title": "Follow up on proposal",
    "assignedTo": "user-001",
    "dueDate": "2026-06-20T17:00:00.000Z",
    "priority": "high"
  }
}
```

### Meeting Event Payloads

```json
// meeting.created
{
  "event": "meeting.created",
  "timestamp": "2026-06-13T14:30:00.000Z",
  "data": {
    "id": "mtg-012",
    "title": "Product Demo",
    "dateTime": "2026-06-15T10:00:00.000Z",
    "participants": ["alice@crm.com", "jane@example.com"],
    "type": "online"
  }
}
```

---

## Rate Limiting

The webhook endpoint does not implement built-in rate limiting. For production use:

- Configure rate limiting at the infrastructure level (Vercel, Cloudflare, nginx)
- Set reasonable timeouts — the route handler has a 10-second timeout for outgoing requests
- The webhook service sends events fire-and-forget (non-blocking to the primary operation)

---

## TypeScript Type Reference

```typescript
// From app/api/webhook/n8n/route.ts
export type WebhookEvent =
  | 'lead.created' | 'lead.updated' | 'lead.deleted' | 'lead.status_changed'
  | 'contact.created' | 'contact.updated' | 'contact.deleted'
  | 'company.created' | 'company.updated' | 'company.deleted'
  | 'task.created' | 'task.completed' | 'task.overdue'
  | 'meeting.created' | 'meeting.completed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

---

## Integration Points

### Webhook Service (Outbound)

The `services/webhook.service.ts` sends events to n8n:

```typescript
// Fire-and-forget pattern
if (isWebhookEnabled()) {
  triggerWebhook('lead.created', {
    id: lead.id,
    fullName: lead.fullName,
    email: lead.email,
    status: lead.status,
  }).catch(() => { /* logging handled internally */ });
}

// Diagnostic variant
const result = await triggerWebhookWithDetails('lead.created', leadData);
if (!result.success) {
  console.error('Webhook failed:', result.error);
}
```

### Service Integration

The following services integrate webhook triggers:
- `lead.service.ts` — created, updated, deleted, status_changed
- `contact.service.ts` — created, updated, deleted
- `company.service.ts` — created, updated, deleted
- `task.service.ts` — created, completed, overdue
- `meeting.service.ts` — created, completed

See [SERVICES.md](./SERVICES.md) for detailed service documentation.

---

## Testing the Webhook

```bash
# Health check (GET)
curl https://your-crm.com/api/webhook/n8n \
  -H "x-api-key: your-webhook-secret"

# Send test event (POST)
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

---

## See Also

- [N8N_INTEGRATION.md](../features/N8N_INTEGRATION.md) — Full integration guide (setup, workflows, troubleshooting)
- [SERVICES.md](./SERVICES.md) — Service layer documentation
- [SETUP.md](../guides/SETUP.md) — Environment variable setup
