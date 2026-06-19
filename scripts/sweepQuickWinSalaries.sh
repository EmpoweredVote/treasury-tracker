#!/usr/bin/env bash
# One-off driver: GCC salary sweep (2009-2024) for the 3 quick-win counties.
# Additive + never-overwrite. ZIPs are cached across runs (gcc-salary-cache),
# so per-county invocations reuse downloads. Retry per county (GCC can flake).
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

RETRIES=3
LOG="scripts/sweepQuickWinSalaries.log"
COUNTIES=("Santa Clara" "Fresno" "Kern")

echo "=== Salary sweep started $(date) ===" | tee "$LOG"
for county in "${COUNTIES[@]}"; do
  echo "" | tee -a "$LOG"
  echo "########## $county salaries 2009-2024 ##########" | tee -a "$LOG"
  ok=0
  for attempt in $(seq 1 $RETRIES); do
    echo "--- $county (attempt $attempt/$RETRIES) ---" | tee -a "$LOG"
    if node scripts/sweepCASalaries.js --county "$county" --start-year 2009 --end-year 2024 >> "$LOG" 2>&1; then
      ok=1; echo "    OK $county salaries" | tee -a "$LOG"; break
    else
      echo "    FAIL $county attempt $attempt" | tee -a "$LOG"; sleep $((attempt * 5))
    fi
  done
  [ "$ok" -ne 1 ] && echo "    GAVE UP $county salaries" | tee -a "$LOG"
done
echo "" | tee -a "$LOG"
echo "=== Salary sweep finished $(date) ===" | tee -a "$LOG"
