
import { Router } from "express";
import multer from "multer";

import {
  db,
  bulkUploadsTable,
} from "@workspace/db";

import {
  eq,
  desc,
} from "drizzle-orm";

import { requireAuth } from "../middlewares/auth";

import {
  linearRegressionPredict,
  logisticRegressionPredict,
  svmPredict,
} from "../lib/ml";

const router = Router();

/* =======================================================
   MULTER CONFIG
======================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === "text/csv" ||
      file.mimetype ===
        "application/vnd.ms-excel" ||
      file.originalname
        .toLowerCase()
        .endsWith(".csv");

    if (isCsv) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only CSV files are allowed"
        )
      );
    }
  },
});

/* =======================================================
   TYPES
======================================================= */

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

/* =======================================================
   CSV PARSER
======================================================= */

function parseCsv(
  text: string
): Record<string, string>[] {
  try {
    const lines = text
      .trim()
      .split(/\r?\n/);

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

    const rows: Record<
      string,
      string
    >[] = [];

    for (
      let i = 1;
      i < lines.length;
      i++
    ) {
      const line = lines[i].trim();

      if (!line) continue;

      const values = line
        .split(",")
        .map((v) =>
          v
            .trim()
            .replace(/^"|"$/g, "")
        );

      const row: Record<
        string,
        string
      > = {};

      headers.forEach(
        (header, index) => {
          row[header] =
            values[index] ?? "";
        }
      );

      rows.push(row);
    }

    return rows;
  } catch (error) {
    console.error(
      "CSV PARSE ERROR:",
      error
    );

    return [];
  }
}

/* =======================================================
   HELPERS
======================================================= */

function resolveField(
  row: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const normalized = key
      .toLowerCase()
      .replace(/\s+/g, "");

    const value = row[normalized];

    if (
      value !== undefined &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
}

function resolveScore(
  row: Record<string, string>,
  ...keys: string[]
): number {
  const raw = resolveField(
    row,
    ...keys
  );

  const num = parseFloat(raw);

  if (isNaN(num)) {
    return 50;
  }

  return Math.max(
    0,
    Math.min(100, num)
  );
}

/* =======================================================
   BULK UPLOAD
======================================================= */

router.post(
  "/bulk/upload",

  requireAuth,

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      (err: any) => {
        if (err) {
          console.error(
            "UPLOAD ERROR:"
          );

          console.error(err);

          return res
            .status(400)
            .json({
              error:
                err.message ||
                "Upload failed",
            });
        }

        next();
      }
    );
  },

  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            error:
              "No CSV file uploaded",
          });
      }

      const text =
        req.file.buffer.toString(
          "utf-8"
        );

      const rows = parseCsv(text);

      if (rows.length === 0) {
        return res
          .status(400)
          .json({
            error:
              "CSV file is empty",
          });
      }

      if (rows.length > 1000) {
        return res
          .status(400)
          .json({
            error:
              "Maximum 1000 students allowed",
          });
      }

      const results: StudentResult[] =
        rows.map((row) => {
          const communicationScore =
            resolveScore(
              row,
              "communicationscore",
              "communication",
              "comm"
            );

          const codingScore =
            resolveScore(
              row,
              "codingscore",
              "coding",
              "code"
            );

          const aptitudeScore =
            resolveScore(
              row,
              "aptitudescore",
              "aptitude",
              "apt"
            );

          const performancePrediction =
            linearRegressionPredict(
              communicationScore,
              codingScore,
              aptitudeScore
            );

          const {
            probability,
            eligible,
          } =
            logisticRegressionPredict(
              communicationScore,
              codingScore,
              aptitudeScore
            );

          const {
            recommendedDomain,
            confidence,
          } = svmPredict(
            communicationScore,
            codingScore,
            aptitudeScore
          );

          return {
            name:
              resolveField(
                row,
                "name",
                "studentname"
              ) || "Unknown",

            email: resolveField(
              row,
              "email"
            ),

            rollNumber:
              resolveField(
                row,
                "rollnumber",
                "rollno"
              ),

            department:
              resolveField(
                row,
                "department",
                "dept"
              ),

            communicationScore,

            codingScore,

            aptitudeScore,

            performancePrediction,

            placementProbability:
              Math.round(
                probability * 1000
              ) / 10,

            placementEligibility:
              eligible,

            recommendedDomain,

            domainConfidence:
              confidence,
          };
        });

      const eligibleCount =
        results.filter(
          (r) =>
            r.placementEligibility
        ).length;

      const [saved] = await db
        .insert(bulkUploadsTable)
        .values({
          userId: req.user!.id,

          filename:
            req.file.originalname,

          studentCount:
            results.length,

          eligibleCount,

          results:
            JSON.stringify(results),
        })
        .returning();

      return res.json({
        success: true,

        id: saved.id,

        filename: saved.filename,

        studentCount:
          results.length,

        eligibleCount,

        notEligibleCount:
          results.length -
          eligibleCount,

        eligibilityRate:
          results.length > 0
            ? Math.round(
                (eligibleCount /
                  results.length) *
                  1000
              ) / 10
            : 0,

        results,

        createdAt:
          saved.createdAt,
      });
    } catch (error: any) {
      console.error(
        "BULK ERROR:"
      );

      console.error(error);

      return res
        .status(500)
        .json({
          error:
            error?.message ||
            "Bulk upload failed",
        });
    }
  }
);

