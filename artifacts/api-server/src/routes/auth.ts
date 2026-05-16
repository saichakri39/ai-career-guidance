import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../middlewares/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();

  const token = signToken({ id: user.id, email: user.email });

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
  });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ id: user.id, email: user.email });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
});

router.get("/profile", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { resumesTable } = await import("@workspace/db");
  const { predictionsTable } = await import("@workspace/db");

  const resumes = await db.select({ id: resumesTable.id }).from(resumesTable).where(eq(resumesTable.userId, user.id));
  const predictions = await db.select({ id: predictionsTable.id }).from(predictionsTable).where(eq(predictionsTable.userId, user.id));

  const skills: string[] = [];
  if (resumes.length > 0) {
    const { resumesTable: rt } = await import("@workspace/db");
    const resumeData = await db.select({ skills: rt.skills }).from(rt).where(eq(rt.userId, user.id)).limit(1);
    if (resumeData.length > 0) {
      skills.push(...(resumeData[0].skills ?? []));
    }
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    targetRole: user.targetRole,
    currentRole: user.currentRole,
    skills,
    resumeCount: resumes.length,
    predictionCount: predictions.length,
    createdAt: user.createdAt,
  });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const { name, bio, targetRole, currentRole } = req.body as {
    name?: string;
    bio?: string;
    targetRole?: string;
    currentRole?: string;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (targetRole !== undefined) updates.targetRole = targetRole;
  if (currentRole !== undefined) updates.currentRole = currentRole;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.id)).returning();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    targetRole: user.targetRole,
    currentRole: user.currentRole,
    skills: [],
    resumeCount: 0,
    predictionCount: 0,
    createdAt: user.createdAt,
  });
});

export default router;
