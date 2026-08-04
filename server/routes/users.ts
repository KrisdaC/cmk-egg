import { Router } from "express";
import { db } from "../db";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";

const router = Router();

// List all users
router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.first_name,
      lastName: users.last_name,
      createdAt: users.created_at,
    })
    .from(users)
    .orderBy(users.created_at);
  return res.json(rows);
});

// Create user (admin-initiated, sets a password)
router.post("/", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });
  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters" });

  const passwordHash = await hashPassword(password);
  try {
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), first_name: firstName || null, last_name: lastName || null, password_hash: passwordHash })
      .returning({ id: users.id, email: users.email, firstName: users.first_name, lastName: users.last_name });
    return res.json(user);
  } catch (err: any) {
    if (err?.code === "23505")
      return res.status(400).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user (name / email only — not password)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { email, firstName, lastName } = req.body;
  const updates: Record<string, any> = {};
  if (email !== undefined) updates.email = email.toLowerCase();
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (!Object.keys(updates).length)
    return res.status(400).json({ message: "Nothing to update" });

  try {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, firstName: users.first_name, lastName: users.last_name });
    return res.json(user);
  } catch (err: any) {
    if (err?.code === "23505")
      return res.status(400).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Failed to update user" });
  }
});

// Reset password
router.patch("/:id/password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, id));
  return res.json({ ok: true });
});

// Delete user
router.delete("/:id", async (req, res) => {
  await db.delete(users).where(eq(users.id, req.params.id));
  return res.json({ ok: true });
});

export default router;
