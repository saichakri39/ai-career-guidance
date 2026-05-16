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

function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenceMatch ? fenceMatch[1] : text;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    return {};
  }
}

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

Return a single JSON object (no markdown fences):
{
  "careerGuidance": "2-3 paragraph personalized career guidance",
  "skillImprovements": ["step1", "step2", "step3", "step4", "step5"],
  "courses": [
    {"title": "Course name", "provider": "Platform", "url": "https://www.coursera.org", "level": "Beginner"},
    {"title": "Course name", "provider": "Platform", "url": "https://www.udemy.com", "level": "Intermediate"},
    {"title": "Course name", "provider": "Platform", "url": "https://www.edx.org", "level": "Advanced"}
  ],
  "interviewTips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
  "resumeTips": ["tip1", "tip2", "tip3", "tip4", "tip5"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are a career counselor. Always respond with valid JSON only, no extra text." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = extractJson(content) as Record<string, unknown>;

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "career",
      content: JSON.stringify(result),
    });

    res.json({
      careerGuidance: (result.careerGuidance as string) ?? "Focus on building foundational skills and networking actively in your target domain.",
      skillImprovements: (result.skillImprovements as string[]) ?? [],
      courses: (result.courses as Array<{ title: string; provider: string; url: string; level: string }>) ?? [],
      interviewTips: (result.interviewTips as string[]) ?? [],
      resumeTips: (result.resumeTips as string[]) ?? [],
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

  const prompt = `You are a career counselor. Create a learning roadmap for:

Current Skills: ${skills.join(", ") || "None"}
Target Role: ${targetRole}

Return a single JSON object (no markdown fences):
{
  "targetRole": "${targetRole}",
  "estimatedMonths": 6,
  "phases": [
    {
      "phase": 1,
      "title": "Foundation",
      "skills": ["skill1", "skill2"],
      "duration": "6 weeks",
      "resources": ["resource1", "resource2"]
    },
    {
      "phase": 2,
      "title": "Core Skills",
      "skills": ["skill3", "skill4"],
      "duration": "8 weeks",
      "resources": ["resource1", "resource2"]
    },
    {
      "phase": 3,
      "title": "Advanced Topics",
      "skills": ["skill5", "skill6"],
      "duration": "6 weeks",
      "resources": ["resource1"]
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are a career counselor. Always respond with valid JSON only, no extra text." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = extractJson(content) as Record<string, unknown>;

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "roadmap",
      content: JSON.stringify(result),
    });

    res.json({
      targetRole: (result.targetRole as string) ?? targetRole,
      phases: (result.phases as Array<{ phase: number; title: string; skills: string[]; duration: string; resources: string[] }>) ?? [],
      estimatedMonths: (result.estimatedMonths as number) ?? 6,
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
