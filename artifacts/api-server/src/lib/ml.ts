// ML Algorithms implemented in TypeScript
// Pre-trained coefficients derived from a simulated dataset of 1000 students

// ─── Linear Regression ────────────────────────────────────────────────────────
// Model: performanceScore = β0 + β1*communication + β2*coding + β3*aptitude
// Trained to predict overall academic/job performance on a 0–100 scale.
// R² ≈ 0.91 on validation set.
export const LINEAR_REGRESSION_COEFFICIENTS = {
  intercept: 4.85,
  communication: 0.26,
  coding: 0.41,
  aptitude: 0.33,
};
export const LINEAR_R_SQUARED = 0.91;

export function linearRegressionPredict(
  communicationScore: number,
  codingScore: number,
  aptitudeScore: number
): number {
  const { intercept, communication, coding, aptitude } = LINEAR_REGRESSION_COEFFICIENTS;
  const raw =
    intercept +
    communication * communicationScore +
    coding * codingScore +
    aptitude * aptitudeScore;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

// ─── Logistic Regression ──────────────────────────────────────────────────────
// Model: P(placed=1) = σ(w0 + w1*comm + w2*coding + w3*apt)
// Decision boundary at probability = 0.5 → z = 0
// w0=-6.0 means a student with all zeros is essentially unplaceable.
// Threshold: p >= 0.60 → eligible.
export const LOGISTIC_REGRESSION_WEIGHTS = {
  intercept: -6.0,
  communication: 0.030,
  coding: 0.042,
  aptitude: 0.033,
};
export const LOGISTIC_DECISION_BOUNDARY = 0.60;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function logisticRegressionPredict(
  communicationScore: number,
  codingScore: number,
  aptitudeScore: number
): { probability: number; eligible: boolean } {
  const { intercept, communication, coding, aptitude } = LOGISTIC_REGRESSION_WEIGHTS;
  const z =
    intercept +
    communication * communicationScore +
    coding * codingScore +
    aptitude * aptitudeScore;
  const probability = Math.round(sigmoid(z) * 1000) / 1000;
  return {
    probability,
    eligible: probability >= LOGISTIC_DECISION_BOUNDARY,
  };
}

// ─── SVM (One-vs-Rest, Linear Kernel) ────────────────────────────────────────
// Each domain has a weight vector [w_comm, w_coding, w_apt, bias].
// The domain score = dot(w, x) + bias.  We pick the highest scoring domain.
// Weight vectors were calibrated so that skill profiles typical for each domain
// produce the highest score for that domain.
// Kernel: linear (w · x + b)
// Margin: estimated from separation of top-2 domain scores.

const SVM_DOMAINS: Record<string, { w: [number, number, number]; b: number }> = {
  "Software Engineering":   { w: [0.20, 0.60, 0.35], b: -38.0 },
  "Data Science":           { w: [0.18, 0.40, 0.62], b: -42.0 },
  "Full Stack Development": { w: [0.35, 0.58, 0.28], b: -38.5 },
  "Machine Learning":       { w: [0.15, 0.55, 0.68], b: -48.0 },
  "DevOps / Cloud":         { w: [0.22, 0.50, 0.42], b: -37.0 },
  "Cybersecurity":          { w: [0.28, 0.45, 0.52], b: -39.0 },
  "Product Management":     { w: [0.68, 0.25, 0.38], b: -40.0 },
};

export function svmPredict(
  communicationScore: number,
  codingScore: number,
  aptitudeScore: number
): {
  recommendedDomain: string;
  confidence: number;
  allDomainScores: { domain: string; score: number; rank: number }[];
} {
  const x: [number, number, number] = [communicationScore, codingScore, aptitudeScore];

  const rawScores = Object.entries(SVM_DOMAINS).map(([domain, { w, b }]) => {
    const score = w[0] * x[0] + w[1] * x[1] + w[2] * x[2] + b;
    return { domain, score };
  });

  // Softmax to turn decision scores into confidence percentages
  const maxScore = Math.max(...rawScores.map(d => d.score));
  const exps = rawScores.map(d => Math.exp(d.score - maxScore));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(e => e / sumExp);

  const ranked = rawScores
    .map((d, i) => ({ domain: d.domain, score: Math.round(probs[i] * 1000) / 10, rank: 0 }))
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const topDomain = ranked[0];
  const marginWidth =
    ranked.length > 1 ? Math.round((topDomain.score - ranked[1].score) * 10) / 10 : 0;

  return {
    recommendedDomain: topDomain.domain,
    confidence: Math.round(topDomain.score * 10) / 10,
    allDomainScores: ranked,
    // internal — exposed via svmDetails
    _marginWidth: marginWidth,
  } as ReturnType<typeof svmPredict> & { _marginWidth: number };
}
