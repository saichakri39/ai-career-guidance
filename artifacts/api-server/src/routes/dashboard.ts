import { Router } from "express";
import { db, resumesTable, predictionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const resumes = await db.select().from(resumesTable).where(eq(resumesTable.userId, userId));
  const predictions = await db.select().from(predictionsTable)
    .where(eq(predictionsTable.userId, userId))
    .orderBy(desc(predictionsTable.createdAt));

  const totalResumes = resumes.length;
  const scores = resumes.filter(r => r.score != null).map(r => r.score as number);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const latestPrediction = predictions[0];
  const placementEligible = latestPrediction?.placementEligibility ?? false;
  const placementProbability = latestPrediction?.placementProbability ?? 0;

  const allSkills: string[] = resumes.flatMap(r => r.skills ?? []);
  const skillCounts: Record<string, number> = {};
  for (const skill of allSkills) {
    skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
  }
  const topSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([s]) => s);

  const allMissingSkills: string[] = resumes.flatMap(r => r.missingSkills ?? []);
  const missingCounts: Record<string, number> = {};
  for (const skill of allMissingSkills) {
    missingCounts[skill] = (missingCounts[skill] ?? 0) + 1;
  }
  const missingSkills = Object.entries(missingCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([s]) => s);

  const domainCounts: Record<string, number> = {};
  for (const p of predictions) {
    domainCounts[p.careerDomain] = (domainCounts[p.careerDomain] ?? 0) + 1;
  }
  const careerDomains = Object.entries(domainCounts).map(([domain, count]) => ({
    domain,
    count,
    confidence: Math.min(count / predictions.length, 1),
  }));

  const recentResumes = resumes.slice(-3).map(r => ({
    id: r.id,
    type: "resume",
    description: `Uploaded resume: ${r.originalName}`,
    createdAt: r.createdAt,
  }));
  const recentPredictions = predictions.slice(0, 3).map(p => ({
    id: p.id,
    type: "prediction",
    description: `Generated prediction: ${p.careerDomain} — Score: ${p.resumeScore}`,
    createdAt: p.createdAt,
  }));
  const recentActivity = [...recentResumes, ...recentPredictions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((a, i) => ({ ...a, id: a.id || i + 1 }));

  res.json({
    totalResumes,
    averageScore,
    bestScore,
    placementEligible,
    placementProbability,
    topSkills,
    missingSkills,
    careerDomains,
    recentActivity,
  });
});

router.get("/dashboard/skill-trends", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const resumes = await db.select({ skills: resumesTable.skills }).from(resumesTable).where(eq(resumesTable.userId, userId));

  const allSkills: string[] = resumes.flatMap(r => r.skills ?? []);
  const counts: Record<string, number> = {};
  for (const skill of allSkills) {
    counts[skill] = (counts[skill] ?? 0) + 1;
  }

  const techSkills = ["JavaScript", "Python", "React", "SQL", "Docker", "AWS", "TypeScript"];
  const softSkills = ["Communication", "Leadership", "Problem Solving", "Team Work", "Agile"];

  const trends = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([skill, count]) => ({
      skill,
      count,
      category: softSkills.some(s => skill.toLowerCase().includes(s.toLowerCase()))
        ? "Soft Skills"
        : "Technical",
    }));

  res.json(trends);
});

router.get("/dashboard/score-history", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const resumes = await db.select({
    id: resumesTable.id,
    score: resumesTable.score,
    createdAt: resumesTable.createdAt,
  }).from(resumesTable)
    .where(eq(resumesTable.userId, userId))
    .orderBy(resumesTable.createdAt);

  res.json(resumes
    .filter(r => r.score != null)
    .map(r => ({
      date: r.createdAt,
      score: r.score as number,
      resumeId: r.id,
    }))
  );
});

export default router;
