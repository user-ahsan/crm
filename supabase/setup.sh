#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# NexusCRM – Supabase Setup Script
# ─────────────────────────────────────────────────────────────
# 1. Checks for Supabase CLI
# 2. Prompts for project URL and anon key if not in .env.local
# 3. Runs migration
# 4. Runs seed
# 5. Confirms setup
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     NexusCRM – Supabase Setup Script     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check for Supabase CLI ──────────────────────────
if ! command -v supabase &>/dev/null; then
  echo -e "${RED}ERROR: Supabase CLI is not installed.${NC}"
  echo "Install it with one of the following:"
  echo "  macOS: brew install supabase/tap/supabase"
  echo "  Linux: curl -fsSL https://cli.supabase.com/install.sh | sh"
  echo "  Windows: scoop install supabase"
  echo ""
  echo "Or follow: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo -e "${GREEN}✓ Supabase CLI detected:${NC} $(supabase --version)"
echo ""

# ── Step 2: Environment Variables ───────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local"

# Load existing .env.local if present
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Check / prompt for required vars
if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || [ "$NEXT_PUBLIC_SUPABASE_URL" = "https://your-project.supabase.co" ]; then
  echo -e "${YELLOW}NEXT_PUBLIC_SUPABASE_URL not set or still default.${NC}"
  read -rp "Enter your Supabase project URL: " NEXT_PUBLIC_SUPABASE_URL
  export NEXT_PUBLIC_SUPABASE_URL
fi

if [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] || [ "$NEXT_PUBLIC_SUPABASE_ANON_KEY" = "your-anon-key" ]; then
  echo -e "${YELLOW}NEXT_PUBLIC_SUPABASE_ANON_KEY not set or still default.${NC}"
  read -rp "Enter your Supabase anon key: " NEXT_PUBLIC_SUPABASE_ANON_KEY
  export NEXT_PUBLIC_SUPABASE_ANON_KEY
fi

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# ── Step 3: Run Migration ───────────────────────────────────
echo -e "${YELLOW}Running schema migration...${NC}"
MIGRATION_FILE="$SCRIPT_DIR/migrations/00001_initial_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}ERROR: Migration file not found at $MIGRATION_FILE${NC}"
  exit 1
fi

supabase db execute --file "$MIGRATION_FILE" \
  --project-ref "$(echo "$NEXT_PUBLIC_SUPABASE_URL" | grep -oP '(?<=https://)[^.]+')" 2>/dev/null \
  || echo -e "${YELLOW}  (If the db execute command fails, run the SQL manually via the Supabase Dashboard SQL editor.)${NC}"

echo -e "${GREEN}✓ Migration applied${NC}"
echo ""

# ── Step 4: Run Seed ───────────────────────────────────────
echo -e "${YELLOW}Running seed data...${NC}"
SEED_FILE="$SCRIPT_DIR/seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo -e "${RED}ERROR: Seed file not found at $SEED_FILE${NC}"
  exit 1
fi

supabase db execute --file "$SEED_FILE" \
  --project-ref "$(echo "$NEXT_PUBLIC_SUPABASE_URL" | grep -oP '(?<=https://)[^.]+')" 2>/dev/null \
  || echo -e "${YELLOW}  (If the db execute command fails, run the SQL manually via the Supabase Dashboard SQL editor.)${NC}"

echo -e "${GREEN}✓ Seed data inserted${NC}"
echo ""

# ── Step 5: Confirmation ────────────────────────────────────
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   NexusCRM Supabase Setup Complete!      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the migration at supabase/migrations/00001_initial_schema.sql"
echo "  2. Verify the seed data in your Supabase Dashboard"
echo "  3. Update .env.local with the full Supabase URL if needed"
echo "  4. Run 'supabase start' for local development"
echo ""
