/**
 * ─── Mock Supabase Client ────────────────────────────────────────────────
 *
 * Drop-in, network-free stand-in for the Supabase client, used when
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are absent
 * (mock mode — the documented default for local dev; see
 * .tmp/audit/fixes/PATTERN-mock-mode.md for the contract every service
 * agent follows).
 *
 * Behavior contract:
 *  - `from(table)` resolves rows from the matching `data/*.ts` array.
 *    CamelCase domain rows are converted to snake_case PostgREST-shaped
 *    rows (services' mapRow* functions read snake_case columns). Tables
 *    without a seed array start empty and accept inserts.
 *  - Query surface: select / insert / update / delete / upsert with
 *    eq / neq / is / in / or / not / gte / lte / gt / lt / like / ilike /
 *    contains filters, order / limit / range paging, single / maybeSingle,
 *    embedded relations (`embed(*)`), aggregates (count(*) / sum(col)),
 *    and head-count selects.
 *  - insert auto-populates `id` + per-table timestamps.
 *  - `.single()` on zero rows → `{ code: 'PGRST116' }` (PostgREST parity).
 *  - Filters on columns that don't exist on a row return empty — never throw.
 *  - Referential integrity is NOT enforced (mock stays lenient).
 *  - auth.getUser()/getSession() return a demo user seeded from the mock
 *    team members so user-scoped service flows work; mutating auth flows
 *    (signUp / signInWithPassword / resetPasswordForEmail / admin) return
 *    a clear "auth unavailable in mock mode" error.
 *  - storage throws a clear "storage unavailable in mock mode" error —
 *    file attachments stay real-Supabase-only.
 * ────────────────────────────────────────────────────────────────────────
 */

