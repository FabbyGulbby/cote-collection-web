import { NextRequest, NextResponse } from "next/server";
import { parseMyGameDbCsv } from "../../../lib/csv";
import {
  authenticatedRpc,
  getAuthenticatedSession,
} from "../../../lib/supabase-auth";

export const runtime = "nodejs";

async function activeSession() {
  const session = await getAuthenticatedSession();
  if (!session) return { error: "not_authenticated" as const, status: 401 };

  const profile = await authenticatedRpc<any>(
    "cote_current_profile_v1",
    {},
    session.accessToken
  );

  if (!profile.ok) {
    return { error: profile.error || "profile_error", status: profile.status || 500 };
  }

  if (!profile.data?.isActive) {
    return { error: "account_not_active" as const, status: 403 };
  }

  return { session, profile: profile.data };
}

export async function GET() {
  const auth = await activeSession();
  if (!("session" in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await authenticatedRpc<any>(
    "cote_collection_status_v1",
    {},
    auth.session.accessToken
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }

  return NextResponse.json({ collection: result.data });
}

export async function POST(request: NextRequest) {
  const auth = await activeSession();
  if (!("session" in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier CSV requis." }, { status: 400 });
  }

  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Le CSV est trop volumineux." }, { status: 400 });
  }

  try {
    const text = await file.text();
    const items = parseMyGameDbCsv(text);

    const result = await authenticatedRpc<any>(
      "cote_replace_collection_v1",
      {
        p_filename: file.name,
        p_items: items,
      },
      auth.session.accessToken
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ ok: true, collection: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import CSV impossible." },
      { status: 400 }
    );
  }
}
