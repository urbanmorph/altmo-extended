#!/bin/bash
#
# Refresh static Altmo Core API data (geo-markers, global stats).
# Fetches from the Rails API via the SvelteKit dev server.
#
# Prerequisites:
#   1. npm run dev  (start dev server in another terminal)
#   2. RAILS_API_URL and RAILS_API_ACCESS_TOKEN env vars set
#
# Usage:
#   bash scripts/refresh-core-data.sh
#
# Output files:
#   src/lib/data/geo-markers.json
#   src/lib/data/global-stats.json

set -euo pipefail

BASE_URL="${DEV_SERVER_URL:-http://localhost:5173}"
DATA_DIR="src/lib/data"

# Verify dev server is running
if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
  echo "ERROR: Dev server not running at $BASE_URL"
  echo "Start it first: npm run dev"
  exit 1
fi

echo -n "Fetching global stats... "
HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$DATA_DIR/global-stats.json" "$BASE_URL/api/internal/dump-core-data?type=global-stats")
echo "HTTP $HTTP_CODE ($(wc -c < "$DATA_DIR/global-stats.json" | tr -d ' ') bytes)"

echo -n "Fetching geo markers... "
HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$DATA_DIR/geo-markers.json" "$BASE_URL/api/internal/dump-core-data?type=geo-markers")
echo "HTTP $HTTP_CODE ($(wc -c < "$DATA_DIR/geo-markers.json" | tr -d ' ') bytes)"

echo ""
echo "Done. Files saved to $DATA_DIR/"
echo "Commit these files to git for fast production page loads."
