#!/usr/bin/env bash
set -u; cd "$(dirname "$0")/.."; set -a; . ./.env; set +a
SRC_DATE="2026-06-18"; FY_START=2003; FY_END=2024; RETRIES=4
LOG="scripts/loadBayAreaCountyGovs.log"; FAILED="scripts/loadBayAreaCountyGovs.failures.txt"; : > "$FAILED"
COUNTIES=("San Mateo" "Contra Costa" "Marin" "Sonoma" "Solano" "Napa")
echo "=== Bay Area county-gov backfill started $(date) ===" | tee "$LOG"
for county in "${COUNTIES[@]}"; do
  echo "" | tee -a "$LOG"; echo "########## $county County government ##########" | tee -a "$LOG"
  for fy in $(seq $FY_START $FY_END); do
    ok=0
    for attempt in $(seq 1 $RETRIES); do
      echo "--- $county County FY$fy (attempt $attempt/$RETRIES) ---" | tee -a "$LOG"
      if node scripts/loadCountyBudget.js --county "$county" --fy "$fy" --source-date "$SRC_DATE" >> "$LOG" 2>&1; then
        ok=1; echo "    OK $county County FY$fy" | tee -a "$LOG"; break
      else echo "    FAIL $county County FY$fy attempt $attempt" | tee -a "$LOG"; sleep $((attempt*3)); fi
    done
    [ "$ok" -ne 1 ] && { echo "$county County FY$fy" >> "$FAILED"; echo "    GAVE UP $county County FY$fy" | tee -a "$LOG"; }
  done
done
echo "" | tee -a "$LOG"; echo "=== Bay Area county-gov backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then echo "PERSISTENT FAILURES:" | tee -a "$LOG"; cat "$FAILED" | tee -a "$LOG"; else echo "No persistent failures." | tee -a "$LOG"; fi
