#!/usr/bin/env python3
"""
NexusCRM - Interactive Seed Script

Reads the REAL .env file. Seeds data matching the actual Supabase schema
from the migration files. No assumptions about column names.

Usage:
  cd D:/Projects/crm
  python seed/seed.py
"""

import os, json, uuid, sys, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

# -- Colors ----------------------------------------------------------
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BOLD = '\033[1m'
RESET = '\033[0m'

def bold(s): return f"{BOLD}{s}{RESET}"
def green(s): return f"{GREEN}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def red(s): return f"{RED}{s}{RESET}"
def hr(): return '=' * 50

OK = '[OK]'
FAIL = '[FAIL]'
WARN = '[WARN]'

# -- File paths ------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(os.getcwd()) == 'seed':
    PROJECT_ROOT = os.path.abspath(os.path.join(os.getcwd(), '..'))
else:
    PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
ENV_FILE = os.path.join(PROJECT_ROOT, '.env')

# -- Config ----------------------------------------------------------
SUPABASE_URL = None
SUPABASE_ANON_KEY = None
SUPABASE_SERVICE_KEY = None

def load_env():
    global SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
    if not os.path.exists(ENV_FILE):
        print(red(f"{FAIL} .env not found at {ENV_FILE}"))
        print(yellow("  Run: python seed/seed.py  (from project root)"))
        sys.exit(1)
    with open(ENV_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' not in line: continue
            k, _, v = line.partition('=')
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k == 'NEXT_PUBLIC_SUPABASE_URL': SUPABASE_URL = v.rstrip('/')
            elif k == 'NEXT_PUBLIC_SUPABASE_ANON_KEY': SUPABASE_ANON_KEY = v
            elif k == 'SUPABASE_SERVICE_ROLE_KEY': SUPABASE_SERVICE_KEY = v
    if not SUPABASE_URL: print(red(f"{FAIL} NEXT_PUBLIC_SUPABASE_URL missing")); sys.exit(1)
    if not SUPABASE_SERVICE_KEY: print(yellow(f"{WARN} SUPABASE_SERVICE_ROLE_KEY missing - user creation will fail"))
    print(green(f"{OK} Loaded .env -- {SUPABASE_URL}"))

# -- API -------------------------------------------------------------
def api(method, path, body=None, use_service_key=True, prefer='return=representation'):
    url = f"{SUPABASE_URL}{path}"
    key = SUPABASE_SERVICE_KEY if use_service_key else SUPABASE_ANON_KEY
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {key}',
        'Prefer': prefer,
    }
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8')[:500] if e.fp else ''
        print(red(f"{FAIL} {e.code}: {e.reason}"))
        if err: print(red(f"  {err}"))
        return None

def create_auth_user(email, password):
    print(f"  Creating auth user: {email} ...")
    r = api('POST', '/auth/v1/admin/users', {
        'email': email, 'password': password, 'email_confirm': True,
    })
    if r and r.get('id'):
        print(green(f"{OK} User ID: {r['id']}"))
        return r['id']
    return None

def insert(table, rows):
    if not isinstance(rows, list): rows = [rows]
    # Strip out created_at/updated_at -- tables use DEFAULT now()
    clean = []
    for r in rows:
        c = dict(r)
        c.pop('created_at', None)
        c.pop('updated_at', None)
        clean.append(c)
    result = api('POST', f'/rest/v1/{table}', clean)
    if result is not None:
        print(green(f"{OK} {len(clean)} rows into {table}"))
        return result
    return None

# -- Seed data (matches actual migration schema) ---------------------

