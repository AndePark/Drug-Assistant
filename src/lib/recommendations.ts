import medicationsData from "@/data/medications.json";
import rulesData from "@/data/rules.json";

export type Medication = {
  id: string;
  brandName: string;
  genericName: string;
  aliases: string[];
  description: string;
  indications: string[];
};

export type Recommendation = Medication & {
  score: number;
  matchedSymptoms: string[];
  matchReasons: string[];
};

type RecommendationCandidate = Recommendation & {
  unmatchedCoverageCount: number;
};

const medications = medicationsData.medications as Medication[];
const medicationById = new Map(medications.map((m) => [m.id, m]));

const symptomSynonyms = rulesData.symptomSynonyms as Record<string, string[]>;
const exceptionRules = rulesData.exceptionRules as Record<string, string[]>;
const MATCH_THRESHOLD = (rulesData.matchThreshold as number) ?? 0.35;
const MAP_THRESHOLD = (rulesData.mapThreshold as number) ?? 0.22;

export type SymptomMapping = {
  from: string;
  to: string;
};

/** All symptom phrases the engine knows (from drug indications + synonyms). */
const knownSymptomPhrases: string[] = (() => {
  const phrases = new Set<string>();
  for (const med of medications) {
    for (const indication of med.indications) phrases.add(indication);
  }
  for (const [key, synonyms] of Object.entries(symptomSynonyms)) {
    phrases.add(key);
    for (const syn of synonyms) phrases.add(syn);
  }
  return [...phrases];
})();

function normalizeExceptionPhrase(item: string): string {
  return item
    .replace(/^(allergic|allergy|sensitive)\s+to\s+/i, "")
    .replace(/^allergic\s+/i, "")
    .trim()
    .toLowerCase();
}

export function parseInputList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseExceptions(raw: string): string[] {
  return parseInputList(raw).map((item) => normalizeExceptionPhrase(item.toLowerCase()));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/]+/)
    .map((t) => t.replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length > 1);
}

/** Expand a user symptom into search phrases (original + synonyms). */
function expandSymptomPhrases(symptom: string): string[] {
  const lower = symptom.toLowerCase().trim();
  const phrases = new Set<string>([lower]);

  for (const [phrase, synonyms] of Object.entries(symptomSynonyms)) {
    if (lower.includes(phrase) || phrase.includes(lower)) {
      for (const syn of synonyms) phrases.add(syn);
    }
    for (const token of tokenize(lower)) {
      if (phrase.includes(token) || token.includes(phrase)) {
        for (const syn of synonyms) phrases.add(syn);
      }
    }
  }

  for (const token of tokenize(lower)) {
    if (symptomSynonyms[token]) {
      for (const syn of symptomSynonyms[token]) phrases.add(syn);
    }
  }

  return [...phrases];
}

/** How well an indication matches a symptom phrase (0–1). */
function phraseMatchScore(symptomPhrase: string, indication: string): number {
  const s = symptomPhrase.toLowerCase().trim();
  const i = indication.toLowerCase().trim();

  if (s === i) return 1;
  if (s.includes(i) || i.includes(s)) return 0.9;

  const sTokens = tokenize(s);
  const iTokens = tokenize(i);
  if (sTokens.length === 0 || iTokens.length === 0) return 0;

  let matched = 0;
  for (const st of sTokens) {
    if (iTokens.some((it) => it === st || it.includes(st) || st.includes(it))) {
      matched += 1;
    }
  }

  const tokenScore = matched / Math.max(sTokens.length, iTokens.length);
  return tokenScore >= 0.5 ? 0.5 + tokenScore * 0.45 : 0;
}

export type SymptomMedMatch = {
  score: number;
  bestIndication: string;
};

/** Score how well a medication fits one user symptom. */
export function scoreMedicationForSymptom(
  med: Medication,
  symptom: string,
): SymptomMedMatch | null {
  const phrases = expandSymptomPhrases(symptom);
  let bestScore = 0;
  let bestIndication = "";

  for (const phrase of phrases) {
    for (const indication of med.indications) {
      const score = phraseMatchScore(phrase, indication);
      if (score > bestScore) {
        bestScore = score;
        bestIndication = indication;
      }
    }
  }

  if (bestScore < MATCH_THRESHOLD) return null;
  return { score: bestScore, bestIndication };
}

/** Map free-text symptom to the closest known phrase in the database. */
export function findClosestKnownSymptom(
  symptom: string,
): { mapped: string; score: number } | null {
  const searchPhrases = expandSymptomPhrases(symptom);
  let bestMapped = "";
  let bestScore = 0;

  for (const known of knownSymptomPhrases) {
    for (const phrase of searchPhrases) {
      const score = phraseMatchScore(phrase, known);
      if (score > bestScore) {
        bestScore = score;
        bestMapped = known;
      }
    }
  }

  if (bestScore < MAP_THRESHOLD || !bestMapped) return null;
  return { mapped: bestMapped, score: bestScore };
}

function medicationMatchesText(med: Medication, text: string): boolean {
  const lower = text.toLowerCase();
  return (
    med.id === lower ||
    med.genericName.toLowerCase() === lower ||
    med.brandName.toLowerCase() === lower ||
    med.aliases.some(
      (a) => a === lower || lower.includes(a) || a.includes(lower),
    )
  );
}

