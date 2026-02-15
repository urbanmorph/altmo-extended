#!/bin/bash
#
# Refresh static transit data JSON files.
# Fetches transit data via the SvelteKit dev server and saves as static JSON.
#
# Prerequisites:
#   1. npm run dev  (start dev server in another terminal)
#   2. Ensure Overpass API is reachable (not rate-limited)
#
# Usage:
#   bash scripts/refresh-transit-data.sh
#
# The script fetches each city sequentially with a 2s pause between cities
# to avoid Overpass API rate limiting (429 errors).
#
# Output files: src/lib/data/transit/{cityId}.json
# These files are git-tracked and used at build time for instant page loads.

set -euo pipefail

BASE_URL="${DEV_SERVER_URL:-http://localhost:5173}"
OUT_DIR="src/lib/data/transit"

# Verify dev server is running
if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
  echo "ERROR: Dev server not running at $BASE_URL"
  echo "Start it first: npm run dev"
  exit 1
fi

mkdir -p "$OUT_DIR"

CITIES="ahmedabad bengaluru chennai delhi hyderabad indore kochi mumbai pune"

for city in $CITIES; do
  echo -n "Fetching $city... "
  HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT_DIR/$city.json" "$BASE_URL/api/internal/dump-transit?city=$city")
  if [ "$HTTP_CODE" = "200" ]; then
    # Pretty-print and show size
    SIZE=$(wc -c < "$OUT_DIR/$city.json" | tr -d ' ')
    echo "OK (${SIZE} bytes)"
  else
    echo "FAILED (HTTP $HTTP_CODE)"
    rm -f "$OUT_DIR/$city.json"
  fi
  # Pause between cities to be a good Overpass API citizen
  sleep 2
done

echo ""
echo "Done. Files saved to $OUT_DIR/"
echo "Commit these files to git for fast production page loads."
