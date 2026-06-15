#!/usr/bin/env python3
"""
NexusCRM -- Demo Data Seeder
Seeds a complete, production-like demo dataset into Supabase
using the service_role key for admin access.

Usage:
    python seed/seed_demo.py
    python seed/seed_demo.py --clear
    python seed/seed_demo.py --table leads

Environment Variables (from .env or system):
    NEXT_PUBLIC_SUPABASE_URL       Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY      Service role key (admin)
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# ── Optional: requests library ──────────────────────────────────────
try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    import urllib.request
    import urllib.error

# ═══════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"
DATA_FILE = ROOT_DIR / "seed" / "data.json"

# Demo account credentials — password is shared for simplicity
DEMO_PASSWORD = "DemoUser123"

# Tables in dependency order (parents before children)
TABLE_ORDER = [
    "tags",
    "companies",
    "leads",
    "contacts",
    "lead_scores",
    "deal_stages",
    "deals",
    "tasks",
    "meetings",
    "activities",
    "teams",
    "team_members",
    "team_invitations",
    "automation_rules",
    "email_sequences",
    "campaign_emails",
    "quotes",
    "quote_items",
    "forecasts",
    "goals",
    "saved_views",
    "email_history",
    "call_logs",
    "sms_logs",
    "notes",
    "api_keys",
    "workflow_states",
    "workflow_transitions",
    "calendar_integrations",
    "portal_users",
    "portal_shares",
    "file_attachments",
]


# ═══════════════════════════════════════════════════════════════════
#  ENV LOADER (lightweight, no deps)
# ═══════════════════════════════════════════════════════════════════

def load_env():
    """Load variables from .env file into os.environ."""
    if not ENV_FILE.exists():
        print(f"  .env file not found at {ENV_FILE}")
        print("   Will rely on system environment variables.")
        return
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if len(val) > 1 and val[0] in ('"', "'") and val[0] == val[-1]:
                val = val[1:-1]
            os.environ.setdefault(key, val)
    print("  Loaded .env file")


def get_config():
    """Return Supabase URL and service role key."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url:
        print("  NEXT_PUBLIC_SUPABASE_URL is not set.")
        sys.exit(1)
    if not key:
        print("  SUPABASE_SERVICE_ROLE_KEY is not set.")
        print("   Add it to your .env file or system environment.")
        sys.exit(1)
    return url, key


# ═══════════════════════════════════════════════════════════════════
#  HTTP HELPERS
# ═══════════════════════════════════════════════════════════════════

def _http_request(method, url, headers=None, data=None, timeout=30):
    """Unified HTTP request dispatch (works with or without requests library)."""
    if HAS_REQUESTS:
        resp = _requests.request(
            method, url, headers=headers, data=data, timeout=timeout
        )
        return resp.status_code, resp.text
    else:
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
                return r.status, body
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            return e.code, body


# ═══════════════════════════════════════════════════════════════════
#  SUPABASE AUTH ADMIN — Create all demo users
# ═══════════════════════════════════════════════════════════════════

def auth_admin_headers(service_key):
    """Return headers for Supabase Auth admin API calls."""
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def create_auth_user(auth_url, headers, email, password):
    """Create a single Supabase Auth user. Returns (user_id, is_new)."""
    payload = json.dumps({
        "email": email,
        "password": password,
        "email_confirm": True,
    }).encode("utf-8")

    code, body = _http_request("POST", auth_url, headers, payload)

    if code in (200, 201):
        user_data = json.loads(body)
        return user_data["id"], True

    # If conflict, look up existing user
    if code == 409:
        get_url = "{}?email={}".format(auth_url, email)
        code2, body2 = _http_request("GET", get_url, headers, timeout=10)
        if code2 == 200:
            users = json.loads(body2)
            if isinstance(users, list) and len(users) > 0:
                return users[0]["id"], False

    print("  WARNING: Could not create/find user {} (HTTP {})".format(email, code))
    return None, False