function getExcludedMedicationIds(exceptions: string[]): Set<string> {
  const excluded = new Set<string>();

  for (const exception of exceptions) {
    if (exceptionRules[exception]) {
      for (const id of exceptionRules[exception]) excluded.add(id);
      continue;
    }

    const ruleKey = Object.keys(exceptionRules).find(
      (key) => key.includes(exception) || exception.includes(key),
    );
    if (ruleKey) {
      for (const id of exceptionRules[ruleKey]) excluded.add(id);
    }

    const allergyMed = medications.find((m) => medicationMatchesText(m, exception));
    if (allergyMed) {
      excluded.add(allergyMed.id);
      const related = exceptionRules[allergyMed.id];
      if (related) {
        for (const id of related) excluded.add(id);
      }
    }
  }

  return excluded;
}

function pickCoverageFirstRecommendations(
  candidates: Recommendation[],
  symptoms: string[],
  limit: number,
): Recommendation[] {
  const normalizedSymptoms = symptoms.map((s) => s.toLowerCase().trim());
  const uncoveredSymptoms = new Set(normalizedSymptoms);
  const remainingCandidates = [...candidates];
  const selected: Recommendation[] = [];

  while (selected.length < limit && remainingCandidates.length > 0) {
    const rankedCandidates: RecommendationCandidate[] = remainingCandidates.map(
      (candidate) => {
        const unmatchedCoverageCount = candidate.matchedSymptoms.reduce(
          (count, symptom) => {
            const normalized = symptom.toLowerCase().trim();
            return uncoveredSymptoms.has(normalized) ? count + 1 : count;
          },
          0,
        );
        return { ...candidate, unmatchedCoverageCount };
      },
    );

    rankedCandidates.sort(
      (a, b) =>
        b.unmatchedCoverageCount - a.unmatchedCoverageCount ||
        b.score - a.score ||
        a.brandName.localeCompare(b.brandName),
    );

    const best = rankedCandidates[0];
    if (!best || best.unmatchedCoverageCount === 0) {
      // All symptoms covered — fill remaining slots by highest score
      const byScore = [...remainingCandidates].sort((a, b) => b.score - a.score);
      for (const c of byScore) {
        if (selected.length >= limit) break;
        if (!selected.some((s) => s.id === c.id)) selected.push(c);
      }
      break;
    }

    selected.push(best);

    for (const symptom of best.matchedSymptoms) {
      uncoveredSymptoms.delete(symptom.toLowerCase().trim());
    }

    const bestIndex = remainingCandidates.findIndex((c) => c.id === best.id);
    if (bestIndex >= 0) remainingCandidates.splice(bestIndex, 1);
  }

  return selected;
}

function applySymptomToScores(
  symptom: string,
  symptomForMatching: string,
  labelPrefix: string,
  excluded: Set<string>,
  scores: Map<
    string,
    { score: number; matchedSymptoms: string[]; matchReasons: string[] }
  >,
): boolean {
  let hadMatch = false;

  for (const med of medications) {
    if (excluded.has(med.id)) continue;

    const match = scoreMedicationForSymptom(med, symptomForMatching);
    if (!match) continue;

    hadMatch = true;
    const current = scores.get(med.id) ?? {
      score: 0,
      matchedSymptoms: [],
      matchReasons: [],
    };

    current.score += match.score;
    if (!current.matchedSymptoms.includes(symptom)) {
      current.matchedSymptoms.push(symptom);
    }
    const reason = `${labelPrefix} → ${match.bestIndication}`;
    if (!current.matchReasons.includes(reason)) {
      current.matchReasons.push(reason);
    }
    scores.set(med.id, current);
  }

  return hadMatch;
}

export function getRecommendations(
  symptomsRaw: string,
  exceptionsRaw: string,
  limit = 3,
): {
  recommendations: Recommendation[];
  unmatchedSymptoms: string[];
  symptomMappings: SymptomMapping[];
} {
  const symptoms = parseInputList(symptomsRaw);
  const exceptions = parseExceptions(exceptionsRaw);
  const excluded = getExcludedMedicationIds(exceptions);

  const scores = new Map<
    string,
    {
      score: number;
      matchedSymptoms: string[];
      matchReasons: string[];
    }
  >();
  const unmatchedSymptoms: string[] = [];
  const symptomMappings: SymptomMapping[] = [];

  for (const symptom of symptoms) {
    let symptomHadMatch = applySymptomToScores(
      symptom,
      symptom,
      symptom,
      excluded,
      scores,
    );

    if (!symptomHadMatch) {
      const closest = findClosestKnownSymptom(symptom);
      if (closest) {
        symptomMappings.push({ from: symptom, to: closest.mapped });
        symptomHadMatch = applySymptomToScores(
          symptom,
          closest.mapped,
          `${symptom} (as ${closest.mapped})`,
          excluded,
          scores,
        );
      }
    }

    if (!symptomHadMatch) unmatchedSymptoms.push(symptom);
  }

  const recommendations = [...scores.entries()].flatMap(
    ([id, { score, matchedSymptoms, matchReasons }]) => {
      const med = medicationById.get(id);
      if (!med) return [];
      return [
        {
          ...med,
          score,
          matchedSymptoms,
          matchReasons,
        } satisfies Recommendation,
      ];
    },
  );

  const selectedRecommendations = pickCoverageFirstRecommendations(
    recommendations,
    symptoms,
    limit,
  );

  return {
    recommendations: selectedRecommendations,
    unmatchedSymptoms,
    symptomMappings,
  };
}
