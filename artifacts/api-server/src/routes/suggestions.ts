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
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

console.log(
  "KEY:",
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY
);

console.log(
  "KEY LENGTH:",
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.length
);
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

    if (resume.userId !== req.user!.id) {
      return res.status(403).json({
        error: "Unauthorized",
      });
    }

    const skills = Array.isArray(resume.skills)
      ? resume.skills
      : [];

    const missingSkills = Array.isArray(resume.missingSkills)
      ? resume.missingSkills
      : [];

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
      model: "llama-3.3-70b-versatile",
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

    const content =
      completion.choices?.[0]?.message?.content || "{}";

    console.log("CAREER AI RESPONSE:", content);

    const result = safeJsonParse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "career",
      content: JSON.stringify(result),
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("CAREER ERROR:");
    console.error(error);

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

    const safeSkills = Array.isArray(skills)
      ? skills
      : [];

    const prompt = `
Create a complete learning roadmap.

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
${safeSkills.join(", ")}

Target Role:
${targetRole}
`;

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a roadmap generator. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content =
      completion.choices?.[0]?.message?.content || "{}";

    console.log("ROADMAP AI RESPONSE:", content);

    const result = safeJsonParse(content);

    await db.insert(suggestionsTable).values({
      userId: req.user!.id,
      type: "roadmap",
      content: JSON.stringify(result),
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("ROADMAP ERROR:");
    console.error(error);

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

    return res.status(200).json(suggestions);
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