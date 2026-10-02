import { NextRequest, NextResponse } from "next/server";
import { signUpWithPassword } from "../../../../lib/supabase-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!email || !password || !displayName) {
    return NextResponse.json(
      { error: "Nom, email et mot de passe requis." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const result = await signUpWithPassword(email, password, displayName);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({
    ok: true,
    signedIn: result.signedIn,
    needsEmailConfirmation: !result.signedIn,
  });
}
