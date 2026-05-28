import { Router } from "express";
import multer from "multer";
import { db, bulkUploadsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  linearRegressionPredict,
  logisticRegressionPredict,
  svmPredict,
} from "../lib/ml";

const router = Router();

/* ======================================================
   MULTER
====================================================== */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/* ======================================================
   TYPES
====================================================== */

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

/* ======================================================
   CSV PARSER
====================================================== */

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) =>
      h
        .trim()
        .replace(/^"|"$/g, "")
        .toLowerCase()
        .replace(/\s+/g, "")
    );

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) continue;

    const values = line.split(",").map((v) =>
      v.trim().replace(/^"|"$/g, "")
    );

    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

/* ======================================================
   HELPERS
====================================================== */

function resolveField(
  row: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/\s+/g, "");

    if (row[normalized]) {
      return row[normalized];
    }
  }

  return "";
}

function resolveScore(
  row: Record<string, string>,
  ...keys: string[]
): number {
  const value = resolveField(row, ...keys);

  const parsed = parseFloat(value);

  if (isNaN(parsed)) {
    return 50;
  }

  return Math.max(0, Math.min(100, parsed));
}

/* ======================================================
   BULK UPLOAD
====================================================== */

router.post(
  "/bulk/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      console.log("FILE RECEIVED:", req.file);

      if (!req.file) {
        return res.status(400).json({
          error: "No CSV file uploaded",
        });
      }

      const text = req.file.buffer.toString("utf-8");

      const rows = parseCsv(text);

      console.log("ROWS:", rows.length);

      if (rows.length === 0) {
        return res.status(400).json({
          error: "CSV is empty",
        });
      }

      const results: StudentResult[] = rows.map((row) => {
        const communicationScore = resolveScore(
          row,
          "communication",
          "communicationscore"
        );

        const codingScore = resolveScore(
          row,
          "coding",
          "codingscore"
        );

        const aptitudeScore = resolveScore(
          row,
          "aptitude",
          "aptitudescore"
        );

        const performancePrediction =
          linearRegressionPredict(
            communicationScore,
            codingScore,
            aptitudeScore
          );

        const logistic =
          logisticRegressionPredict(
            communicationScore,
            codingScore,
            aptitudeScore
          );

        const svm =
          svmPredict(
            communicationScore,
            codingScore,
            aptitudeScore
          );

        return {
          name:
            resolveField(row, "name") || "Unknown",

          email:
            resolveField(row, "email"),

          rollNumber:
            resolveField(
              row,
              "rollnumber",
              "rollno"
            ),

          department:
            resolveField(row, "department"),

          communicationScore,
          codingScore,
          aptitudeScore,

          performancePrediction,

          placementProbability:
            Math.round(logistic.probability * 100),

          placementEligibility:
            logistic.eligible,

          recommendedDomain:
            svm.recommendedDomain,

          domainConfidence:
            svm.confidence,
        };
      });

      const eligibleCount = results.filter(
        (r) => r.placementEligibility
      ).length;

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

      return res.json({
        success: true,
        id: saved.id,
        filename: saved.filename,
        studentCount: results.length,
        eligibleCount,
        notEligibleCount:
          results.length - eligibleCount,
        results,
      });
    } catch (error: any) {
      console.error("BULK ERROR:");
      console.error(error);

      return res.status(500).json({
        error: "Bulk upload failed",
        details: error.message,
      });
    }
  }
);

/* ======================================================
   HISTORY
====================================================== */

router.get(
  "/bulk/history",
  requireAuth,
  async (req, res) => {
    try {
      const uploads = await db
        .select()
        .from(bulkUploadsTable)
        .where(
          eq(
            bulkUploadsTable.userId,
            req.user!.id
          )
        )
        .orderBy(desc(bulkUploadsTable.createdAt));

      return res.json(uploads);
    } catch (error: any) {
      console.error(error);

      return res.status(500).json({
        error: "Failed to fetch history",
      });
    }
  }
);

/* ======================================================
   SINGLE BULK RESULT
====================================================== */

router.get(
  "/bulk/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          error: "Invalid ID",
        });
      }

      const [upload] = await db
        .select()
        .from(bulkUploadsTable)
        .where(eq(bulkUploadsTable.id, id))
        .limit(1);

      if (!upload) {
        return res.status(404).json({
          error: "Upload not found",
        });
      }

      return res.json({
        ...upload,
        results: JSON.parse(upload.results),
      });
    } catch (error: any) {
      console.error(error);

      return res.status(500).json({
        error: "Failed to fetch upload",
      });
    }
  }
);

export default router;