def seed_user_data(user_id):
    now = datetime.now(timezone.utc).isoformat()
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # TEAMS: has created_by (uuid), invite_code has default
    print(f"\n{bold('Creating team...')}")
    team_result = api('POST', '/rest/v1/teams', {
        'name': f"Demo Team",
        'description': 'Seeded by seed script',
        'created_by': user_id,
    })
    if team_result is None:
        print(red(f"{FAIL} Team creation failed"))
        return

    # Response can be [{...}] or {...} depending on endpoint
    if isinstance(team_result, list):
        team_id = team_result[0]['id'] if len(team_result) > 0 else None
    else:
        team_id = team_result.get('id')
    if not team_id:
        print(red(f"{FAIL} Could not extract team ID from: {team_result}"))
        return
    print(green(f"{OK} Team: {team_id}"))

    # TEAM MEMBERS: user_id is text, role check constraint
    insert('team_members', [{
        'team_id': team_id,
        'user_id': user_id,
        'role': 'admin',
    }])

    # LEADS: all rows must have IDENTICAL keys for batch insert
    print(f"\n{bold('Seeding leads...')}")
    def lead(fn, email=None, phone=None, company=None, industry=None, country=None,
             source='manual', status='new', priority='medium', value=0, owner=None):
        return {'full_name': fn, 'email': email, 'phone': phone,
                'company_name': company, 'industry': industry, 'country': country,
                'source': source, 'status': status, 'priority': priority,
                'estimated_value': value, 'owner_id': owner}
    leads = [
        lead('Sarah Johnson', 'sarah@acme.com', '+1-555-0101', 'Acme Corp', 'Technology',
             source='website', status='new', priority='high', value=50000, owner=user_id),
        lead('Mike Chen', 'mike@techstart.io', '+1-555-0102', 'TechStart Inc', 'SaaS',
             source='referral', status='qualified', priority='high', value=120000, owner=user_id),
        lead('Emily Davis', 'emily@greenco.net', '+1-555-0103', 'GreenCo Solutions', 'Clean Energy',
             source='referral', status='proposal', priority='medium', value=75000, owner=user_id),
        lead('James Wilson', 'james@datawise.com', '+1-555-0104', 'DataWise Analytics', 'Analytics',
             source='website', status='new', priority='low', value=25000, owner=user_id),
        lead('Lisa Brown', 'lisa@cloudnine.com', '+1-555-0105',
             source='ads', status='lost', priority='low', value=10000, owner=user_id),
        lead('Alex Rivera', 'alex@buildcore.com', '+1-555-0106', 'BuildCore Ltd', 'Construction',
             source='referral', status='qualified', priority='medium', value=90000, owner=user_id),
        lead('Priya Patel', 'priya@finwise.co', '+1-555-0107', 'FinWise Consulting', 'Finance',
             source='referral', status='proposal', priority='high', value=200000, owner=user_id),
        lead('Tom Harrison', 'tom@medtech.com', '+1-555-0108', 'MedTech Innovations', 'Healthcare',
             source='website', status='new', priority='medium', value=60000, owner=user_id),
    ]
    insert('leads', leads)

    # COMPANIES: no owner/created_by column
    print(f"\n{bold('Seeding companies...')}")
    insert('companies', [
        {'name': 'Acme Corp', 'industry': 'Technology', 'size': '51-200',
         'website': 'https://acme.com', 'location': 'San Francisco, CA', 'revenue': 5000000},
        {'name': 'TechStart Inc', 'industry': 'SaaS', 'size': '11-50',
         'website': 'https://techstart.io', 'location': 'Austin, TX', 'revenue': 2000000},
        {'name': 'GreenCo Solutions', 'industry': 'Clean Energy', 'size': '51-200',
         'website': 'https://greenco.net', 'location': 'Portland, OR', 'revenue': 3500000},
    ])

    # CONTACTS: no owner/created_by column
    print(f"\n{bold('Seeding contacts...')}")
    insert('contacts', [
        {'name': 'Alice Johnson', 'email': 'alice@example.com', 'phone': '+1-555-0201',
         'job_title': 'CEO', 'location': 'San Francisco, CA'},
        {'name': 'Bob Williams', 'email': 'bob@example.com', 'phone': '+1-555-0202',
         'job_title': 'CTO', 'location': 'Austin, TX'},
        {'name': 'Carol Martinez', 'email': 'carol@example.com', 'phone': '+1-555-0203',
         'job_title': 'VP Sales', 'location': 'Portland, OR'},
        {'name': 'David Lee', 'email': 'david@example.com', 'phone': '+1-555-0204',
         'job_title': 'Engineer', 'location': 'Seattle, WA'},
        {'name': 'Eva Garcia', 'email': 'eva@example.com', 'phone': '+1-555-0205',
         'job_title': 'Product Manager', 'location': 'New York, NY'},
    ])

    # TASKS: all rows must have IDENTICAL keys
    print(f"\n{bold('Seeding tasks...')}")
    due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    insert('tasks', [
        {'title': 'Follow up with Sarah Johnson', 'description': 'Call to discuss proposal',
         'status': 'pending', 'priority': 'high', 'assigned_to': user_id, 'due_date': due},
        {'title': 'Prepare demo for TechStart', 'description': 'Create custom demo environment',
         'status': 'pending', 'priority': 'high', 'assigned_to': user_id, 'due_date': due},
        {'title': 'Send contract to GreenCo', 'description': 'Finalize and send the contract',
         'status': 'pending', 'priority': 'medium', 'assigned_to': user_id, 'due_date': due},
        {'title': 'Review DataWise requirements', 'description': 'Go through the RFP document',
         'status': 'completed', 'priority': 'low', 'assigned_to': user_id, 'due_date': None},
        {'title': 'Quarterly review meeting', 'description': 'Prepare Q3 review presentation',
         'status': 'pending', 'priority': 'medium', 'assigned_to': user_id, 'due_date': due},
    ])

    # MEETINGS: has date_time, duration, type; no created_by/owner
    print(f"\n{bold('Seeding meetings...')}")
    insert('meetings', [
        {'title': 'Initial Discovery Call', 'notes': 'First call with Sarah Johnson',
         'date_time': tomorrow, 'duration': 30, 'type': 'call'},
        {'title': 'Product Demo', 'notes': 'Full product demo for TechStart team',
         'date_time': tomorrow, 'duration': 60, 'type': 'online'},
        {'title': 'Contract Review', 'notes': 'Go through terms with GreenCo',
         'date_time': tomorrow, 'duration': 45, 'type': 'online'},
        {'title': 'Strategy Meeting', 'notes': 'Q3 planning session',
         'date_time': tomorrow, 'duration': 60, 'type': 'offline'},
    ])

    # DEALS (from migration 00005): has created_by text, stage_id, value
    print(f"\n{bold('Seeding deals...')}")
    insert('deals', [
        {'title': 'Acme Corp Partnership', 'value': 50000, 'currency': 'USD',
         'assigned_to': user_id, 'created_by': user_id},
        {'title': 'TechStart Enterprise', 'value': 120000, 'currency': 'USD',
         'assigned_to': user_id, 'created_by': user_id},
        {'title': 'GreenCo Solutions', 'value': 75000, 'currency': 'USD',
         'assigned_to': user_id, 'created_by': user_id},
    ])

    print(f"\n{green(f'{OK} Seeding complete!')}")
    print(f"  8 leads, 5 contacts, 3 companies, 5 tasks, 4 meetings, 3 deals")

