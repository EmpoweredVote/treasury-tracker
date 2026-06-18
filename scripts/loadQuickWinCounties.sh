#!/usr/bin/env bash
# One-off driver: load the 3 partial-county quick wins (Santa Clara, Fresno, Kern)
# city operating+revenue history FY2003-2024 from SCO ByTheNumbers.
#
# - Per-FY invocation with retry (SCO API is flaky — project memory).
# - Each county excludes its flagship custom-source city (no SCO backfill onto
#   richer custom budgets / basis mismatch).
# - Continues past a persistently-failing FY (recorded) so one bad year doesn't
#   abort the whole backfill.
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

SRC_DATE="2026-06-18"
FY_START=2003
FY_END=2024
RETRIES=4
LOG="scripts/loadQuickWinCounties.log"
FAILED="scripts/loadQuickWinCounties.failures.txt"
: > "$FAILED"

# county|exclude-city
COUNTIES=(
  "Santa Clara|San Jose"
  "Fresno|Fresno"
  "Kern|Bakersfield"
)

echo "=== Quick-win county backfill started $(date) ===" | tee "$LOG"

for entry in "${COUNTIES[@]}"; do
  county="${entry%%|*}"
  exclude="${entry##*|}"
  echo "" | tee -a "$LOG"
  echo "########## $county (exclude: $exclude) ##########" | tee -a "$LOG"
  for fy in $(seq $FY_START $FY_END); do
    ok=0
    for attempt in $(seq 1 $RETRIES); do
      echo "--- $county FY$fy (attempt $attempt/$RETRIES) ---" | tee -a "$LOG"
      if node scripts/bulkLoadStateController.js \
            --county "$county" --fy "$fy" \
            --exclude-city "$exclude" --source-date "$SRC_DATE" >> "$LOG" 2>&1; then
        ok=1
        echo "    OK $county FY$fy" | tee -a "$LOG"
        break
      else
        echo "    FAIL $county FY$fy attempt $attempt" | tee -a "$LOG"
        sleep $((attempt * 3))
      fi
    done
    if [ "$ok" -ne 1 ]; then
      echo "$county FY$fy" >> "$FAILED"
      echo "    GAVE UP $county FY$fy (recorded in $FAILED)" | tee -a "$LOG"
    fi
  done
done

echo "" | tee -a "$LOG"
echo "=== Backfill finished $(date) ===" | tee -a "$LOG"
if [ -s "$FAILED" ]; then
  echo "PERSISTENT FAILURES:" | tee -a "$LOG"
  cat "$FAILED" | tee -a "$LOG"
else
  echo "No persistent failures — all FYs loaded." | tee -a "$LOG"
fi