def create_all_demo_users(supabase_url, service_key, demo_users_def):
    """
    Create all demo users in Supabase Auth.
    Returns a dict mapping placeholder IDs to real Auth UUIDs.
    """
    auth_url = "{}/auth/v1/admin/users".format(supabase_url)
    headers = auth_admin_headers(service_key)

    print("\n  Creating demo auth users...")
    id_map = {}

    for u in demo_users_def:
        email = u["email"]
        pid = u["id"]
        password = u.get("password", DEMO_PASSWORD)
        print("    {:14s} <{:30s}>".format(pid, email), end=" ")

        real_id, created = create_auth_user(auth_url, headers, email, password)
        if real_id:
            id_map[pid] = real_id
            print("OK ({} {})".format("created" if created else "exists", real_id[:8]))
        else:
            print("FAILED -- using placeholder ID")
            id_map[pid] = pid  # fallback to placeholder

    return id_map


# ═══════════════════════════════════════════════════════════════════
#  SUPABASE REST CLIENT
# ═══════════════════════════════════════════════════════════════════

class SupabaseClient:
    """Minimal Supabase REST client using service_role key."""

    def __init__(self, base_url, service_key):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }

    def _url(self, table):
        return f"{self.base_url}/rest/v1/{table}"

    def upsert_all(self, table, records):
        """Insert/upsert records. Returns (count, errors)."""
        if not records:
            return 0, []
        url = self._url(table)
        errors = []
        batch_size = 50
        total = 0
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            ok, errs = self._send_batch(url, batch)
            total += ok
            errors.extend(errs)
        return total, errors

    def _send_batch(self, url, batch):
        """Send one batch and handle response."""
        payload = json.dumps(batch).encode("utf-8")
        errors = []

        try:
            code, body = _http_request("POST", url, self.headers, payload)
            if code in (200, 201):
                return len(batch), []
            if code == 409:
                return self._send_batch_fallback(url, batch)
            msg = body[:200] if body else f"HTTP {code}"
            errors.append(msg)
            return 0, errors
        except Exception as e:
            errors.append(str(e))
            return 0, errors

    def _send_batch_fallback(self, url, batch):
        """Fallback: insert records one by one."""
        ok = 0
        errors = []
        for record in batch:
            payload = json.dumps(record).encode("utf-8")
            try:
                code, body = _http_request("POST", url, self.headers, payload)
                if code in (200, 201):
                    ok += 1
                elif code == 409:
                    ok += 1  # already exists
                else:
                    errors.append(body[:150])
            except Exception as e:
                errors.append(str(e))
        return ok, errors

    def delete_all(self, table):
        """Delete all rows from a table."""
        url = self._url(table)
        headers = {**self.headers, "Prefer": "count=exact"}
        try:
            code, body = _http_request("DELETE", url, headers)
            if code in (200, 204):
                return True, ""
            return False, body[:200]
        except Exception as e:
            return False, str(e)


# ═══════════════════════════════════════════════════════════════════
#  DATA TRANSFORMERS
# ═══════════════════════════════════════════════════════════════════

