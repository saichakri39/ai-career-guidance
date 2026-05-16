import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { db, resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const upload = multer({
  dest: "/tmp/resume-uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, DOCX, and TXT files are allowed"));
    }
  },
});

const router = Router();

function extractSkillsFromText(text: string): string[] {
  const skillKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "Ruby",
    "React", "Vue", "Angular", "Node.js", "Express", "Django", "FastAPI", "Flask", "Spring",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Jenkins",
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Scikit-learn",
    "Data Analysis", "Pandas", "NumPy", "R", "MATLAB",
    "HTML", "CSS", "Tailwind", "GraphQL", "REST API",
    "Git", "Linux", "Agile", "Scrum", "DevOps",
    "Communication", "Leadership", "Problem Solving", "Team Work",
  ];

  const found = skillKeywords.filter(skill =>
    text.toLowerCase().includes(skill.toLowerCase())
  );
  return [...new Set(found)];
}

function computeResumeScore(skills: string[], textLength: number): number {
  const skillScore = Math.min(skills.length * 5, 50);
  const lengthScore = Math.min(textLength / 100, 30);
  const hasContactInfo = 10;
  const base = 10;
  return Math.min(Math.round(base + skillScore + lengthScore + hasContactInfo), 100);
}

function computeMissingSkills(present: string[]): string[] {
  const essentialSkills = ["Git", "SQL", "Communication", "Problem Solving", "REST API"];
  return essentialSkills.filter(s => !present.map(p => p.toLowerCase()).includes(s.toLowerCase()));
}

router.post("/resume/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  let rawText = "";
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    if (ext === ".txt") {
      rawText = await fs.readFile(req.file.path, "utf-8");
    } else if (ext === ".pdf") {
      try {
        const pdfParse = await import("pdf-parse");
        const buffer = await fs.readFile(req.file.path);
        const data = await pdfParse.default(buffer);
        rawText = data.text;
      } catch {
        rawText = `Resume file: ${req.file.originalname}`;
      }
    } else if (ext === ".docx") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ path: req.file.path });
        rawText = result.value;
      } catch {
        rawText = `Resume file: ${req.file.originalname}`;
      }
    } else {
      rawText = `Resume file: ${req.file.originalname}`;
    }
  } catch {
    rawText = `Resume file: ${req.file.originalname}`;
  }

  await fs.unlink(req.file.path).catch(() => {});

  const skills = extractSkillsFromText(rawText);
  const missingSkills = computeMissingSkills(skills);
  const score = computeResumeScore(skills, rawText.length);

  const [resume] = await db.insert(resumesTable).values({
    userId: req.user!.id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    rawText: rawText.slice(0, 5000),
    score,
    skills,
    missingSkills,
  }).returning();

  res.json({
    resume: {
      id: resume.id,
      userId: resume.userId,
      filename: resume.originalName,
      score: resume.score,
      skills: resume.skills,
      missingSkills: resume.missingSkills,
      rawText: resume.rawText,
      createdAt: resume.createdAt,
    },
    skills,
    missingSkills,
    score,
  });
});

router.get("/resume/list", requireAuth, async (req, res) => {
  const resumes = await db.select().from(resumesTable)
    .where(eq(resumesTable.userId, req.user!.id))
    .orderBy(resumesTable.createdAt);

  res.json(resumes.map(r => ({
    id: r.id,
    userId: r.userId,
    filename: r.originalName,
    score: r.score,
    skills: r.skills,
    missingSkills: r.missingSkills,
    rawText: r.rawText,
    createdAt: r.createdAt,
  })));
});

router.get("/resume/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [resume] = await db.select().from(resumesTable)
    .where(eq(resumesTable.id, id))
    .limit(1);

  if (!resume || resume.userId !== req.user!.id) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  res.json({
    id: resume.id,
    userId: resume.userId,
    filename: resume.originalName,
    score: resume.score,
    skills: resume.skills,
    missingSkills: resume.missingSkills,
    rawText: resume.rawText,
    createdAt: resume.createdAt,
  });
});

export default router;
