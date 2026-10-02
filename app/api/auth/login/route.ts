import { NextRequest, NextResponse } from "next/server";
import { signInWithPassword } from "../../../../lib/supabase-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const result = await signInWithPassword(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 401 });
  }

  return NextResponse.json({ ok: true });
}
