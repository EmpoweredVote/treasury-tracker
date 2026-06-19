#!/usr/bin/env bash
# Reusable cohort city loader: op+rev FY2003-2024 for a set of CA counties with
# no custom-city excludes (clean-slate counties). Per-FY with retry (SCO flaky);
# continues past a persistently-failing FY.
#
# Usage: loadCohortCities.sh <label> "County A" "County B" ...
#   <label> names the log files (scripts/load-<label>.log / .failures.txt).
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

LABEL="${1:?usage: loadCohortCities.sh <label> <county>...}"; shift
COUNTIES=("$@")
SRC_DATE="2026-06-18"; FY_START=2003; FY_END=2024; RETRIES=4
LOG="scripts/load-${LABEL}.log"; FAILED="scripts/load-${LABEL}.failures.txt"; : > "$FAILED"

echo "=== ${LABEL} city backfill started $(date) ===" | tee "$LOG"
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
echo "" | tee -a "$LOG"; echo "=== ${LABEL} city backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then echo "PERSISTENT FAILURES:" | tee -a "$LOG"; cat "$FAILED" | tee -a "$LOG";
else echo "No persistent failures — all FYs loaded." | tee -a "$LOG"; fi
