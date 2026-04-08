import { NextResponse } from "next/server";

import type { TenantProfile } from "@/types/macropulse";
import {
  deleteTenantProfileFromStore,
  getTenantProfileFromStore,
  updateTenantProfileInStore,
} from "@/lib/macropulse/tenantStore";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const profile = await getTenantProfileFromStore(tenantId);

  if (!profile) {
    return NextResponse.json({ detail: "Tenant profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: Request, context: RouteContext) {
  const { tenantId } = await context.params;

  try {
    const profile = (await request.json()) as TenantProfile;
    const saved = await updateTenantProfileInStore(tenantId, profile);

    if (!saved) {
      return NextResponse.json({ detail: "Tenant profile not found" }, { status: 404 });
    }

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update tenant profile.";
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const deleted = await deleteTenantProfileFromStore(tenantId);

  if (!deleted) {
    return NextResponse.json({ detail: "Tenant profile not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted", tenant_id: tenantId });
}
