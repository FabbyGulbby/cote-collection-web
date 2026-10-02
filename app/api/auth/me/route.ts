import { NextResponse } from "next/server";
import {
  authenticatedRpc,
  getAuthenticatedSession,
} from "../../../../lib/supabase-auth";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const profile = await authenticatedRpc<any>(
    "cote_current_profile_v1",
    {},
    session.accessToken
  );

  if (!profile.ok) {
    return NextResponse.json(
      { error: profile.error || "Profil indisponible." },
      { status: profile.status || 500 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    profile: profile.data,
  });
}
