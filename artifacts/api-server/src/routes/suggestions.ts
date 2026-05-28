import { Router } from "express";
import { db, resumesTable, suggestionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  GetCareerSuggestionsBody,
  GetLearningRoadmapBody,
} from "@workspace/api-zod";

import OpenAI from "openai";

const router = Router();

/* =======================================================
   OPENAI / GROQ CONFIG
======================================================= */

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

/* =======================================================
   SAFE JSON PARSER
======================================================= */

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start !== -1 && end !== -1) {
        return JSON.parse(text.slice(start, end + 1));
      }

      return {};
    } catch {
      return {};
    }
  }
}

/* =======================================================
   CAREER SUGGESTIONS
======================================================= */

router.post("/suggestions/career", requireAuth, async (req, res) => {
  try {
    const parsed = GetCareerSuggestionsBody.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
      });
    }

    const { resumeId, targetRole } = parsed.data;

    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.id, resumeId))
      .limit(1);

    if (!resume) {
      return res.status(404).json({
        error: "Resume not found",
      });
    }

    const skills = resume.skills || [];
    const missingSkills = resume.missingSkills || [];
    const score = resume.score || 50;

    const prompt = `
You are an expert AI career counselor.

Return ONLY valid JSON.

{
  "careerGuidance": "string",
  "skillImprovements": ["string"],
  "courses": [
    {
      "title": "string",
      "provider": "string",
      "url": "string",
      "level": "string"
    }
  ],
  "interviewTips": ["string"],
  "resumeTips": ["string"]
}

Student Skills:
${skills.join(", ")}

Missing Skills:
${missingSkills.join(", ")}

Resume Score:
${score}

Target Role:
${targetRole}
`;

    const completion = await openai.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a career counselor. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices?.[0]?.message?.content || "{}";

    console.log("CAREER AI RESPONSE:", content);

    const result = safeJsonParse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "career",
      content: JSON.stringify(result),
    });

    return res.json(result);
  } catch (error: any) {
    console.error("CAREER ERROR:");
    console.error(error);
    console.error(error?.response?.data);
    console.error(error?.message);

    return res.status(500).json({
      error: "Career suggestions failed",
      details: error?.message || "Unknown error",
    });
  }
});

/* =======================================================
   ROADMAP
======================================================= */

router.post("/suggestions/roadmap", requireAuth, async (req, res) => {
  try {
    const parsed = GetLearningRoadmapBody.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
      });
    }

    const { skills, targetRole } = parsed.data;

    const prompt = `
Create a learning roadmap.

Return ONLY valid JSON.

{
  "targetRole": "string",
  "estimatedMonths": 6,
  "phases": [
    {
      "phase": 1,
      "title": "string",
      "skills": ["string"],
      "duration": "string",
      "resources": ["string"]
    }
  ]
}

Current Skills:
${skills.join(", ")}

Target Role:
${targetRole}
`;

    const completion = await openai.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices?.[0]?.message?.content || "{}";

    console.log("ROADMAP AI RESPONSE:", content);

    const result = safeJsonParse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "roadmap",
      content: JSON.stringify(result),
    });

    return res.json(result);
  } catch (error: any) {
    console.error("ROADMAP ERROR:");
    console.error(error);
    console.error(error?.response?.data);
    console.error(error?.message);

    return res.status(500).json({
      error: "Roadmap generation failed",
      details: error?.message || "Unknown error",
    });
  }
});

/* =======================================================
   HISTORY
======================================================= */

router.get("/suggestions/history", requireAuth, async (req, res) => {
  try {
    const suggestions = await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.userId, req.user!.id))
      .orderBy(desc(suggestionsTable.createdAt));

    return res.json(suggestions);
  } catch (error: any) {
    console.error("HISTORY ERROR:");
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch suggestions history",
      details: error?.message || "Unknown error",
    });
  }
});

export default router;