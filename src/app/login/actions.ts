"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password");
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return { error: "サーバー側でAPP_PASSWORDが設定されていません。" };
  }

  if (typeof password !== "string" || password !== appPassword) {
    return { error: "パスワードが違います。" };
  }

  await createSession();
  redirect("/");
}
