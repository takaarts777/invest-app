"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { createUser, userCount } from "@/lib/users";

export type SetupState = { error?: string } | undefined;

export async function createFirstUser(
  _prevState: SetupState,
  formData: FormData
): Promise<SetupState> {
  // Re-check server-side even though the page already gated on this —
  // a direct POST after another tab already completed setup shouldn't
  // silently create a second unprotected account.
  if ((await userCount()) > 0) {
    return { error: "既にアカウントが作成されています。ログインページからお進みください。" };
  }

  const username = formData.get("username");
  const password = formData.get("password");
  const passwordConfirm = formData.get("passwordConfirm");

  if (typeof username !== "string" || !username.trim()) {
    return { error: "ユーザー名を入力してください。" };
  }
  if (typeof password !== "string" || typeof passwordConfirm !== "string") {
    return { error: "パスワードを入力してください。" };
  }
  if (password !== passwordConfirm) {
    return { error: "パスワードが一致しません。" };
  }

  try {
    const user = await createUser(username, password);
    await createSession(user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "作成に失敗しました。" };
  }

  redirect("/");
}
