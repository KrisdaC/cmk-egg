import { Router } from "express";
import { db } from "../db";
import { users } from "../db/schema/users";
import { hashPassword, verifyPassword } from "./password";

export const authRouter = Router();

console.log("AUTH ROUTER LOADED");

// server/auth/routes.ts
authRouter.post("/login", async (req, res) => {
  console.log("🔥 AUTH LOGIN ROUTE HIT");

  const { email, password } = req.body;
  console.log("📧 Email from request:", email);
  console.log("🔑 Password length:", password?.length);

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email.toLowerCase()),
  });

  console.log("👤 User from DB:", user);

  if (!user) {
    console.log("❌ User not found");
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!user.password_hash) {
    console.log("❌ password_hash is NULL");
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await verifyPassword(password, user.password_hash);
  console.log("🔐 Password valid?", valid);

  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.userId = user.id;

  return res.json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

/**
 * POST /api/auth/register
 * Creates a user WITH password
 */
authRouter.post("/register", async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  const passwordHash = await hashPassword(password);

  try {
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        first_name,
        last_name,
        password_hash: passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
      });

    req.session.userId = user.id;

    return res.json(user);
  } catch (err: any) {
    // IMPORTANT: only treat unique email violations as "email already exists"
    // Postgres unique_violation error code = 23505
    if (err?.code === "23505") {
      return res.status(400).json({ message: "Email already exists" });
    }

    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

authRouter.get("/me", async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, req.session.userId),
    columns: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
    },
  });

  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  return res.json(user);
});
