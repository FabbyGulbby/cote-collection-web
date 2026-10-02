import { NextResponse } from "next/server";
import { clearSessionCookies } from "../../../../lib/supabase-auth";

export async function POST() {
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
