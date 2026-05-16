import { Router } from "express";
import multer from "multer";
import { db, bulkUploadsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { linearRegressionPredict, logisticRegressionPredict, svmPredict } from "../lib/ml";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});

type StudentResult = {
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  communicationScore: number;
  codingScore: number;
  aptitudeScore: number;
  performancePrediction: number;
  placementProbability: number;
  placementEligibility: boolean;
  recommendedDomain: string;
  domainConfidence: number;
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, ""));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function resolveField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k.toLowerCase().replace(/\s+/g, "")];
    if (val !== undefined && val !== "") return val;
  }
  return "";
}

function resolveScore(row: Record<string, string>, ...keys: string[]): number {
  const raw = resolveField(row, ...keys);
  const n = parseFloat(raw);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

router.post("/bulk/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No CSV file provided. Use field name 'file'." });
    return;
  }

  const text = req.file.buffer.toString("utf-8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    res.status(400).json({ error: "CSV file is empty or has no data rows." });
    return;
  }

  if (rows.length > 1000) {
    res.status(400).json({ error: "CSV exceeds maximum of 1000 students per upload." });
    return;
  }

  const results: StudentResult[] = rows.map((row) => {
    const commScore = resolveScore(row, "communicationscore", "communication", "comm", "communication_score");
    const codingScore = resolveScore(row, "codingscore", "coding", "code", "coding_score");
    const aptScore = resolveScore(row, "aptitudescore", "aptitude", "apt", "aptitude_score");

    const performance = linearRegressionPredict(commScore, codingScore, aptScore);
    const { probability, eligible } = logisticRegressionPredict(commScore, codingScore, aptScore);
    const { recommendedDomain, confidence } = svmPredict(commScore, codingScore, aptScore);

    return {
      name: resolveField(row, "name", "studentname", "student_name", "student name") || "Unknown",
      email: resolveField(row, "email", "emailid", "email_id"),
      rollNumber: resolveField(row, "rollnumber", "roll_number", "roll number", "roll", "rollno", "roll_no"),
      department: resolveField(row, "department", "dept", "branch"),
      communicationScore: commScore,
      codingScore,
      aptitudeScore: aptScore,
      performancePrediction: performance,
      placementProbability: Math.round(probability * 1000) / 10,
      placementEligibility: eligible,
      recommendedDomain,
      domainConfidence: confidence,
    };
  });

  const eligibleCount = results.filter((r) => r.placementEligibility).length;

  const [saved] = await db
    .insert(bulkUploadsTable)
    .values({
      userId: req.user!.id,
      filename: req.file.originalname,
      studentCount: results.length,
      eligibleCount,
      results: JSON.stringify(results),
    })
    .returning();

  res.json({
    id: saved.id,
    filename: saved.filename,
    studentCount: results.length,
    eligibleCount,
    notEligibleCount: results.length - eligibleCount,
    eligibilityRate:
      results.length > 0 ? Math.round((eligibleCount / results.length) * 1000) / 10 : 0,
    results,
    createdAt: saved.createdAt,
  });
});

router.get("/bulk/history", requireAuth, async (req, res) => {
  const uploads = await db
    .select({
      id: bulkUploadsTable.id,
      filename: bulkUploadsTable.filename,
      studentCount: bulkUploadsTable.studentCount,
      eligibleCount: bulkUploadsTable.eligibleCount,
      createdAt: bulkUploadsTable.createdAt,
    })
    .from(bulkUploadsTable)
    .where(eq(bulkUploadsTable.userId, req.user!.id))
    .orderBy(desc(bulkUploadsTable.createdAt));

  res.json(
    uploads.map((u) => ({
      id: u.id,
      filename: u.filename,
      studentCount: u.studentCount,
      eligibleCount: u.eligibleCount,
      notEligibleCount: u.studentCount - u.eligibleCount,
      eligibilityRate:
        u.studentCount > 0
          ? Math.round((u.eligibleCount / u.studentCount) * 1000) / 10
          : 0,
      createdAt: u.createdAt,
    }))
  );
});

router.get("/bulk/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [upload] = await db
    .select()
    .from(bulkUploadsTable)
    .where(eq(bulkUploadsTable.id, id))
    .limit(1);

  if (!upload || upload.userId !== req.user!.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const results = JSON.parse(upload.results) as StudentResult[];

  res.json({
    id: upload.id,
    filename: upload.filename,
    studentCount: upload.studentCount,
    eligibleCount: upload.eligibleCount,
    notEligibleCount: upload.studentCount - upload.eligibleCount,
    eligibilityRate:
      upload.studentCount > 0
        ? Math.round((upload.eligibleCount / upload.studentCount) * 1000) / 10
        : 0,
    results,
    createdAt: upload.createdAt,
  });
});

export default router;
