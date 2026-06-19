#!/usr/bin/env bash
# Bay Area expansion: city op+rev FY2003-2024 for the 6 remaining Bay Area
# counties (Alameda + Santa Clara already done; SF is a city-county already loaded).
# No custom-city excludes — all 6 are a clean slate (0 skipped in dry-run).
# Per-FY with retry (SCO flaky); continues past a persistently-failing FY.
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

SRC_DATE="2026-06-18"; FY_START=2003; FY_END=2024; RETRIES=4
LOG="scripts/loadBayAreaCounties.log"; FAILED="scripts/loadBayAreaCounties.failures.txt"; : > "$FAILED"
COUNTIES=("San Mateo" "Contra Costa" "Marin" "Sonoma" "Solano" "Napa")

echo "=== Bay Area city backfill started $(date) ===" | tee "$LOG"
for county in "${COUNTIES[@]}"; do
  echo "" | tee -a "$LOG"; echo "########## $county ##########" | tee -a "$LOG"
  for fy in $(seq $FY_START $FY_END); do
    ok=0
    for attempt in $(seq 1 $RETRIES); do
      echo "--- $county FY$fy (attempt $attempt/$RETRIES) ---" | tee -a "$LOG"
      if node scripts/bulkLoadStateController.js --county "$county" --fy "$fy" --source-date "$SRC_DATE" >> "$LOG" 2>&1; then
        ok=1; echo "    OK $county FY$fy" | tee -a "$LOG"; break
      else echo "    FAIL $county FY$fy attempt $attempt" | tee -a "$LOG"; sleep $((attempt*3)); fi
    done
    [ "$ok" -ne 1 ] && { echo "$county FY$fy" >> "$FAILED"; echo "    GAVE UP $county FY$fy" | tee -a "$LOG"; }
  done
done
echo "" | tee -a "$LOG"; echo "=== Bay Area city backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then echo "PERSISTENT FAILURES:" | tee -a "$LOG"; cat "$FAILED" | tee -a "$LOG";
else echo "No persistent failures — all FYs loaded." | tee -a "$LOG"; fi
