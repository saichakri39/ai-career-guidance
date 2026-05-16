import { Router } from "express";
import { db, resumesTable, suggestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetCareerSuggestionsBody, GetLearningRoadmapBody } from "@workspace/api-zod";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

router.post("/suggestions/career", requireAuth, async (req, res) => {
  const parsed = GetCareerSuggestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { resumeId, targetRole } = parsed.data;

  const [resume] = await db.select().from(resumesTable)
    .where(eq(resumesTable.id, resumeId))
    .limit(1);

  if (!resume || resume.userId !== req.user!.id) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const skills = resume.skills ?? [];
  const missingSkills = resume.missingSkills ?? [];
  const score = resume.score ?? 50;
  const target = targetRole ?? "Software Engineer";

  const prompt = `You are an expert career counselor. Based on this student's resume analysis:

Skills: ${skills.join(", ") || "None identified"}
Missing Skills: ${missingSkills.join(", ") || "None"}
Resume Score: ${score}/100
Target Role: ${target}

Provide a JSON response with:
{
  "careerGuidance": "2-3 paragraph personalized career guidance",
  "skillImprovements": ["5 specific actionable skill improvement steps"],
  "courses": [
    {"title": "Course name", "provider": "Coursera/Udemy/etc", "url": "https://...", "level": "Beginner/Intermediate/Advanced"},
    {"title": "...", "provider": "...", "url": "...", "level": "..."},
    {"title": "...", "provider": "...", "url": "...", "level": "..."}
  ],
  "interviewTips": ["5 specific interview preparation tips"],
  "resumeTips": ["5 specific resume improvement tips"]
}

Return ONLY the JSON, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "career",
      content: JSON.stringify(result),
    });

    res.json({
      careerGuidance: result.careerGuidance ?? "Focus on building foundational skills and networking.",
      skillImprovements: result.skillImprovements ?? [],
      courses: result.courses ?? [],
      interviewTips: result.interviewTips ?? [],
      resumeTips: result.resumeTips ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: "AI service unavailable", details: String(err) });
  }
});

router.post("/suggestions/roadmap", requireAuth, async (req, res) => {
  const parsed = GetLearningRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { skills, targetRole } = parsed.data;

  const prompt = `You are an expert career counselor. Create a learning roadmap for:

Current Skills: ${skills.join(", ") || "None"}
Target Role: ${targetRole}

Provide a JSON response with:
{
  "targetRole": "${targetRole}",
  "estimatedMonths": <number 3-18>,
  "phases": [
    {
      "phase": 1,
      "title": "Phase title",
      "skills": ["skill1", "skill2", "skill3"],
      "duration": "X weeks/months",
      "resources": ["resource1", "resource2"]
    }
  ]
}

Create 3-4 phases. Return ONLY the JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "roadmap",
      content: JSON.stringify(result),
    });

    res.json({
      targetRole: result.targetRole ?? targetRole,
      phases: result.phases ?? [],
      estimatedMonths: result.estimatedMonths ?? 6,
    });
  } catch (err) {
    res.status(500).json({ error: "AI service unavailable", details: String(err) });
  }
});

router.get("/suggestions/history", requireAuth, async (req, res) => {
  const suggestions = await db.select().from(suggestionsTable)
    .where(eq(suggestionsTable.userId, req.user!.id))
    .orderBy(suggestionsTable.createdAt);

  res.json(suggestions.map(s => ({
    id: s.id,
    userId: s.userId,
    type: s.type,
    content: s.content,
    createdAt: s.createdAt,
  })));
});

export default router;