def transform_record(table, record):
    """Transform keys to snake_case for Supabase columns."""
    result = {}
    key_map = {
        "fullName": "full_name", "companyName": "company_name",
        "jobTitle": "job_title", "companyId": "company_id",
        "leadIds": "lead_ids", "socialLinks": "social_links",
        "assignedTo": "assigned_to", "estimatedValue": "estimated_value",
        "relatedToType": "related_to_type", "relatedToId": "related_to_id",
        "dueDate": "due_date", "dateTime": "date_time",
        "createdBy": "created_by", "createdAt": "created_at",
        "updatedAt": "updated_at", "dealId": "deal_id",
        "leadId": "lead_id", "contactId": "contact_id",
        "companyId": "company_id", "stageId": "stage_id",
        "closeDate": "close_date", "winLossReason": "win_loss_reason",
        "validUntil": "valid_until", "unitPrice": "unit_price",
        "sortOrder": "sort_order", "quoteId": "quote_id",
        "sequenceId": "sequence_id", "delayDays": "delay_days",
        "startDate": "start_date", "endDate": "end_date",
        "triggerEvent": "trigger_event", "fromAddress": "from_address",
        "toAddress": "to_address", "sentAt": "sent_at",
        "callResult": "call_result", "fromNumber": "from_number",
        "toNumber": "to_number", "keyPrefix": "key_prefix",
        "keyHash": "key_hash", "lastUsedAt": "last_used_at",
        "expiresAt": "expires_at", "entityType": "entity_type",
        "entityId": "entity_id", "tagId": "tag_id",
        "taggableId": "taggable_id", "taggableType": "taggable_type",
        "portalUserId": "portal_user_id", "passwordHash": "password_hash",
        "lastLogin": "last_login", "uploadedBy": "uploaded_by",
        "mimeType": "mime_type", "sizeBytes": "size_bytes",
        "storagePath": "storage_path", "originalName": "original_name",
        "invitedBy": "invited_by", "portalUserEmail": "portal_user_email",
        "fromStateNum": "from_state_num", "toStateNum": "to_state_num",
        "teamId": "team_id", "userId": "user_id",
        "joinedAt": "joined_at", "inviteCode": "invite_code",
    }

    for k, v in record.items():
        new_key = key_map.get(k, k)
        if "_" not in new_key and new_key != k:
            new_key = re.sub(r"([a-z])([A-Z])", r"\1_\2", new_key).lower()
        result[new_key] = v

    return result


def resolve_workflow_transitions(transitions, states):
    """Convert from_state_num/to_state_num to actual UUIDs using workflow_states."""
    sorted_states = sorted(states, key=lambda s: s.get("sort_order", 0))
    results = []
    for t in transitions:
        from_idx = t.get("from_state_num", 0)
        to_idx = t.get("to_state_num", 0)
        if from_idx < len(sorted_states) and to_idx < len(sorted_states):
            results.append({
                "from_state_id": sorted_states[from_idx].get("id"),
                "to_state_id": sorted_states[to_idx].get("id"),
                "label": t.get("label", ""),
            })
        else:
            print(f"   WARNING: Cannot resolve workflow transition: indices {from_idx} -> {to_idx}")
    return results


def resolve_portal_shares(shares, portal_users):
    """Resolve portal_user_email to portal_user_id."""
    email_to_id = {u["email"]: u["id"] for u in portal_users if "id" in u and "email" in u}
    results = []
    for s in shares:
        email = s.get("portal_user_email", "")
        uid = email_to_id.get(email)
        if uid:
            results.append({
                "portal_user_id": uid,
                "related_to_type": s["related_to_type"],
                "related_to_id": s["related_to_id"],
                "permission": s.get("permission", "view"),
            })
        else:
            print(f"   WARNING: Portal user not found: {email}")
    return results


def replace_user_id(obj, placeholder, real_id):
    """
    Recursively walk a data structure and replace all occurrences
    of `placeholder` with `real_id`. Works on strings, lists, dicts.
    """
    if isinstance(obj, str):
        return real_id if obj == placeholder else obj
    elif isinstance(obj, list):
        return [replace_user_id(item, placeholder, real_id) for item in obj]
    elif isinstance(obj, dict):
        return {k: replace_user_id(v, placeholder, real_id) for k, v in obj.items()}
    return obj


# ═══════════════════════════════════════════════════════════════════
#  MAIN SEEDER
# ═══════════════════════════════════════════════════════════════════

