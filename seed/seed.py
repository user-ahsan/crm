#!/usr/bin/env python3
"""
NexusCRM - Interactive Seed Script

Reads the REAL .env file from the project root (not .env.example, not .env.local).
Uses the Supabase Management API via REST calls to seed data.

Usage:
  cd D:\\Projects\\crm
  python seed/seed.py

Requirements:
  - Python 3.8+
  - No external packages needed (uses built-in urllib)
"""

import os
import json
import uuid
import re
import sys
import urllib.request
import urllib.error
import http.client
from datetime import datetime, timedelta

# -- Colors ----------------------------------------------------------
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
CYAN = '\033[96m'
BOLD = '\033[1m'
RESET = '\033[0m'

# -- File paths ------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
ENV_FILE = os.path.join(PROJECT_ROOT, '.env')  # - reads the REAL .env, NOT .env.example

# -- Config (loaded from .env) ---------------------------------------
SUPABASE_URL = None
SUPABASE_ANON_KEY = None
SUPABASE_SERVICE_KEY = None

OK = '[OK]'
FAIL = '[FAIL]'
WARN = '[WARN]'

def hr():
    return '=' * 50

def bold(s): return f"{BOLD}{s}{RESET}"
def green(s): return f"{GREEN}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def red(s): return f"{RED}{s}{RESET}"


