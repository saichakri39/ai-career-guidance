import { Router } from "express";
import { db, resumesTable, predictionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ScoreResumeBody } from "@workspace/api-zod";

const router = Router();

const CAREER_DOMAINS = [
  "Software Engineering",
  "Data Science",
  "DevOps/Cloud",
  "Full Stack Development",
  "Machine Learning",
  "Cybersecurity",
  "Product Management",
];

const CLUSTER_GROUPS = [
  "Technical Expert",
  "Emerging Talent",
  "Generalist",
  "Specialist",
  "Leadership Track",
];

function predictCareerDomain(skills: string[]): string {
  const skillLower = skills.map(s => s.toLowerCase());
  const scores: Record<string, number> = {
    "Software Engineering": 0,
    "Data Science": 0,
    "DevOps/Cloud": 0,
    "Full Stack Development": 0,
    "Machine Learning": 0,
    "Cybersecurity": 0,
    "Product Management": 0,
  };

  const domainSkills: Record<string, string[]> = {
    "Software Engineering": ["java", "c++", "c#", "go", "rust", "algorithms"],
    "Data Science": ["python", "r", "pandas", "numpy", "data analysis", "sql", "matlab"],
    "DevOps/Cloud": ["docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "linux", "jenkins"],
    "Full Stack Development": ["javascript", "typescript", "react", "node.js", "html", "css", "graphql"],
    "Machine Learning": ["machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn"],
    "Cybersecurity": ["linux", "security", "network"],
    "Product Management": ["agile", "scrum", "leadership", "communication"],
  };

  for (const [domain, dSkills] of Object.entries(domainSkills)) {
    for (const skill of dSkills) {
      if (skillLower.some(s => s.includes(skill))) {
        scores[domain]++;
      }
    }
  }

  const topDomain = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return topDomain ? topDomain[0] : "Software Engineering";
}

function predictPlacement(score: number, skillCount: number): { eligible: boolean; probability: number } {
  const probability = Math.min((score * 0.6 + skillCount * 2) / 100, 1);
  return {
    eligible: probability >= 0.6,
    probability: Math.round(probability * 100) / 100,
  };
}

function predictCluster(skills: string[], score: number): string {
  if (score >= 85 && skills.length >= 15) return "Technical Expert";
  if (score >= 70 && skills.length >= 10) return "Specialist";
  if (score >= 60) return "Generalist";
  if (skills.length <= 5) return "Emerging Talent";
  return "Generalist";
}

router.post("/predictions/score", requireAuth, async (req, res) => {
  const parsed = ScoreResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { resumeId } = parsed.data;

  const [resume] = await db.select().from(resumesTable)
    .where(eq(resumesTable.id, resumeId))
    .limit(1);

  if (!resume || resume.userId !== req.user!.id) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const skills = resume.skills ?? [];
  const score = resume.score ?? 50;
  const careerDomain = predictCareerDomain(skills);
  const { eligible, probability } = predictPlacement(score, skills.length);
  const clusterGroup = predictCluster(skills, score);
  const performancePrediction = Math.round(score * 0.85 + skills.length * 0.5);
  const skillGaps = resume.missingSkills ?? [];

  const [prediction] = await db.insert(predictionsTable).values({
    userId: req.user!.id,
    resumeId,
    resumeScore: score,
    placementEligibility: eligible,
    placementProbability: probability,
    careerDomain,
    clusterGroup,
    performancePrediction,
    skillGaps,
  }).returning();

  res.json({
    resumeScore: prediction.resumeScore,
    placementEligibility: prediction.placementEligibility,
    placementProbability: prediction.placementProbability,
    careerDomain: prediction.careerDomain,
    clusterGroup: prediction.clusterGroup,
    performancePrediction: prediction.performancePrediction,
    skillGaps: prediction.skillGaps,
  });
});

router.get("/predictions/history", requireAuth, async (req, res) => {
  const predictions = await db.select().from(predictionsTable)
    .where(eq(predictionsTable.userId, req.user!.id))
    .orderBy(predictionsTable.createdAt);

  res.json(predictions.map(p => ({
    id: p.id,
    userId: p.userId,
    resumeId: p.resumeId,
    resumeScore: p.resumeScore,
    placementEligibility: p.placementEligibility,
    placementProbability: p.placementProbability,
    careerDomain: p.careerDomain,
    clusterGroup: p.clusterGroup,
    performancePrediction: p.performancePrediction,
    skillGaps: p.skillGaps,
    createdAt: p.createdAt,
  })));
});

export default router;
