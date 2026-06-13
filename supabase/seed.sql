-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Seed Data
-- ─────────────────────────────────────────────────────────────
-- Inserts sample records matching the mock data in data/*.ts
-- All IDs are deterministically generated for reproducibility.
-- ─────────────────────────────────────────────────────────────

-- 10 COMPANIES
-- ─────────────────────────────────────────────────────────────
insert into public.companies (id, name, industry, size, revenue, location, website) values
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp',             'Technology',        '201-1000', 50000000,  'San Francisco, CA', 'https://acme.com'),
  ('00000000-0000-0000-0000-000000000002', 'Globex Inc',            'Finance',           '51-200',   20000000,  'Toronto, ON',       'https://globex.io'),
  ('00000000-0000-0000-0000-000000000003', 'Initech Solutions',     'Healthcare',        '201-1000', 75000000,  'Boston, MA',        'https://initech.com'),
  ('00000000-0000-0000-0000-000000000004', 'Umbrella Corp',         'Technology',        '1000+',    200000000, 'Seattle, WA',       'https://umbrella.co'),
  ('00000000-0000-0000-0000-000000000005', 'Stark Industries',      'Manufacturing',     '1000+',    500000000, 'London, UK',        'https://stark.io'),
  ('00000000-0000-0000-0000-000000000006', 'Hooli Technologies',    'Technology',        '1000+',    150000000, 'Palo Alto, CA',     'https://hooli.com'),
  ('00000000-0000-0000-0000-000000000007', 'OctoCorp',              'Technology',        '1-10',     500000,    'Seoul, South Korea', 'https://octocorp.com'),
  ('00000000-0000-0000-0000-000000000008', 'Greenfield Analytics',  'Data & Analytics',  '11-50',    5000000,   'Berlin, Germany',   'https://greenfield.com'),
  ('00000000-0000-0000-0000-000000000009', 'Northwind Traders',     'Retail',            '201-1000', 40000000,  'Chicago, IL',       'https://northwind.com'),
  ('00000000-0000-0000-0000-00000000000a', 'MediTech Solutions',    'Healthcare',        '51-200',   15000000,  'San Diego, CA',     'https://meditech.com')
on conflict (id) do nothing;

-- 10 LEADS
-- ─────────────────────────────────────────────────────────────
insert into public.leads (id, full_name, email, phone, company_name, industry, country, source, status, priority, assigned_to, estimated_value, tags, notes) values
  ('00000000-0000-0000-0000-000000000010', 'John Davis',        'john.davis@acme.com',          '+1 (555) 123-4567', 'Acme Corp',         'Technology',    'United States',  'website', 'new',       'high',   'user-1', 25000,  ARRAY['tech','enterprise'],           'Interested in enterprise plan. Follow up with demo.'),
  ('00000000-0000-0000-0000-000000000011', 'Sarah Miller',      'sarah@globex.io',              '+1 (555) 234-5678', 'Globex Inc',        'Finance',       'Canada',         'referral','contacted', 'medium', 'user-2', 15000,  ARRAY['finance','mid-market'],         'Referred by existing client. Initial call done.'),
  ('00000000-0000-0000-0000-000000000012', 'Michael Chen',      'michael@initech.com',           null,                'Initech Solutions', 'Healthcare',    'United States',  'ads',     'qualified','high',   'user-1', 50000,  ARRAY['healthcare','enterprise','compliance'], 'Qualified. Needs HIPAA compliance demo.'),
  ('00000000-0000-0000-0000-000000000013', 'Emily Rodriguez',   'emily@umbrella.co',            '+1 (555) 345-6789', 'Umbrella Corp',     'Technology',    'United States',  'manual',  'proposal', 'high',   'user-3', 75000,  ARRAY['tech','enterprise','urgent'],   'Proposal sent. Awaiting board approval.'),
  ('00000000-0000-0000-0000-000000000014', 'James Wilson',      'james@stark.io',                null,                'Stark Industries',  'Manufacturing', 'United Kingdom', 'website', 'won',      'high',   'user-1', 120000, ARRAY['manufacturing','enterprise','won-deal'], 'Deal closed. Implementation starts next month.'),
  ('00000000-0000-0000-0000-000000000015', 'Lisa Thompson',     'lisa@hooli.com',               '+1 (555) 456-7890', 'Hooli Technologies','Technology',    'United States',  'social',  'lost',     'medium', 'user-2', 30000,  ARRAY['tech','lost-deal'],             'Chose competitor. Reason: pricing.'),
  ('00000000-0000-0000-0000-000000000016', 'Robert Kim',        'robert@octocorp.com',          '+1 (555) 567-8901', 'OctoCorp',          'Technology',    'South Korea',    'referral','new',       'low',    'user-4', 8000,   ARRAY['tech','startup'],               'Small startup looking for basic CRM.'),
  ('00000000-0000-0000-0000-000000000017', 'Amanda Foster',     'amanda@greenfield.com',          null,                'Greenfield Analytics','Data & Analytics','Germany',    'website', 'contacted','medium','user-3', 22000,  ARRAY['data','analytics','europe'],    'Initial contact made. Scheduling product demo.'),
  ('00000000-0000-0000-0000-000000000018', 'Thomas Baker',      'thomas@northwind.com',         '+1 (555) 678-9012', 'Northwind Traders', 'Retail',        'United States',  'ads',     'qualified','high',   'user-1', 45000,  ARRAY['retail','mid-market'],          'Qualified. Needs inventory management integration.'),
  ('00000000-0000-0000-0000-000000000019', 'Jennifer Park',     'jennifer@meditech.com',        '+1 (555) 789-0123', 'MediTech Solutions','Healthcare',    'United States',  'referral','proposal', 'high',   'user-2', 60000,  ARRAY['healthcare','enterprise'],      'Proposal for full suite under review.')
on conflict (id) do nothing;

-- 8 CONTACTS
-- ─────────────────────────────────────────────────────────────
insert into public.contacts (id, name, email, phone, job_title, company_id, lead_ids, location, social_links, tags, notes) values
  ('00000000-0000-0000-0000-000000000020', 'John Davis',        'john.davis@acme.com',       '+1 (555) 123-4567', 'CTO',                   '00000000-0000-0000-0000-000000000001', ARRAY['00000000-0000-0000-0000-000000000010']::uuid[], 'San Francisco, CA', ARRAY['https://linkedin.com/in/johndavis'],       ARRAY['decision-maker','tech'],       'Key decision maker at Acme Corp.'),
  ('00000000-0000-0000-0000-000000000021', 'Sarah Miller',      'sarah@globex.io',           '+1 (555) 234-5678', 'VP of Operations',       '00000000-0000-0000-0000-000000000002', ARRAY['00000000-0000-0000-0000-000000000011']::uuid[], 'Toronto, ON',       ARRAY['https://linkedin.com/in/sarahmiller'],      ARRAY['operations','finance'],        'Primary contact at Globex.'),
  ('00000000-0000-0000-0000-000000000022', 'Dr. Michael Chen',  'michael@initech.com',        null,                'Chief Medical Officer',  '00000000-0000-0000-0000-000000000003', ARRAY['00000000-0000-0000-0000-000000000012']::uuid[], 'Boston, MA',        ARRAY['https://linkedin.com/in/michaelchen'],      ARRAY['healthcare','decision-maker','compliance'], 'Oversees all tech decisions at Initech.'),
  ('00000000-0000-0000-0000-000000000023', 'Emily Rodriguez',   'emily@umbrella.co',         '+1 (555) 345-6789', 'Director of Engineering', '00000000-0000-0000-0000-000000000004', ARRAY['00000000-0000-0000-0000-000000000013']::uuid[], 'Seattle, WA',       ARRAY['https://linkedin.com/in/emilyrodriguez'],   ARRAY['engineering','decision-maker'], 'Technical lead evaluating our platform.'),
  ('00000000-0000-0000-0000-000000000024', 'James Wilson',      'james@stark.io',             null,                'CEO',                   '00000000-0000-0000-0000-000000000005', ARRAY['00000000-0000-0000-0000-000000000014']::uuid[], 'London, UK',        ARRAY['https://linkedin.com/in/jameswilson'],      ARRAY['ceo','decision-maker','manufacturing'], 'CEO of Stark Industries.'),
  ('00000000-0000-0000-0000-000000000025', 'Lisa Thompson',     'lisa@hooli.com',            '+1 (555) 456-7890', 'Procurement Manager',    '00000000-0000-0000-0000-000000000006', ARRAY['00000000-0000-0000-0000-000000000015']::uuid[], 'Palo Alto, CA',     ARRAY['https://linkedin.com/in/lisathompson'],     ARRAY['procurement','tech'],          'Handles vendor evaluation.'),
  ('00000000-0000-0000-0000-000000000026', 'Robert Kim',        'robert@octocorp.com',       '+1 (555) 567-8901', 'Founder & CEO',          '00000000-0000-0000-0000-000000000007', ARRAY['00000000-0000-0000-0000-000000000016']::uuid[], 'Seoul, South Korea', ARRAY['https://linkedin.com/in/robertkim'],        ARRAY['startup','ceo','tech'],        'Founder of OctoCorp.'),
  ('00000000-0000-0000-0000-000000000027', 'Amanda Foster',     'amanda@greenfield.com',       null,                'Data Science Lead',      '00000000-0000-0000-0000-000000000008', ARRAY['00000000-0000-0000-0000-000000000017']::uuid[], 'Berlin, Germany',   ARRAY['https://linkedin.com/in/amandafoster'],     ARRAY['data','analytics','europe'],   'Leading the evaluation team.')
on conflict (id) do nothing;

-- 6 TASKS
-- ─────────────────────────────────────────────────────────────
insert into public.tasks (id, title, description, related_to_type, related_to_id, assigned_to, due_date, priority, status) values
  ('00000000-0000-0000-0000-000000000030', 'Send proposal to Acme Corp',       'Send the enterprise proposal package to John Davis at Acme Corp.',              'lead', '00000000-0000-0000-0000-000000000010', 'user-1', '2026-06-15T17:00:00Z', 'high',   'pending'),
  ('00000000-0000-0000-0000-000000000031', 'Schedule demo with Globex',        'Set up product demonstration for Sarah Miller and her team.',                    'lead', '00000000-0000-0000-0000-000000000011', 'user-2', '2026-06-14T14:00:00Z', 'medium', 'pending'),
  ('00000000-0000-0000-0000-000000000032', 'Prepare HIPAA compliance docs',    'Gather compliance documentation for Initech Solutions healthcare demo.',          'lead', '00000000-0000-0000-0000-000000000012', 'user-1', '2026-06-10T17:00:00Z', 'high',   'completed'),
  ('00000000-0000-0000-0000-000000000033', 'Follow up on Umbrella proposal',   'Check in with Emily Rodriguez about the proposal status.',                        'lead', '00000000-0000-0000-0000-000000000013', 'user-3', '2026-06-12T10:00:00Z', 'high',   'pending'),
  ('00000000-0000-0000-0000-000000000034', 'Onboard Stark Industries',         'Begin implementation process for the new client.',                                'lead', '00000000-0000-0000-0000-000000000014', 'user-1', '2026-06-20T09:00:00Z', 'high',   'pending'),
  ('00000000-0000-0000-0000-000000000035', 'Review lost deal - Hooli',         'Analyze why Hooli chose a competitor and document lessons learned.',              'lead', '00000000-0000-0000-0000-000000000015', 'user-2', '2026-05-25T17:00:00Z', 'medium', 'completed')
on conflict (id) do nothing;

-- 5 MEETINGS
-- ─────────────────────────────────────────────────────────────
insert into public.meetings (id, title, participants, related_to_type, related_to_id, date_time, duration, type, notes, outcome) values
  ('00000000-0000-0000-0000-000000000040', 'Enterprise Demo - Acme Corp',           ARRAY['John Davis','Alice Johnson'],       'lead', '00000000-0000-0000-0000-000000000010', '2026-06-15T10:00:00Z', 60,  'online', 'Demo of enterprise features including advanced analytics.', 'Scheduled'),
  ('00000000-0000-0000-0000-000000000041', 'Discovery Call - Globex Inc',           ARRAY['Sarah Miller','Bob Smith'],         'lead', '00000000-0000-0000-0000-000000000011', '2026-06-03T14:00:00Z', 30,  'call',   'Initial discovery call to understand requirements.',          'Completed - Needs identified'),
  ('00000000-0000-0000-0000-000000000042', 'Compliance Review - Initech',           ARRAY['Dr. Michael Chen','Alice Johnson'], 'lead', '00000000-0000-0000-0000-000000000012', '2026-06-10T11:00:00Z', 45,  'online', 'Review HIPAA compliance features and certifications.',         'Completed - All requirements met'),
  ('00000000-0000-0000-0000-000000000043', 'Proposal Review - Umbrella Corp',       ARRAY['Emily Rodriguez','Carol Williams'], 'lead', '00000000-0000-0000-0000-000000000013', '2026-06-12T15:00:00Z', 60,  'online', 'Review the enterprise proposal and address any questions.',    'Scheduled'),
  ('00000000-0000-0000-0000-000000000044', 'Implementation Kickoff - Stark Industries', ARRAY['James Wilson','Alice Johnson','Eva Martinez'], 'lead', '00000000-0000-0000-0000-000000000014', '2026-06-20T09:00:00Z', 90,  'online', 'Kickoff meeting for Stark Industries implementation project.', 'Scheduled')
on conflict (id) do nothing;

-- 10 ACTIVITIES
-- ─────────────────────────────────────────────────────────────
insert into public.activities (id, entity_type, entity_id, type, description, timestamp, metadata) values
  ('00000000-0000-0000-0000-000000000050', 'lead', '00000000-0000-0000-0000-000000000010', 'created',          'Lead created: John Davis from Acme Corp',                          '2026-06-01T10:00:00Z', '{"source": "website", "value": 25000}'),
  ('00000000-0000-0000-0000-000000000051', 'lead', '00000000-0000-0000-0000-000000000011', 'status_changed',   'Status changed: New → Contacted',                                   '2026-06-02T09:00:00Z', '{"from": "new", "to": "contacted"}'),
  ('00000000-0000-0000-0000-000000000052', 'lead', '00000000-0000-0000-0000-000000000012', 'status_changed',   'Status changed: Contacted → Qualified',                             '2026-06-03T11:00:00Z', '{"from": "contacted", "to": "qualified"}'),
  ('00000000-0000-0000-0000-000000000053', 'lead', '00000000-0000-0000-0000-000000000014', 'status_changed',   'Status changed: Proposal → Won',                                    '2026-05-30T16:00:00Z', '{"from": "proposal", "to": "won", "value": 120000}'),
  ('00000000-0000-0000-0000-000000000054', 'lead', '00000000-0000-0000-0000-000000000015', 'status_changed',   'Status changed: Proposal → Lost',                                   '2026-05-20T10:00:00Z', '{"from": "proposal", "to": "lost", "reason": "pricing"}'),
  ('00000000-0000-0000-0000-000000000055', 'lead', '00000000-0000-0000-0000-000000000010', 'note_added',       'Note added: Need to prepare custom demo for CTO',                   '2026-06-05T14:00:00Z', null),
  ('00000000-0000-0000-0000-000000000056', 'lead', '00000000-0000-0000-0000-000000000019', 'created',          'Lead created: Jennifer Park from MediTech Solutions',               '2026-05-10T10:00:00Z', null),
  ('00000000-0000-0000-0000-000000000057', 'lead', '00000000-0000-0000-0000-000000000017', 'status_changed',   'Status changed: New → Contacted',                                   '2026-06-06T10:00:00Z', '{"from": "new", "to": "contacted"}'),
  ('00000000-0000-0000-0000-000000000058', 'meeting', '00000000-0000-0000-0000-000000000040', 'meeting_scheduled','Meeting scheduled: Enterprise Demo with Acme Corp',                  '2026-06-01T10:00:00Z', '{"leadId": "00000000-0000-0000-0000-000000000010", "date": "2026-06-15T10:00:00Z"}'),
  ('00000000-0000-0000-0000-000000000059', 'meeting', '00000000-0000-0000-0000-000000000041', 'meeting_completed', 'Meeting completed: Discovery Call with Globex Inc',                 '2026-06-03T15:00:00Z', '{"leadId": "00000000-0000-0000-0000-000000000011", "outcome": "Needs identified"}')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Seed complete — all sample data inserted.
-- ─────────────────────────────────────────────────────────────
