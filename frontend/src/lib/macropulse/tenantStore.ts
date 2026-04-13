import type { SensitivityMatrix, TenantProfile } from "@/types/macropulse";

const tenantStore = new Map<string, TenantProfile>();

function nowIso(): string {
  return new Date().toISOString();
}

function cloneProfile(profile: TenantProfile): TenantProfile {
  return JSON.parse(JSON.stringify(profile)) as TenantProfile;
}

export async function getTenantProfileFromStore(tenantId: string): Promise<TenantProfile | null> {
  const profile = tenantStore.get(tenantId);
  return profile ? cloneProfile(profile) : null;
}

export async function upsertTenantProfileInStore(profile: TenantProfile): Promise<TenantProfile> {
  const timestamp = nowIso();
  const existing = tenantStore.get(profile.tenant_id);

  const saved: TenantProfile = {
    ...cloneProfile(profile),
    created_at: existing?.created_at ?? profile.created_at ?? timestamp,
    updated_at: timestamp,
  };

  tenantStore.set(saved.tenant_id, saved);
  return cloneProfile(saved);
}

export async function updateTenantProfileInStore(
  tenantId: string,
  profile: TenantProfile,
): Promise<TenantProfile | null> {
  if (!tenantStore.has(tenantId)) {
    return null;
  }
  return upsertTenantProfileInStore({ ...profile, tenant_id: tenantId });
}

export async function deleteTenantProfileFromStore(tenantId: string): Promise<boolean> {
  return tenantStore.delete(tenantId);
}

export function calculateTenantSensitivity(profile: TenantProfile): SensitivityMatrix {
  const debtSensitivity = (
    profile.debt.total_loan_amount_cr *
    (profile.debt.floating_proportion_pct / 100) *
    0.01
  );

  const fxSensitivity =
    (Math.abs(profile.fx.net_usd_exposure_m) +
      Math.abs(profile.fx.net_aed_exposure_m) +
      Math.abs(profile.fx.net_sar_exposure_m)) *
    (1 - profile.fx.hedge_ratio_pct / 100) *
    0.09;

  const cogsSensitivity =
    profile.cogs.total_cogs_cr *
    ((profile.cogs.steel_pct + profile.cogs.petroleum_pct + profile.cogs.freight_pct) / 100) *
    0.015;

  const mtmSensitivity =
    profile.portfolio.gsec_holdings_cr * profile.portfolio.modified_duration * 0.008;

  return {
    interest_rate_100bps: {
      impact_cr: round2(debtSensitivity),
      label: "Rate shock (+100 bps)",
    },
    fx_5pct_move: {
      impact_cr: round2(fxSensitivity),
      label: "FX move (5%)",
    },
    commodity_3pct_move: {
      impact_cr: round2(cogsSensitivity),
      label: "Commodity move (3%)",
    },
    gsec_50bps_move: {
      impact_cr: round2(mtmSensitivity),
      label: "G-Sec yield move (+50 bps)",
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
