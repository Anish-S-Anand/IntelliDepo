import { NextResponse } from "next/server";

import type { TenantProfile } from "@/types/macropulse";
import { upsertTenantProfileInStore } from "@/lib/macropulse/tenantStore";

export async function POST(request: Request) {
  try {
    const profile = (await request.json()) as TenantProfile;
    const saved = await upsertTenantProfileInStore(profile);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save tenant profile.";
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
