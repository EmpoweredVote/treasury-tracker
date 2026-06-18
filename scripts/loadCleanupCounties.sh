#!/usr/bin/env bash
# One-off driver: city op+rev FY2003-2024 for the Alameda + Sacramento cleanup
# (county-gov budgets already loaded in v2.4; only the cities were never swept).
# Per-FY with retry (SCO flaky). Per-county flagship/custom-city excludes:
#   Alameda    -> Oakland (named custom), Fremont (custom GF FY2019-2026)
#   Sacramento -> Sacramento (named custom)
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

SRC_DATE="2026-06-18"; FY_START=2003; FY_END=2024; RETRIES=4
LOG="scripts/loadCleanupCounties.log"; FAILED="scripts/loadCleanupCounties.failures.txt"; : > "$FAILED"

run_fy() { # $1=county  $2..=extra args
  local county="$1"; shift
  for fy in $(seq $FY_START $FY_END); do
    local ok=0
    for attempt in $(seq 1 $RETRIES); do
      echo "--- $county FY$fy (attempt $attempt/$RETRIES) ---" | tee -a "$LOG"
      if node scripts/bulkLoadStateController.js --county "$county" --fy "$fy" --source-date "$SRC_DATE" "$@" >> "$LOG" 2>&1; then
        ok=1; echo "    OK $county FY$fy" | tee -a "$LOG"; break
      else
        echo "    FAIL $county FY$fy attempt $attempt" | tee -a "$LOG"; sleep $((attempt * 3))
      fi
    done
    [ "$ok" -ne 1 ] && { echo "$county FY$fy" >> "$FAILED"; echo "    GAVE UP $county FY$fy" | tee -a "$LOG"; }
  done
}

echo "=== Cleanup city backfill started $(date) ===" | tee "$LOG"
echo "" | tee -a "$LOG"; echo "########## Alameda (exclude Oakland, Fremont) ##########" | tee -a "$LOG"
run_fy "Alameda" --exclude-city "Oakland" --exclude-city "Fremont"
echo "" | tee -a "$LOG"; echo "########## Sacramento (exclude Sacramento) ##########" | tee -a "$LOG"
run_fy "Sacramento" --exclude-city "Sacramento"

echo "" | tee -a "$LOG"; echo "=== Cleanup city backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then echo "PERSISTENT FAILURES:" | tee -a "$LOG"; cat "$FAILED" | tee -a "$LOG";
else echo "No persistent failures — all FYs loaded." | tee -a "$LOG"; fi
