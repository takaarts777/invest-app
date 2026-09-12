"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { verifyLogin, InvalidCredentialsError } from "@/lib/users";

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return { error: "ユーザー名とパスワードを入力してください。" };
  }

  try {
    const userId = await verifyLogin(username, password);
    await createSession(userId);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return { error: error.message };
    }
    return { error: "ログインに失敗しました。" };
  }

  redirect("/");
}