import type { Session, User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';
import { leads } from '@/data/leads';
import { contacts } from '@/data/contacts';
import { companies } from '@/data/companies';
import { deals } from '@/data/deals';
import { tasks } from '@/data/tasks';
import { meetings } from '@/data/meetings';
import { activities } from '@/data/activities';
import { teams } from '@/data/teams';
import { teamMembers } from '@/data/team-members';
import { teamInvitations } from '@/data/team-invitations';
import { quotes } from '@/data/quotes';
import { emailSequences } from '@/data/campaigns';
import { invoices, invoiceTemplates } from '@/data/invoices';
import { USERS } from '@/data/mock-users';

// ── Shared types ─────────────────────────────────────────────────────────

/** A PostgREST-shaped row: flat record of snake_case columns. */
export type MockRow = Record<string, unknown>;

/** PostgREST-style error payload. Mirrors real Supabase errors: extends Error so
 *  `e instanceof Error` checks in callers (e.g. store/auth.ts) surface the message. */
export class MockError extends Error {
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(code: string, message: string, details: string | null = null, hint: string | null = null) {
    super(message);
    this.name = 'MockError';
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

/** Result of a list-style query (select / insert / update / delete / upsert). */
export interface MockListResult<Row extends MockRow> {
  data: Row[] | null;
  error: MockError | null;
  count: number | null;
}

/** Result of `.single()` / `.maybeSingle()`. */
export interface MockSingleResult<Row extends MockRow> {
  data: Row | null;
  error: MockError | null;
}

// ── Filter model ─────────────────────────────────────────────────────────

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'neq'; column: string; value: unknown }
  | { type: 'is'; column: string; value: unknown }
  | { type: 'in'; column: string; values: unknown[] }
  | { type: 'not'; column: string; op: Filter; value: unknown }
  | { type: 'or'; filters: Filter[] }
  | { type: 'gte'; column: string; value: unknown }
  | { type: 'lte'; column: string; value: unknown }
  | { type: 'gt'; column: string; value: unknown }
  | { type: 'lt'; column: string; value: unknown }
  | { type: 'like'; column: string; pattern: string; insensitive: boolean }
  | { type: 'contains'; column: string; values: unknown[] };

const OP_TO_FILTER: Record<string, (column: string, value: string) => Filter | null> = {
  eq: (column, value) => ({ type: 'eq', column, value: parseScalar(value) }),
  neq: (column, value) => ({ type: 'neq', column, value: parseScalar(value) }),
  is: (column, value) => ({ type: 'is', column, value: parseScalar(value) }),
  in: (column, value) => ({ type: 'in', column, values: value.split(',').map(parseScalar) }),
  gte: (column, value) => ({ type: 'gte', column, value: parseScalar(value) }),
  lte: (column, value) => ({ type: 'lte', column, value: parseScalar(value) }),
  gt: (column, value) => ({ type: 'gt', column, value: parseScalar(value) }),
  lt: (column, value) => ({ type: 'lt', column, value: parseScalar(value) }),
  like: (column, value) => ({ type: 'like', column, pattern: value, insensitive: false }),
  ilike: (column, value) => ({ type: 'like', column, pattern: value, insensitive: true }),
  contains: (column, value) => ({ type: 'contains', column, values: value.split(',').map(parseScalar) }),
};

/** Parses a PostgREST `or(...)` filter string: `col.op.value,col.op.value`. */
function parseOr(filter: string): Filter[] {
  const filters: Filter[] = [];
  for (const token of filter.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const dot = trimmed.indexOf('.');
    if (dot <= 0) continue;
    const column = trimmed.slice(0, dot);
    const rest = trimmed.slice(dot + 1);
    const opDot = rest.indexOf('.');
    if (opDot <= 0) continue;
    const op = rest.slice(0, opDot);
    const rawValue = rest.slice(opDot + 1);
    const builder = OP_TO_FILTER[op];
    if (!builder) continue;
    const parsed = builder(column, rawValue);
    if (parsed) filters.push(parsed);
  }
  return filters;
}

/** Coerces a PostgREST string literal back to a JS value. */
function parseScalar(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

/** Escapes regex special characters for like/ilike matching. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compares two values for ordering / range filters (numbers numerically, rest lexically). */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function columnValue(row: MockRow, column: string): unknown {
  return row[column];
}

/**
 * Evaluates a filter against a row. Missing columns never match (mirrors
 * PostgREST's rejection of unknown filter columns pragmatically: empty
 * result instead of an error).
 */
function matchesFilter(row: MockRow, filter: Filter): boolean {
  switch (filter.type) {
    case 'eq': {
      const value = columnValue(row, filter.column);
      return value !== undefined && value === filter.value;
    }
    case 'neq': {
      const value = columnValue(row, filter.column);
      return value !== undefined && value !== filter.value;
    }
    case 'is': {
      const value = columnValue(row, filter.column);
      if (value === undefined) return false;
      if (filter.value === null) return value === null || value === undefined;
      return value === filter.value;
    }
    case 'in': {
      const value = columnValue(row, filter.column);
      return value !== undefined && filter.values.includes(value);
    }
    case 'not': {
      return !matchesFilter(row, filter.op);
    }
    case 'or': {
      return filter.filters.some((f) => matchesFilter(row, f));
    }
    case 'gte': {
      const value = columnValue(row, filter.column);
      return value !== undefined && compareValues(value, filter.value) >= 0;
    }
    case 'lte': {
      const value = columnValue(row, filter.column);
      return value !== undefined && compareValues(value, filter.value) <= 0;
    }
    case 'gt': {
      const value = columnValue(row, filter.column);
      return value !== undefined && compareValues(value, filter.value) > 0;
    }
    case 'lt': {
      const value = columnValue(row, filter.column);
      return value !== undefined && compareValues(value, filter.value) < 0;
    }
    case 'like': {
      const value = columnValue(row, filter.column);
      if (value === undefined || typeof value !== 'string') return false;
      const regex = new RegExp(
        `^${filter.pattern.split('%').map(escapeRegex).join('.*')}$`,
        filter.insensitive ? 'i' : '',
      );
      return regex.test(value);
    }
    case 'contains': {
      const value = columnValue(row, filter.column);
      if (!Array.isArray(value)) return false;
      return filter.values.every((v) => value.includes(v));
    }
  }
}

// ── Store / seed ─────────────────────────────────────────────────────────

/** Per-table timestamp columns auto-populated on insert (PostgREST parity). */
const TIMESTAMP_COLUMNS: Record<string, string[]> = {
  leads: ['created_at', 'updated_at'],
  contacts: ['created_at', 'updated_at'],
  companies: ['created_at', 'updated_at'],
  deals: ['created_at', 'updated_at'],
  tasks: ['created_at', 'updated_at'],
  meetings: ['created_at', 'updated_at'],
  activities: ['timestamp'],
  teams: ['created_at', 'updated_at'],
  team_members: ['joined_at'],
  team_invitations: ['created_at'],
  quotes: ['created_at', 'updated_at'],
  email_sequences: ['created_at', 'updated_at'],
  invoices: ['created_at', 'updated_at'],
  invoice_templates: ['created_at', 'updated_at'],
  automation_rules: ['created_at', 'updated_at'],
  email_history: ['created_at'],
  call_logs: ['created_at'],
  tags: ['created_at'],
  taggings: ['created_at'],
  notes: ['created_at', 'updated_at'],
  lead_scores: ['updated_at'],
  deal_stages: ['created_at'],
  forecasts: ['created_at', 'updated_at'],
  file_attachments: ['created_at'],
  goals: ['created_at', 'updated_at'],
  campaign_emails: ['created_at'],
  campaign_recipients: ['created_at'],
  saved_views: ['created_at', 'updated_at'],
  api_keys: ['created_at'],
  webhook_configs: ['created_at', 'updated_at'],
  webhook_deliveries: ['created_at'],
  notification_preferences: ['created_at', 'updated_at'],
  workflow_states: ['created_at'],
  workflow_transitions: ['created_at'],
  portal_users: ['created_at'],
  portal_shares: ['created_at'],
  sms_logs: ['created_at'],
  calendar_integrations: ['created_at'],
  user_settings: ['updated_at'],
  service_configs: ['updated_at'],
};

/** Embedded-relation config: how `select('*, child(*)')` resolves. */
interface EmbedConfig {
  /** Child table to read rows from. */
  table: string;
  /** For to-many: child column that references the parent id. */
  column: string;
  /** For to-one: parent column that references the child id. */
  joinColumn: string;
  /** true → array of children; false → single child row or null. */
  many: boolean;
}

const EMBED_CONFIG: Record<string, EmbedConfig> = {
  quotes: { table: 'quote_items', column: 'quote_id', joinColumn: 'id', many: true },
  invoices: { table: 'invoice_items', column: 'invoice_id', joinColumn: 'id', many: true },
  deals: { table: 'deal_stages', column: 'id', joinColumn: 'stage_id', many: false },
};

/** camelCase → snake_case (fullName → full_name). */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

/** Converts a camelCase domain row (data/*.ts) into a snake_case PostgREST row. */
function snakeRow(row: Record<string, unknown>): MockRow {
  const out: MockRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[camelToSnake(key)] = value;
  }
  return out;
}

const stores = new Map<string, MockRow[]>();

let storesInitialized = false;

function getStore(table: string): MockRow[] {
  let rows = stores.get(table);
  if (!rows) {
    rows = [];
    stores.set(table, rows);
  }
  return rows;
}

interface SeedOptions {
  /** Nested child rows extracted into their own table (quotes/invoices items). */
  extractItems?: { into: string; itemKey: string };
}

/** Seeds a table from a camelCase domain array (data/*.ts). */
function seedFromDomainRows(table: string, rows: Array<Record<string, unknown>>, options?: SeedOptions): void {
  const store = getStore(table);
  for (const row of rows) {
    const converted = snakeRow(row);
    if (options?.extractItems) {
      const items = converted[options.extractItems.itemKey];
      delete converted[options.extractItems.itemKey];
      if (Array.isArray(items)) {
        const childStore = getStore(options.extractItems.into);
        for (const item of items) {
          if (item && typeof item === 'object') {
            childStore.push(snakeRow(item as Record<string, unknown>));
          }
        }
      }
    }
    store.push(converted);
  }
}

/**
 * Seeds the phantom `profiles` table (queried by lead/contact services for
 * assignedTo validation). Real Supabase has no `profiles` migration (audit
 * P1) — mock mode sources known users from the mock team members so the
 * documented assign-to-user flow works without Supabase.
 */
function seedProfiles(): void {
  const profiles = getStore('profiles');
  for (const member of teamMembers) {
    profiles.push({
      id: member.userId,
      name: member.user?.name ?? null,
      email: member.user?.email ?? null,
    });
  }
  for (const user of USERS) {
    if (user && typeof user === 'object' && user.id) {
      profiles.push({ id: user.id, name: user.name ?? null, email: null });
    }
  }
}

function initializeStores(): void {
  if (storesInitialized) return;
  storesInitialized = true;
  seedFromDomainRows('leads', leads);
  seedFromDomainRows('contacts', contacts);
  seedFromDomainRows('companies', companies);
  seedFromDomainRows('deals', deals);
  seedFromDomainRows('tasks', tasks);
  seedFromDomainRows('meetings', meetings);
  seedFromDomainRows('activities', activities);
  seedFromDomainRows('teams', teams);
  seedFromDomainRows('team_members', teamMembers);
  seedFromDomainRows('team_invitations', teamInvitations);
  seedFromDomainRows('quotes', quotes, { extractItems: { into: 'quote_items', itemKey: 'items' } });
  seedFromDomainRows('email_sequences', emailSequences);
  seedFromDomainRows('invoices', invoices, { extractItems: { into: 'invoice_items', itemKey: 'items' } });
  seedFromDomainRows('invoice_templates', invoiceTemplates);
  seedProfiles();
}

// ── Row helpers ──────────────────────────────────────────────────────────

/** Generates a unique id for mock rows (crypto when available). */
function generateId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Drops undefined values (PostgREST serializes undefined as omitted). */
function cleanValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Completes a row with id + per-table timestamps before insert. */
function completeInsertRow(table: string, row: Record<string, unknown>): MockRow {
  const out: MockRow = { ...row };
  if (out.id === undefined || out.id === null || out.id === '') {
    out.id = generateId();
  }
  const timestampColumns = TIMESTAMP_COLUMNS[table] ?? [];
  const now = new Date().toISOString();
  for (const column of timestampColumns) {
    if (out[column] === undefined || out[column] === null) {
      out[column] = now;
    }
  }
  return out;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

// ── Projection / embeds / aggregates ─────────────────────────────────────

interface ParsedSelect {
  wildcard: boolean;
  columns: string[];
  embeds: Array<{ alias: string; table: string }>;
  aggregate: boolean;
  groups: string[];
  countAlias: string | null;
  sumAliases: Array<{ alias: string; column: string }>;
}

function parseSelect(columns: string | undefined | null): ParsedSelect {
  const parsed: ParsedSelect = {
    wildcard: false,
    columns: [],
    embeds: [],
    aggregate: false,
    groups: [],
    countAlias: null,
    sumAliases: [],
  };
  if (!columns || columns === '*') {
    parsed.wildcard = true;
    return parsed;
  }
  for (const rawToken of columns.split(',')) {
    const token = rawToken.trim();
    if (!token) continue;
    if (token === '*') {
      parsed.wildcard = true;
      continue;
    }
    const aliasMatch = /^([a-zA-Z_][a-zA-Z0-9_]*):([a-zA-Z_][a-zA-Z0-9_]*)\((\*|[a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(token);
    if (aliasMatch) {
      const alias = aliasMatch[1];
      const fn = aliasMatch[2];
      const arg = aliasMatch[3];
      if (fn === 'count' && arg === '*') {
        parsed.aggregate = true;
        parsed.countAlias = alias;
      } else if (fn === 'sum') {
        parsed.aggregate = true;
        parsed.sumAliases.push({ alias, column: arg });
      }
      continue;
    }
    const embedMatch = /^([a-zA-Z_][a-zA-Z0-9_]*:\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\(\*\)$/.exec(token);
    if (embedMatch) {
      const alias = (embedMatch[1] ? embedMatch[1].replace(/:\s*$/, '') : null) ?? embedMatch[2];
      parsed.embeds.push({ alias, table: embedMatch[2] });
      continue;
    }
    parsed.columns.push(token);
  }
  if (parsed.countAlias || parsed.sumAliases.length > 0) {
    parsed.groups = parsed.columns;
    parsed.columns = [];
  }
  return parsed;
}

/** Resolves one embedded relation for a parent row. */
function resolveEmbed(parent: MockRow, embed: { alias: string; table: string }): unknown {
  const config = EMBED_CONFIG[embed.table];
  if (!config) return undefined;
  const childStore = getStore(config.table);
  if (config.many) {
    return childStore.filter((child) => child[config.column] === parent.id);
  }
  const joinValue = parent[config.joinColumn];
  if (joinValue === undefined || joinValue === null) return null;
  return childStore.find((child) => child.id === joinValue) ?? null;
}

/** Projects a row to the requested columns and attaches embeds. */
function projectRow(row: MockRow, parsed: ParsedSelect): MockRow {
  let projected: MockRow;
  if (parsed.wildcard) {
    projected = { ...row };
  } else {
    projected = {};
    for (const column of parsed.columns) {
      if (column in row) projected[column] = row[column];
    }
  }
  for (const embed of parsed.embeds) {
    projected[embed.alias] = resolveEmbed(row, embed);
  }
  return projected;
}

/** Applies aggregate select (`status, count:count(*), value:sum(col)`). */
function applyAggregate(rows: MockRow[], parsed: ParsedSelect): MockRow[] {
  const groups = new Map<string, MockRow[]>();
  for (const row of rows) {
    const key = parsed.groups.map((g) => JSON.stringify(row[g])).join('|');
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  const result: MockRow[] = [];
  for (const groupRows of groups.values()) {
    const out: MockRow = {};
    for (const group of parsed.groups) {
      out[group] = groupRows[0][group];
    }
    if (parsed.countAlias) {
      out[parsed.countAlias] = groupRows.length;
    }
    for (const sum of parsed.sumAliases) {
      out[sum.alias] = groupRows.reduce((total, r) => total + toNumber(r[sum.column]), 0);
    }
    result.push(out);
  }
  return result;
}

// ── Query builder ────────────────────────────────────────────────────────

interface OrderBy {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

interface SelectOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
}

interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

/**
 * Filter/transform builder returned by select/insert/update/delete/upsert.
 * Thenable: `await`ing it runs the query and returns a PostgREST-shaped
 * `{ data, error, count }` result.
 */
export class MockFilterBuilder<Row extends MockRow = MockRow> {
  private readonly table: string;
  private readonly op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  private readonly values: unknown;
  private readonly upsertOptions: UpsertOptions | undefined;
  private readonly selectOptions: SelectOptions | undefined;
  private filters: Filter[] = [];
  private orderBy: OrderBy | null = null;
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private selectColumns: string | null = null;
  private returning = false;

  constructor(options: {
    table: string;
    op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
    values?: unknown;
    upsertOptions?: UpsertOptions;
    selectOptions?: SelectOptions;
  }) {
    this.table = options.table;
    this.op = options.op;
    this.values = options.values;
    this.upsertOptions = options.upsertOptions;
    this.selectOptions = options.selectOptions;
    if (this.op === 'select') {
      this.selectColumns = null;
      this.returning = true;
    }
  }

  /** Sets the projection (also enables returning rows for mutations). */
  select(columns?: string | null, opts?: SelectOptions): this {
    this.selectColumns = columns ?? null;
    this.returning = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ type: 'is', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  not(column: string, op: string, value: unknown): this {
    const operator = OP_TO_FILTER[op];
    if (!operator) return this;
    const inner = operator(column, String(value));
    if (!inner) return this;
    this.filters.push({ type: 'not', column, op: inner, value });
    return this;
  }

  or(filter: string): this {
    const parsed = parseOr(filter);
    if (parsed.length > 0) {
      this.filters.push({ type: 'or', filters: parsed });
    }
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push({ type: 'like', column, pattern, insensitive: false });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ type: 'like', column, pattern, insensitive: true });
    return this;
  }

  contains(column: string, values: unknown[]): this {
    this.filters.push({ type: 'contains', column, values });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy = {
      column,
      ascending: opts?.ascending ?? true,
      nullsFirst: opts?.nullsFirst ?? false,
    };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  /** Returns a single row; zero rows → PGRST116 (PostgREST parity). */
  async single(): Promise<MockSingleResult<Row>> {
    const result = await this.execute();
    const rows = result.data ?? [];
    if (rows.length === 0) {
      return { data: null, error: mockError('PGRST116', 'JSON object requested, multiple (or no) rows returned') };
    }
    return { data: rows[0], error: null };
  }

  /** Returns a single row or null; never errors on zero rows. */
  async maybeSingle(): Promise<MockSingleResult<Row>> {
    const result = await this.execute();
    const rows = result.data ?? [];
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  }

  then<TResult1 = MockListResult<Row>, TResult2 = never>(
    onfulfilled?: ((value: MockListResult<Row>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private filteredRows(): MockRow[] {
    const store = getStore(this.table);
    const rows = store.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));
    if (this.orderBy) {
      rows.sort((a, b) => {
        const av = a[this.orderBy!.column];
        const bv = b[this.orderBy!.column];
        const aNull = av === undefined || av === null;
        const bNull = bv === undefined || bv === null;
        if (aNull && bNull) return 0;
        if (aNull) return this.orderBy!.nullsFirst ? -1 : 1;
        if (bNull) return this.orderBy!.nullsFirst ? 1 : -1;
        const cmp = compareValues(av, bv);
        return this.orderBy!.ascending ? cmp : -cmp;
      });
    }
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      return rows.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.limitCount !== null) {
      return rows.slice(0, this.limitCount);
    }
    return rows;
  }

  /** Runs the query and returns projected rows (single/aggregate aware). */
  private async execute(): Promise<MockListResult<Row>> {
    switch (this.op) {
      case 'select': {
        const parsed = parseSelect(this.selectColumns);
        const rows = this.filteredRows();
        const count = this.selectOptions?.count ? rows.length : null;
        if (this.selectOptions?.head) {
          return { data: [], error: null, count };
        }
        const projected = parsed.aggregate ? applyAggregate(rows, parsed) : rows.map((row) => projectRow(row, parsed));
        return { data: projected as Row[], error: null, count };
      }
      case 'insert': {
        const inserted = this.insertRows();
        if (!this.returning) {
          return { data: null, error: null, count: this.selectOptions?.count ? inserted.length : null };
        }
        const parsed = parseSelect(this.selectColumns);
        const projected = parsed.aggregate
          ? applyAggregate(inserted, parsed)
          : inserted.map((row) => projectRow(row, parsed));
        return { data: projected as Row[], error: null, count: this.selectOptions?.count ? inserted.length : null };
      }
      case 'update': {
        const updated = this.updateRows();
        if (!this.returning) {
          return { data: null, error: null, count: this.selectOptions?.count ? updated.length : null };
        }
        const parsed = parseSelect(this.selectColumns);
        const projected = parsed.aggregate
          ? applyAggregate(updated, parsed)
          : updated.map((row) => projectRow(row, parsed));
        return { data: projected as Row[], error: null, count: this.selectOptions?.count ? updated.length : null };
      }
      case 'delete': {
        const deleted = this.deleteRows();
        if (!this.returning) {
          return { data: null, error: null, count: this.selectOptions?.count ? deleted.length : null };
        }
        const parsed = parseSelect(this.selectColumns);
        const projected = parsed.aggregate
          ? applyAggregate(deleted, parsed)
          : deleted.map((row) => projectRow(row, parsed));
        return { data: projected as Row[], error: null, count: this.selectOptions?.count ? deleted.length : null };
      }
      case 'upsert': {
        const upserted = this.upsertRows();
        if (!this.returning) {
          return { data: null, error: null, count: this.selectOptions?.count ? upserted.length : null };
        }
        const parsed = parseSelect(this.selectColumns);
        const projected = parsed.aggregate
          ? applyAggregate(upserted, parsed)
          : upserted.map((row) => projectRow(row, parsed));
        return { data: projected as Row[], error: null, count: this.selectOptions?.count ? upserted.length : null };
      }
      default: {
        return { data: null, error: null, count: null };
      }
    }
  }

  private normalizeValues(): MockRow[] {
    if (Array.isArray(this.values)) {
      return this.values
        .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object')
        .map((v) => cleanValues(v));
    }
    if (this.values && typeof this.values === 'object') {
      return [cleanValues(this.values as Record<string, unknown>)];
    }
    return [];
  }

  private insertRows(): MockRow[] {
    const store = getStore(this.table);
    const inserted: MockRow[] = [];
    for (const value of this.normalizeValues()) {
      const row = completeInsertRow(this.table, value);
      store.push(row);
      inserted.push(row);
    }
    return inserted;
  }

  private updateRows(): MockRow[] {
    const store = getStore(this.table);
    const values = this.normalizeValues()[0] ?? {};
    const timestampColumns = TIMESTAMP_COLUMNS[this.table] ?? [];
    const now = new Date().toISOString();
    const updated: MockRow[] = [];
    for (const row of store) {
      if (!this.filters.every((filter) => matchesFilter(row, filter))) continue;
      const merged: MockRow = { ...row, ...values };
      if (timestampColumns.includes('updated_at') && values.updated_at === undefined) {
        merged.updated_at = now;
      }
      Object.assign(row, merged);
      updated.push(merged);
    }
    return updated;
  }

  private deleteRows(): MockRow[] {
    const store = getStore(this.table);
    const deleted: MockRow[] = [];
    for (let index = store.length - 1; index >= 0; index -= 1) {
      const row = store[index];
      if (this.filters.every((filter) => matchesFilter(row, filter))) {
        deleted.unshift(row);
        store.splice(index, 1);
      }
    }
    return deleted;
  }

  private upsertRows(): MockRow[] {
    const store = getStore(this.table);
    // PostgREST on_conflict supports composite keys (e.g. 'year,month,created_by');
    // match every conflict column so multi-column upserts resolve correctly
    // instead of always merging onto the first row.
    const conflictColumns = (this.upsertOptions?.onConflict ?? 'id')
      .split(',')
      .map((column) => column.trim())
      .filter((column) => column.length > 0);
    const rows: MockRow[] = [];
    for (const value of this.normalizeValues()) {
      const existingIndex = store.findIndex((row) =>
        conflictColumns.every((column) => row[column] === value[column]),
      );
      if (existingIndex >= 0) {
        if (this.upsertOptions?.ignoreDuplicates) continue;
        const merged: MockRow = { ...store[existingIndex], ...value };
        const timestampColumns = TIMESTAMP_COLUMNS[this.table] ?? [];
        if (timestampColumns.includes('updated_at') && value.updated_at === undefined) {
          merged.updated_at = new Date().toISOString();
        }
        store[existingIndex] = merged;
        rows.push(merged);
      } else {
        const row = completeInsertRow(this.table, value);
        store.push(row);
        rows.push(row);
      }
    }
    return rows;
  }
}

/** Entry builder returned by `from(table)` — mirrors PostgrestQueryBuilder. */
export class MockQueryBuilder<Row extends MockRow = MockRow> {
  constructor(private readonly table: string) {}

  select(columns?: string | null, opts?: SelectOptions): MockFilterBuilder<Row> {
    return new MockFilterBuilder<Row>({
      table: this.table,
      op: 'select',
      selectOptions: opts,
    }).select(columns ?? null, opts);
  }

  insert(values: unknown): MockFilterBuilder<Row> {
    return new MockFilterBuilder<Row>({
      table: this.table,
      op: 'insert',
      values,
    });
  }

  update(values: unknown): MockFilterBuilder<Row> {
    return new MockFilterBuilder<Row>({
      table: this.table,
      op: 'update',
      values,
    });
  }

  upsert(values: unknown, opts?: UpsertOptions): MockFilterBuilder<Row> {
    return new MockFilterBuilder<Row>({
      table: this.table,
      op: 'upsert',
      values,
      upsertOptions: opts,
    });
  }

  delete(opts?: SelectOptions): MockFilterBuilder<Row> {
    return new MockFilterBuilder<Row>({ table: this.table, op: 'delete' });
  }
}

// ── Auth / storage / channel stubs ───────────────────────────────────────

function mockError(code: string, message: string): MockError {
  return new MockError(code, message);
}

const AUTH_UNAVAILABLE = mockError(
  'mock-auth-unavailable',
  'Mock mode: Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.',
);

const STORAGE_UNAVAILABLE = mockError(
  'mock-storage-unavailable',
  'Mock mode: Supabase Storage is unavailable. File attachments require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
);

/** Builds the demo user from the first seeded profile (mock team member). */
function buildDemoUser(): User {
  const profiles = getStore('profiles');
  const first = profiles[0];
  const id = typeof first?.id === 'string' && first.id ? first.id : 'mock-user-1';
  const name = typeof first?.name === 'string' && first.name ? first.name : 'Demo User';
  const email = typeof first?.email === 'string' && first.email ? first.email : 'demo@nexuscrm.local';
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: null,
    phone: '',
    confirmed_at: null,
    last_sign_in_at: null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: name },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
}

function buildDemoSession(user: User): Session {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
}

interface MockAuthResult {
  data: { user: null; session: null };
  error: MockError;
}

/** Minimal no-op realtime channel surface used by services/realtime.service. */
export class MockRealtimeChannel {
  readonly topic: string;

  constructor(topic: string) {
    this.topic = topic;
  }

  on(_event: string, _opts?: unknown, _callback?: (...args: never[]) => void): this {
    return this;
  }

  subscribe(_callback?: (...args: never[]) => void): this {
    return this;
  }

  async unsubscribe(): Promise<void> {}

  async send(_payload: unknown): Promise<void> {}

  async track(_payload: unknown): Promise<void> {}

  presenceState(): Record<string, unknown[]> {
    return {};
  }
}

/** Minimal storage bucket stub — always throws (attachments are real-only). */
interface MockStorageBucket {
  upload(..._args: unknown[]): never;
  remove(..._args: unknown[]): never;
  getPublicUrl(..._args: unknown[]): never;
}

export interface MockSupabaseClient {
  from(table: string): MockQueryBuilder<MockRow>;
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: null }>;
    getSession(): Promise<{ data: { session: Session | null }; error: null }>;
    onAuthStateChange(
      callback: (...args: never[]) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
    signInWithPassword(_credentials: unknown): Promise<MockAuthResult>;
    signUp(_credentials: unknown): Promise<MockAuthResult>;
    resetPasswordForEmail(_email: string, _options?: unknown): Promise<{ data: null; error: MockError }>;
    signOut(): Promise<{ error: null }>;
  };
  storage: {
    from(_bucket: string): MockStorageBucket;
  };
  channel(topic: string, _params?: unknown): MockRealtimeChannel;
}

/**
 * Creates the shared mock client (network-free). Returns a NEW object with
 * a shared in-memory store per module instance — mutations persist for the
 * lifetime of the page/bundle (mock mode has no persistence by design).
 */
export function createMockClient(): MockSupabaseClient {
  initializeStores();

  const auth: MockSupabaseClient['auth'] = {
    async getUser() {
      return { data: { user: buildDemoUser() }, error: null };
    },
    async getSession() {
      return { data: { session: buildDemoSession(buildDemoUser()) }, error: null };
    },
    onAuthStateChange(_callback: (...args: never[]) => void) {
      return {
        data: {
          subscription: {
            unsubscribe(): void {
              // No-op — mock mode has no live auth channel.
            },
          },
        },
      };
    },
    async signInWithPassword(_credentials: unknown): Promise<MockAuthResult> {
      return { data: { user: null, session: null }, error: AUTH_UNAVAILABLE };
    },
    async signUp(_credentials: unknown): Promise<MockAuthResult> {
      return { data: { user: null, session: null }, error: AUTH_UNAVAILABLE };
    },
    async resetPasswordForEmail(_email: string, _options?: unknown) {
      return { data: null, error: AUTH_UNAVAILABLE };
    },
    async signOut() {
      return { error: null };
    },
  };

  const storage: MockSupabaseClient['storage'] = {
    from(_bucket: string): MockStorageBucket {
      const throwUnavailable = (): never => {
        throw new Error(`${STORAGE_UNAVAILABLE.message} (${STORAGE_UNAVAILABLE.code})`);
      };
      return {
        upload: throwUnavailable,
        remove: throwUnavailable,
        getPublicUrl: throwUnavailable,
      };
    },
  };

  return {
    from(table: string): MockQueryBuilder<MockRow> {
      return new MockQueryBuilder<MockRow>(table);
    },
    auth,
    storage,
    channel(topic: string, _params?: unknown): MockRealtimeChannel {
      return new MockRealtimeChannel(topic);
    },
  };
}

// For typed consumers that need the Database row contract (see PATTERN-mock-mode.md).
export type MockDatabase = Database;
