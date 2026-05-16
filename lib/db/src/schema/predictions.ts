import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  resumeId: integer("resume_id").notNull(),
  resumeScore: real("resume_score").notNull(),
  placementEligibility: boolean("placement_eligibility").notNull().default(false),
  placementProbability: real("placement_probability"),
  careerDomain: text("career_domain").notNull(),
  clusterGroup: text("cluster_group"),
  performancePrediction: real("performance_prediction"),
  skillGaps: text("skill_gaps").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;

export const mlAnalysisTable = pgTable("ml_analysis", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  communicationScore: real("communication_score").notNull(),
  codingScore: real("coding_score").notNull(),
  aptitudeScore: real("aptitude_score").notNull(),
  performancePrediction: real("performance_prediction").notNull(),
  placementProbability: real("placement_probability").notNull(),
  placementEligibility: boolean("placement_eligibility").notNull().default(false),
  recommendedDomain: text("recommended_domain").notNull(),
  domainConfidence: real("domain_confidence").notNull(),
  allDomainScores: text("all_domain_scores").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMlAnalysisSchema = createInsertSchema(mlAnalysisTable).omit({ id: true, createdAt: true });
export type InsertMlAnalysis = z.infer<typeof insertMlAnalysisSchema>;
export type MlAnalysis = typeof mlAnalysisTable.$inferSelect;
