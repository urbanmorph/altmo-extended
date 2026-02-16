#!/bin/bash
#
# Refresh static core data directly from Rails production DB.
# No dev server needed — just requires SSH tunnel.
#
# Prerequisites:
#   ssh altmo-db-tunnel -N -f
#
# Usage:
#   bash scripts/refresh-core-data-db.sh

set -euo pipefail

echo "Refreshing core data from Rails DB (direct)..."
echo ""

npx tsx scripts/refresh-core-data-db.ts

echo ""
echo "Files saved to src/lib/data/"
echo "Commit these files to git for fast production page loads."
