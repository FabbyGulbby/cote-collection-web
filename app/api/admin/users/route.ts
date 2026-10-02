import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedRpc,
  getAuthenticatedSession,
} from "../../../../lib/supabase-auth";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const result = await authenticatedRpc<any[]>(
    "cote_admin_list_users_v1",
    {},
    session.accessToken
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 403 });
  }

  return NextResponse.json({ users: result.data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const isActive = Boolean(body.isActive);
  const role = body.role === "admin" ? "admin" : "user";

  if (!userId) {
    return NextResponse.json({ error: "Utilisateur requis." }, { status: 400 });
  }

  const result = await authenticatedRpc<any>(
    "cote_admin_set_user_v1",
    {
      p_user_id: userId,
      p_active: isActive,
      p_role: role,
    },
    session.accessToken
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 403 });
  }

  return NextResponse.json({ ok: true });
}