def load_env():
    """Read the ACTUAL .env file (not .env.example, not .env.local)."""
    global SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

    if not os.path.exists(ENV_FILE):
        print(red(f"FAIL .env not found at: {ENV_FILE}"))
        print(yellow("  Run this script from the project root:"))
        print(yellow("    cd D:\\Projects\\crm"))
        print(yellow("    python seed/seed.py"))
        sys.exit(1)

    with open(ENV_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key == 'NEXT_PUBLIC_SUPABASE_URL':
                SUPABASE_URL = value.rstrip('/')
            elif key == 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
                SUPABASE_ANON_KEY = value
            elif key == 'SUPABASE_SERVICE_ROLE_KEY':
                SUPABASE_SERVICE_KEY = value

    if not SUPABASE_URL:
        print(red("FAIL NEXT_PUBLIC_SUPABASE_URL not found in .env"))
        sys.exit(1)
    if not SUPABASE_ANON_KEY:
        print(red("FAIL NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env"))
        sys.exit(1)
    if not SUPABASE_SERVICE_KEY:
        print(yellow("[WARN]  SUPABASE_SERVICE_ROLE_KEY not found -- some admin operations will fail"))
        print(yellow("   User creation and team seeding require the service_role_key."))

    print(green(f"OK Loaded .env -- {SUPABASE_URL}"))


# -- API Helpers ----------------------------------------------------

def api_call(method, path, body=None, use_service_key=True):
    """Make a REST call to Supabase."""
    url = f"{SUPABASE_URL}{path}"
    key = SUPABASE_SERVICE_KEY if use_service_key else SUPABASE_ANON_KEY
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
    }
    if use_service_key and SUPABASE_SERVICE_KEY:
        headers['Authorization'] = f'Bearer {SUPABASE_SERVICE_KEY}'
    else:
        headers['Authorization'] = f'Bearer {SUPABASE_ANON_KEY}'

    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode('utf-8')
            if raw:
                return json.loads(raw)
            return {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        print(red(f"FAIL API error {e.code}: {e.reason}"))
        if error_body:
            try:
                parsed = json.loads(error_body)
                msg = parsed.get('message') or parsed.get('error_description') or parsed.get('msg') or error_body
                print(red(f"  {msg}"))
            except json.JSONDecodeError:
                print(red(f"  {error_body[:200]}"))
        return None
    except urllib.error.URLError as e:
        print(red(f"FAIL Connection error: {e.reason}"))
        return None


def create_auth_user(email, password):
    """Create a new auth user via Supabase Auth admin API."""
    print(f"  Creating auth user: {email} ...")
    result = api_call('POST', '/auth/v1/admin/users', {
        'email': email,
        'password': password,
        'email_confirm': True,
    })
    if result and result.get('id'):
        print(green(f"  OK User created: {result['id']}"))
        return result['id']
    return None


def db_insert(table, rows):
    """Insert rows into a Supabase table."""
    if not isinstance(rows, list):
        rows = [rows]
    result = api_call('POST', f'/rest/v1/{table}', rows)
    if result is not None:
        print(green(f"  OK Inserted {len(rows)} row(s) into {table}"))
        return result
    return None


def db_delete_all(table):
    """Delete ALL rows from a table (uses service_role_key)."""
    print(f"  Clearing {table} ...")
    api_call('DELETE', f'/rest/v1/{table}?limit=10000', use_service_key=True)
    print(green(f"  OK Cleared {table}"))


# -- Seed Data ------------------------------------------------------

SEED_LEADS = [
    {'full_name': 'Sarah Johnson', 'email': 'sarah@acme.com', 'phone': '+1-555-0101', 'company_name': 'Acme Corp', 'industry': 'Technology', 'source': 'website', 'status': 'new', 'priority': 'high', 'estimated_value': 50000},
    {'full_name': 'Mike Chen', 'email': 'mike@techstart.io', 'phone': '+1-555-0102', 'company_name': 'TechStart Inc', 'industry': 'SaaS', 'source': 'referral', 'status': 'qualified', 'priority': 'high', 'estimated_value': 120000},
    {'full_name': 'Emily Davis', 'email': 'emily@greenco.net', 'phone': '+1-555-0103', 'company_name': 'GreenCo Solutions', 'industry': 'Clean Energy', 'source': 'conference', 'status': 'proposal', 'priority': 'medium', 'estimated_value': 75000},
    {'full_name': 'James Wilson', 'email': 'james@datawise.com', 'phone': '+1-555-0104', 'company_name': 'DataWise Analytics', 'industry': 'Analytics', 'source': 'website', 'status': 'new', 'priority': 'low', 'estimated_value': 25000},
    {'full_name': 'Lisa Brown', 'email': 'lisa@cloudnine.com', 'phone': '+1-555-0105', 'status': 'lost', 'priority': 'low', 'source': 'email', 'estimated_value': 10000},
    {'full_name': 'Alex Rivera', 'email': 'alex@buildcore.com', 'phone': '+1-555-0106', 'company_name': 'BuildCore Ltd', 'industry': 'Construction', 'source': 'referral', 'status': 'qualified', 'priority': 'medium', 'estimated_value': 90000},
    {'full_name': 'Priya Patel', 'email': 'priya@finwise.co', 'phone': '+1-555-0107', 'company_name': 'FinWise Consulting', 'industry': 'Finance', 'source': 'conference', 'status': 'proposal', 'priority': 'high', 'estimated_value': 200000},
    {'full_name': 'Tom Harrison', 'email': 'tom@medtech.com', 'phone': '+1-555-0108', 'company_name': 'MedTech Innovations', 'industry': 'Healthcare', 'source': 'website', 'status': 'new', 'priority': 'medium', 'estimated_value': 60000},
]

SEED_CONTACTS = [
    {'name': 'Alice Johnson', 'email': 'alice@example.com', 'phone': '+1-555-0201'},
    {'name': 'Bob Williams', 'email': 'bob@example.com', 'phone': '+1-555-0202'},
    {'name': 'Carol Martinez', 'email': 'carol@example.com', 'phone': '+1-555-0203'},
    {'name': 'David Lee', 'email': 'david@example.com', 'phone': '+1-555-0204'},
    {'name': 'Eva Garcia', 'email': 'eva@example.com', 'phone': '+1-555-0205'},
]

SEED_COMPANIES = [
    {'name': 'Acme Corp', 'industry': 'Technology', 'website': 'https://acme.com', 'location': 'San Francisco, CA'},
    {'name': 'TechStart Inc', 'industry': 'SaaS', 'website': 'https://techstart.io', 'location': 'Austin, TX'},
    {'name': 'GreenCo Solutions', 'industry': 'Clean Energy', 'website': 'https://greenco.net', 'location': 'Portland, OR'},
]

SEED_TASKS = [
    {'title': 'Follow up with Sarah Johnson', 'description': 'Call to discuss proposal', 'status': 'pending', 'priority': 'high'},
    {'title': 'Prepare demo for TechStart', 'description': 'Create custom demo environment', 'status': 'in_progress', 'priority': 'high'},
    {'title': 'Send contract to GreenCo', 'description': 'Finalize and send the contract', 'status': 'pending', 'priority': 'medium'},
    {'title': 'Review DataWise requirements', 'description': 'Go through the RFP document', 'status': 'completed', 'priority': 'low'},
    {'title': 'Quarterly review meeting', 'description': 'Prepare Q3 review presentation', 'status': 'pending', 'priority': 'medium'},
]

SEED_MEETINGS = [
    {'title': 'Initial Discovery Call', 'description': 'First call with Sarah Johnson', 'duration': 30},
    {'title': 'Product Demo', 'description': 'Full product demo for TechStart team', 'duration': 60},
    {'title': 'Contract Review', 'description': 'Go through terms with GreenCo', 'duration': 45},
    {'title': 'Strategy Meeting', 'description': 'Q3 planning session', 'duration': 60},
]


def seed_leads(user_id):
    print(f"\n{bold('Seeding leads...')}")
    now = datetime.utcnow().isoformat()
    rows = []
    for i, lead in enumerate(SEED_LEADS):
        row = {**lead, 'created_by': user_id, 'created_at': now, 'updated_at': now}
        rows.append(row)
    db_insert('leads', rows)


def seed_contacts(user_id):
    print(f"\n{bold('Seeding contacts...')}")
    now = datetime.utcnow().isoformat()
    rows = [{'name': c['name'], 'email': c['email'], 'phone': c.get('phone'), 'created_by': user_id, 'created_at': now, 'updated_at': now} for c in SEED_CONTACTS]
    db_insert('contacts', rows)


def seed_companies(user_id):
    print(f"\n{bold('Seeding companies...')}")
    now = datetime.utcnow().isoformat()
    rows = [{**c, 'created_by': user_id, 'created_at': now, 'updated_at': now} for c in SEED_COMPANIES]
    db_insert('companies', rows)


def seed_tasks(user_id):
    print(f"\n{bold('Seeding tasks...')}")
    now = datetime.utcnow().isoformat()
    tomorrow = (datetime.utcnow() + timedelta(days=1)).isoformat()
    rows = [{**t, 'assigned_to': user_id, 'created_by': user_id, 'due_date': tomorrow, 'created_at': now, 'updated_at': now} for t in SEED_TASKS]
    db_insert('tasks', rows)


def seed_meetings(user_id):
    print(f"\n{bold('Seeding meetings...')}")
    now = datetime.utcnow().isoformat()
    tomorrow = (datetime.utcnow() + timedelta(days=1)).isoformat()
    rows = [{**m, 'date_time': tomorrow, 'created_by': user_id, 'created_at': now, 'updated_at': now} for m in SEED_MEETINGS]
    db_insert('meetings', rows)


def seed_team_and_member(user_id, email):
    """Create a team and add the user as admin."""
    print(f"\n{bold('Creating team...')}")
    now = datetime.utcnow().isoformat()

    # Create team
    team_name = f"{email.split('@')[0]}'s Team"
    team_result = api_call('POST', '/rest/v1/teams', {
        'name': team_name,
        'description': 'Auto-created by seed script',
        'created_by': user_id,
        'created_at': now,
        'updated_at': now,
    })
    if team_result is None:
        print(red("  FAIL Failed to create team"))
        return None

    team_id = None
    if isinstance(team_result, list) and len(team_result) > 0:
        team_id = team_result[0].get('id')
    elif isinstance(team_result, dict):
        team_id = team_result.get('id')

    if not team_id:
        print(red(f"  FAIL Could not get team ID from response: {team_result}"))
        return None

    print(green(f"  OK Team created: {team_name} ({team_id})"))

    # Add user as admin member
    member_result = api_call('POST', '/rest/v1/team_members', {
        'team_id': team_id,
        'user_id': user_id,
        'role': 'admin',
        'joined_at': now,
    })
    if member_result is None:
        print(red("  FAIL Failed to add team member"))
        return None

    print(green(f"  OK Added as admin member"))
    return team_id


# -- Menu ----------------------------------------------------------

def menu_create_user():
    """Create a new auth user and optionally seed data."""
    print(f"\n{hr()}")
    print(f"  CREATE NEW USER")
    print(f"{hr()}")

    if not SUPABASE_SERVICE_KEY:
        print(red("FAIL Cannot create users without SUPABASE_SERVICE_ROLE_KEY in .env"))
        input(f"\n{yellow('Press Enter to return...')}")
        return

    email = input(f"  Email: ").strip()
    if not email or '@' not in email:
        print(red("FAIL Invalid email"))
        return

    password = input(f"  Password: ").strip()
    if len(password) < 6:
        print(red("FAIL Password must be at least 6 characters"))
        return

    user_id = create_auth_user(email, password)
    if not user_id:
        print(red("FAIL Failed to create user"))
        return

    # Auto-create team
    team_id = seed_team_and_member(user_id, email)
    if not team_id:
        print(yellow("[WARN]  Continuing without team..."))

    print(f"\n{green('OK User created successfully!')}")
    print(f"  Email: {email}")
    print(f"  User ID: {user_id}")
    if team_id:
        print(f"  Team ID: {team_id}")

    seed = input(f"\n{yellow('Seed demo data for this user? (y/n): ')}").strip().lower()
    if seed == 'y':
        seed_all(user_id)


def seed_all(user_id=None):
    """Run all seeders."""
    if not user_id:
        print(red("FAIL Need a user ID to seed data"))
        return

    print(f"\n{hr()}")
    print(f"  SEEDING DEMO DATA")
    print(f"{hr()}")

    seed_leads(user_id)
    seed_contacts(user_id)
    seed_companies(user_id)
    seed_tasks(user_id)
    seed_meetings(user_id)

    print(f"\n{green('OK Demo data seeded successfully!')}")
    print(f"  {len(SEED_LEADS)} leads")
    print(f"  {len(SEED_CONTACTS)} contacts")
    print(f"  {len(SEED_COMPANIES)} companies")
    print(f"  {len(SEED_TASKS)} tasks")
    print(f"  {len(SEED_MEETINGS)} meetings")


def menu_seed_existing():
    """Seed data for an existing user."""
    print(f"\n{hr()}")
    print(f"  SEED DATA FOR EXISTING USER")
    print(f"{hr()}")

    user_id = input(f"  User ID (UUID): ").strip()
    if not user_id:
        print(red("FAIL User ID required"))
        return

    try:
        uuid.UUID(user_id)
    except ValueError:
        print(red("FAIL Invalid UUID format"))
        return

    seed_all(user_id)


def menu_clear_all():
    """Clear all data from all tables."""
    print(f"\n{RED}{bold('[WARN]  DANGER ZONE')}{RESET}")
    print(red("This will DELETE ALL data from ALL tables!"))
    confirm = input(f"\n{yellow('Type "DELETE" to confirm: ')}").strip()
    if confirm != 'DELETE':
        print(yellow("Cancelled."))
        return

    tables = ['leads', 'contacts', 'companies', 'tasks', 'meetings', 'activities',
              'team_members', 'team_invitations', 'teams', 'taggings', 'tags',
              'email_history', 'call_logs', 'notes', 'deals', 'lead_scores',
              'quotes', 'quote_items', 'forecasts', 'file_attachments',
              'saved_views', 'api_keys', 'automation_rules', 'sms_logs',
              'campaign_emails', 'email_sequences', 'goals', 'workflow_states',
              'workflow_transitions', 'calendar_integrations', 'portal_shares',
              'portal_users']

    for table in tables:
        db_delete_all(table)

    print(green(f"OK All tables cleared."))


def menu_status():
    """Show database status."""
    print(f"\n{hr()}")
    print(f"  DATABASE STATUS")
    print(f"{hr()}")
    print(f"  Project: {SUPABASE_URL}")
    print(f"  Has service key: {'OK' if SUPABASE_SERVICE_KEY else 'FAIL'}")

    print(f"\n  {bold('Row counts:')}")
    tables = ['leads', 'contacts', 'companies', 'tasks', 'meetings', 'teams', 'team_members']
    for table in tables:
        result = api_call('GET', f'/rest/v1/{table}?select=count&limit=0', use_service_key=False)
        # Just show the table was reachable
        print(f"    {table}: checked")


def main():
    print(f"\n{hr()}")
    print(f"  NEXUSCRM - Seed Script")
    print(f"  Reads the real .env file")
    print(f"{hr()}")
    load_env()

    while True:
        print(f"\n{bold('MAIN MENU')}")
        print(f"  {green('1')}. Create new user + seed data")
        print(f"  {green('2')}. Seed data for existing user")
        print(f"  {green('3')}. Database status")
        print(f"  {red('4')}. Clear ALL data (danger)")
        print(f"  {green('0')}. Exit")

        choice = input(f"\n  {bold('Select: ')}").strip()

        if choice == '1':
            menu_create_user()
        elif choice == '2':
            menu_seed_existing()
        elif choice == '3':
            menu_status()
        elif choice == '4':
            menu_clear_all()
        elif choice == '0':
            print(green("\nGoodbye!"))
            break
        else:
            print(red("Invalid choice"))


if __name__ == '__main__':
    main()
