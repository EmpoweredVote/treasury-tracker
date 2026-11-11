/**
 * ⚠⚠⚠ A MODEL OF ANOTHER SERVICE CANNOT NOTICE THAT SERVICE CHANGING.
 *
 * `treasury.reader_link_census()` reproduces, in SQL, the precedence
 * `EmpoweredVote/ev-accounts` applies when it builds `data_source_info`. That
 * model is what lets this gate ask about the URLs a READER is handed rather
 * than only the ones TT stores — and it is how #381 found a 404 that had been
 * published to eight West Hollywood budgets.
 *
 * It is also a copy of somebody else's rule, in another repository, with
 * nothing holding the two together. ev-accounts#1372 changed that rule and
 * deployed it; the census went on describing the old one, and the gate spent a
 * day printing "704 budgets shown a landing page — the repair is in
 * ev-accounts" about a repair that had already shipped. No fence inside the
 * model could have caught that, because the model was self-consistent. It was
 * simply about a world that had moved.
 *
 * ⭐ So the model is checked against the thing it models: ask the LIVE API what
 * it actually publishes for budgets the census has an opinion about, and
 * compare. The census says "this URL reaches a reader of Bradbury FY2021"; the
 * API is the only authority on whether that is true.
 *
 * ⛔ This deliberately does NOT re-implement the precedence in JavaScript. A
 * third copy of the rule would drift from the other two and would agree with
 * the SQL for exactly the wrong reason — both being wrong together is the
 * failure mode, not a passing test.
 */

/**
 * Every URL the API publishes for one budget. Both fields of
 * `data_source_info` reach the browser (#381), so both count as "published",
 * whatever the chip currently links to.
 */
export function publishedUrlsFor(budget) {
  const info = budget && budget.data_source_info;
  if (!info) return [];
  return [info.url, info.datasetUrl].filter((u) => typeof u === 'string' && u.length > 0);
}

/**
 * Compare what the census CLAIMS is published against what the API DID publish.
 *
 * `expectations`: rows from reader_link_census(), each naming a URL and one
 *   sample budget (source, entity, state, fiscal year).
 * `observed`: Map keyed `${state}|${entity}|${fiscalYear}` -> array of budgets
 *   as the API returned them, or the string 'unreachable'.
 *
 * ⚠ A budget the API does not return at all is `unresolved`, never `drifted`.
 * Not finding something is a fact about this lookup, not about the service —
 * the same distinction #373 drew between `dead` and `unreachable`, and #376
 * between "a HEAD said 404" and "the document is gone".
 */
export function judgeDrift(expectations, observed) {
  const drifted = [];
  const unresolved = [];
  let agreed = 0;

  for (const e of expectations) {
    const key = sampleKey(e);
    const got = observed.get(key);

    if (got === 'unreachable' || got === undefined) {
      unresolved.push({ ...e, why: got === 'unreachable' ? 'the API could not be asked' : 'no lookup was made' });
      continue;
    }
    const matching = got.filter((b) => Number(b.fiscal_year) === Number(e.sample_fiscal_year));
    if (!matching.length) {
      unresolved.push({ ...e, why: `the API returned no FY${e.sample_fiscal_year} budget for this entity` });
      continue;
    }
    const published = new Set(matching.flatMap(publishedUrlsFor));
    if (published.size === 0) {
      unresolved.push({ ...e, why: 'the API published no data_source_info for this budget' });
      continue;
    }
    if (published.has(e.source_url)) {
      agreed += 1;
    } else {
      drifted.push({ ...e, published: [...published].sort() });
    }
  }
  return { checked: expectations.length, agreed, drifted, unresolved };
}

export function sampleKey(e) {
  return `${e.sample_state || ''}|${e.sample_entity || ''}|${e.sample_fiscal_year}`;
}

/**
 * ⚠ The sample is bounded and spread across ENTITIES, not taken from the top of
 * the list. The census is dominated by a few large publishers, so the first N
 * rows would ask about one of them N times and call that coverage.
 */
export function pickDriftSample(rows, limit = 8) {
  const byEntity = new Map();
  for (const r of rows) {
    if (!r.sample_entity || !r.sample_fiscal_year) continue;
    const k = `${r.sample_state || ''}|${r.sample_entity}`;
    if (!byEntity.has(k)) byEntity.set(k, []);
    byEntity.get(k).push(r);
  }
  const out = [];
  const queues = [...byEntity.values()].map((v) => v.slice().sort((a, b) => a.source_url.localeCompare(b.source_url)));
  let round = 0;
  while (out.length < limit) {
    let added = false;
    for (const q of queues) {
      if (q.length > round) {
        out.push(q[round]);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return out;
}

export function driftIsClean(d) {
  return d.drifted.length === 0;
}
