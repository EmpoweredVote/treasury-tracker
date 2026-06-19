#!/usr/bin/env bash
set -u; cd "$(dirname "$0")/.."; set -a; . ./.env; set +a
LABEL="${1:?usage: sweepCohortSalaries.sh <label> <county>...}"; shift
COUNTIES=("$@"); LOG="scripts/salaries-${LABEL}.log"
echo "=== ${LABEL} salary sweep started $(date) ===" | tee "$LOG"
for county in "${COUNTIES[@]}"; do
  echo "" | tee -a "$LOG"; echo "########## $county salaries 2009-2024 ##########" | tee -a "$LOG"
  ok=0
  for attempt in 1 2 3; do
    echo "--- $county (attempt $attempt/3) ---" | tee -a "$LOG"
    if node scripts/sweepCASalaries.js --county "$county" --start-year 2009 --end-year 2024 >> "$LOG" 2>&1; then
      ok=1; echo "    OK $county salaries" | tee -a "$LOG"; break
    else echo "    FAIL $county attempt $attempt" | tee -a "$LOG"; sleep $((attempt*5)); fi
  done
  [ "$ok" -ne 1 ] && echo "    GAVE UP $county salaries" | tee -a "$LOG"
done
echo "" | tee -a "$LOG"; echo "=== ${LABEL} salary sweep finished $(date) ===" | tee -a "$LOG"