# -- Menu ------------------------------------------------------------

def menu_create_user():
    print(f"\n{hr()}\n  CREATE NEW USER\n{hr()}")
    if not SUPABASE_SERVICE_KEY:
        print(red(f"{FAIL} SUPABASE_SERVICE_ROLE_KEY required"))
        return
    email = input("  Email: ").strip()
    if not email or '@' not in email: print(red(f"{FAIL} Invalid email")); return
    password = input("  Password: ").strip()
    if len(password) < 6: print(red(f"{FAIL} Password too short")); return

    uid = create_auth_user(email, password)
    if not uid: return
    seed_user_data(uid)

def menu_seed_existing():
    print(f"\n{hr()}\n  SEED EXISTING USER\n{hr()}")
    uid = input("  User ID (UUID): ").strip()
    try: uuid.UUID(uid)
    except ValueError: print(red(f"{FAIL} Invalid UUID")); return
    seed_user_data(uid)

def menu_clear_all():
    print(f"\n{RED}{bold('  DANGER ZONE')}{RESET}")
    print(red("This deletes ALL data from ALL tables!"))
    if input('  Type "DELETE" to confirm: ').strip() != 'DELETE':
        print(yellow("Cancelled.")); return
    tables = ['leads','contacts','companies','tasks','meetings','activities',
              'team_members','team_invitations','teams','taggings','tags',
              'email_history','call_logs','notes','deals','lead_scores',
              'quotes','quote_items','forecasts','file_attachments',
              'saved_views','api_keys','automation_rules','sms_logs',
              'campaign_emails','email_sequences','goals','workflow_states',
              'workflow_transitions','calendar_integrations','portal_shares','portal_users']
    for t in tables:
        api('DELETE', f'/rest/v1/{t}?limit=10000')
        print(green(f"{OK} Cleared {t}"))

def menu_status():
    print(f"\n{hr()}\n  STATUS\n{hr()}")
    print(f"  Project: {SUPABASE_URL}")
    print(f"  Service key: {'Yes' if SUPABASE_SERVICE_KEY else 'No'}")
    for t in ['leads','contacts','companies','tasks','meetings','teams','deals']:
        r = api('GET', f'/rest/v1/{t}?select=id&limit=100', use_service_key=True)
        if r is not None:
            print(f"  {t}: {len(r)} rows")

def main():
    print(f"\n{hr()}\n  NEXUSCRM - Seed Script\n  Reads real .env\n{hr()}")
    load_env()
    while True:
        print(f"\n{bold('MENU')}")
        print(f"  {green('1')}. Create user + seed all data")
        print(f"  {green('2')}. Seed data for existing user")
        print(f"  {green('3')}. Status")
        print(f"  {red('4')}. Clear ALL data")
        print(f"  {green('0')}. Exit")
        c = input(f"\n  {bold('Select: ')}").strip()
        if c == '1': menu_create_user()
        elif c == '2': menu_seed_existing()
        elif c == '3': menu_status()
        elif c == '4': menu_clear_all()
        elif c == '0': print(green("Bye!")); break
        else: print(red("Invalid"))

if __name__ == '__main__':
    main()
