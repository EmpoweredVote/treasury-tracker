#!/usr/bin/env bash
# Reusable cohort county-GOVERNMENT budget loader: op+rev FY2003-2024 (all-gov-funds).
# Usage: loadCohortCountyGovs.sh <label> "County A" "County B" ...
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
LABEL="${1:?usage: loadCohortCountyGovs.sh <label> <county>...}"; shift
COUNTIES=("$@")
SRC_DATE="2026-06-18"; FY_START=2003; FY_END=2024; RETRIES=4
LOG="scripts/countygov-${LABEL}.log"; FAILED="scripts/countygov-${LABEL}.failures.txt"; : > "$FAILED"
echo "=== ${LABEL} county-gov backfill started $(date) ===" | tee "$LOG"
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
echo "" | tee -a "$LOG"; echo "=== ${LABEL} county-gov backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then echo "PERSISTENT FAILURES:" | tee -a "$LOG"; cat "$FAILED" | tee -a "$LOG"; else echo "No persistent failures." | tee -a "$LOG"; fi