def seed():
    """Main seeding routine."""
    load_env()
    supabase_url, service_key = get_config()
    client = SupabaseClient(supabase_url, service_key)

    # Parse CLI args
    args = set(sys.argv[1:])
    clear_mode = "--clear" in args or "--clean" in args
    single_table = None
    for a in args:
        if a.startswith("--table="):
            single_table = a.split("=", 1)[1]

    tables_to_seed = [single_table] if single_table else TABLE_ORDER

    # ── Step 1: Load data ───────────────────────────────────
    if not DATA_FILE.exists():
        print("  Data file not found: {}".format(DATA_FILE))
        sys.exit(1)

    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    total_records = sum(len(v) for v in data.values() if isinstance(v, list))

    print("\n{}".format("="*60))
    print("  NexusCRM Demo Data Seeder")
    print("  Target: {}".format(supabase_url))
    print("  Records: {}".format(total_records))
    print("{}\n".format("="*60))

    # ── Step 2: Create all demo users in Auth ──────────────
    print("  Step 1/4: Creating demo auth users...")
    demo_users_def = data.get("users", [])
    if not demo_users_def:
        print("  No demo users defined in data.json -- aborting")
        sys.exit(1)

    id_map = create_all_demo_users(supabase_url, service_key, demo_users_def)

    # Replace all placeholder IDs with real Auth UUIDs
    for placeholder, real_id in id_map.items():
        if real_id != placeholder:
            data = replace_user_id(data, placeholder, real_id)
            print("  Mapped '{}' -> {}".format(placeholder, real_id[:8]))

    # Tables to skip (not DB tables)
    skip_keys = {"version", "generated_at", "description", "users"}

    # Pre-process for cross-reference resolution
    workflow_states_raw = data.get("workflow_states", [])
    portal_users_raw = data.get("portal_users", [])

    # ── Step 3: Delete existing data (if --clear) ──────────
    if clear_mode:
        print("\n  Step 2/4: Clearing existing data...\n")
        for table in reversed(TABLE_ORDER):
            if single_table and table != single_table:
                continue
            print("    Deleting from {}...".format(table), end=" ")
            ok, err = client.delete_all(table)
            if ok:
                print("OK")
            else:
                print("({})".format(err[:60]))
        print()
    else:
        print("\n  Step 2/4: Skipping clear (use --clear to reset data)")

    # ── Step 4: Seed all tables ────────────────────────────
    print("\n  Step 3/4: Seeding data into Supabase...\n")

    total_inserted = 0
    total_errors = 0

    for table in tables_to_seed:
        if table in skip_keys:
            continue

        records_raw = data.get(table, [])
        if not records_raw:
            print("    {}: 0 records (skipping)".format(table))
            continue

        # Transform key names
        records = [transform_record(table, r) for r in records_raw]

        # Resolve cross-references
        if table == "workflow_transitions":
            records = resolve_workflow_transitions(records, workflow_states_raw)
        elif table == "portal_shares":
            records = resolve_portal_shares(records, portal_users_raw)

        if not records:
            print("    {}: 0 records after resolution (skipping)".format(table))
            continue

        print("    {}: {} records...".format(table, len(records)), end=" ")
        sys.stdout.flush()

        count, errors = client.upsert_all(table, records)
        total_inserted += count
        total_errors += len(errors)

        if errors:
            print("inserted {}, {} errors".format(count, len(errors)))
            for e in errors[:2]:
                print("       -> {}".format(e[:100]))
        else:
            print("OK ({})".format(count))

        time.sleep(0.1)

    # ── Summary ─────────────────────────────────────────────
    print("\n{}".format("="*60))
    print("  Seeding Complete!")
    print("  Total records inserted: {}".format(total_inserted))
    if total_errors:
        print("  Total errors:          {}".format(total_errors))
    print("")
    print("  Demo Accounts (all password: {})".format(DEMO_PASSWORD))
    for u in demo_users_def:
        print("    {:14s} <{:30s}>  ({})".format(u["id"], u["email"], u["role"]))
    print("{}".format("="*60))
    print()


def check_connection():
    """Quick connectivity test."""
    load_env()
    url, key = get_config()
    print(f"\n  Testing connection to {url}...")
    if HAS_REQUESTS:
        try:
            resp = _requests.get(
                f"{url}/rest/v1/",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                print("  Connection successful!")
            else:
                print(f"  Unexpected response: HTTP {resp.status_code}")
                print(f"  {resp.text[:200]}")
        except Exception as e:
            print(f"  Connection failed: {e}")
    else:
        print("  Install 'requests' for better connection checking: pip install requests")
        print(f"  URL: {url}")


# ═══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if "--check" in sys.argv:
        check_connection()
    elif "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
    else:
        seed()
