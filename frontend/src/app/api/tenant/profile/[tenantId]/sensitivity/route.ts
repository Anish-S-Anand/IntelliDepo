import { NextResponse } from "next/server";

import {
  calculateTenantSensitivity,
  getTenantProfileFromStore,
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

  return NextResponse.json(calculateTenantSensitivity(profile));
}
