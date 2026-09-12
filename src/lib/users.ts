import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const SALT_ROUNDS = 12;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("ユーザー名またはパスワードが違います。");
    this.name = "InvalidCredentialsError";
  }
}

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`ユーザー名「${username}」は既に使われています。`);
    this.name = "UsernameTakenError";
  }
}

export function userCount() {
  return prisma.user.count();
}

export function listUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Creates a user with a hashed password. Used both by /setup (first
 *  account, no auth required) and the /users management page (by an
 *  already-logged-in user). */
export async function createUser(username: string, password: string) {
  const trimmed = username.trim();
  if (!trimmed) throw new Error("ユーザー名を入力してください。");
  if (password.length < 8) {
    throw new Error("パスワードは8文字以上で設定してください。");
  }

  const existing = await prisma.user.findUnique({ where: { username: trimmed } });
  if (existing) throw new UsernameTakenError(trimmed);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.create({
    data: { username: trimmed, passwordHash },
    select: { id: true, username: true, createdAt: true },
  });
}

/** Verifies a login attempt and returns the matching user's id, or throws
 *  InvalidCredentialsError. Deliberately doesn't distinguish "no such
 *  user" from "wrong password" in the message, to avoid username
 *  enumeration. */
export async function verifyLogin(username: string, password: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user) throw new InvalidCredentialsError();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  return user.id;
}

/** Deletes a user (and, via cascade, all of their watchlist items,
 *  holdings, and analysis snapshots). Callers must independently check
 *  that this isn't the caller's own account before calling this — see
 *  DELETE /api/users/[id]. */
export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
