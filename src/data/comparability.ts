import type { ComparabilityContent } from '../types/budget';
// Static import of the committed, git-reviewed source-of-record (Phase 51).
// $0, no API/network change — the file is small, sourced, and version-controlled
// (the verifier scripts/verifyComparabilitySources.mjs gates its sourcing).
import content from '../../data/federal-comparability.json';

export const comparability: ComparabilityContent = content as ComparabilityContent;