/* =======================================================
   BULK HISTORY
======================================================= */

router.get(
  "/bulk/history",
  requireAuth,
  async (req, res) => {
    try {
      const uploads = await db
        .select({
          id: bulkUploadsTable.id,

          filename:
            bulkUploadsTable.filename,

          studentCount:
            bulkUploadsTable.studentCount,

          eligibleCount:
            bulkUploadsTable.eligibleCount,

          createdAt:
            bulkUploadsTable.createdAt,
        })
        .from(bulkUploadsTable)
        .where(
          eq(
            bulkUploadsTable.userId,
            req.user!.id
          )
        )
        .orderBy(
          desc(
            bulkUploadsTable.createdAt
          )
        );

      return res.json(
        uploads.map((u) => ({
          id: u.id,

          filename: u.filename,

          studentCount:
            u.studentCount,

          eligibleCount:
            u.eligibleCount,

          notEligibleCount:
            u.studentCount -
            u.eligibleCount,

          eligibilityRate:
            u.studentCount > 0
              ? Math.round(
                  (u.eligibleCount /
                    u.studentCount) *
                    1000
                ) / 10
              : 0,

          createdAt:
            u.createdAt,
        }))
      );
    } catch (error: any) {
      console.error(
        "HISTORY ERROR:"
      );

      console.error(error);

      return res
        .status(500)
        .json({
          error:
            error?.message ||
            "Failed to fetch history",
        });
    }
  }
);

/* =======================================================
   GET SINGLE BULK RESULT
======================================================= */

router.get(
  "/bulk/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      if (
        !id ||
        isNaN(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid upload ID",
          });
      }

      const [upload] = await db
        .select()
        .from(bulkUploadsTable)
        .where(
          eq(
            bulkUploadsTable.id,
            id
          )
        )
        .limit(1);

      if (!upload) {
        return res
          .status(404)
          .json({
            error:
              "Upload not found",
          });
      }

      if (
        upload.userId !==
        req.user!.id
      ) {
        return res
          .status(403)
          .json({
            error:
              "Unauthorized access",
          });
      }

      let results: StudentResult[] =
        [];

      try {
        results = JSON.parse(
          upload.results || "[]"
        );
      } catch (jsonError) {
        console.error(
          "JSON PARSE ERROR:",
          jsonError
        );

        results = [];
      }

      return res.json({
        success: true,

        id: upload.id,

        filename: upload.filename,

        studentCount:
          upload.studentCount,

        eligibleCount:
          upload.eligibleCount,

        notEligibleCount:
          upload.studentCount -
          upload.eligibleCount,

        eligibilityRate:
          upload.studentCount >
          0
            ? Math.round(
                (upload.eligibleCount /
                  upload.studentCount) *
                  1000
              ) / 10
            : 0,

        results,

        createdAt:
          upload.createdAt,
      });
    } catch (error: any) {
      console.error(
        "GET BULK ERROR:"
      );

      console.error(error);

      return res
        .status(500)
        .json({
          error:
            error?.message ||
            "Failed to fetch bulk upload",
        });
    }
  }
);

export default router;