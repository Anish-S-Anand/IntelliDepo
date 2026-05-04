export interface SectorMultipliers {
  rate: number;
  fx: number;
  wpi: number;
  crude: number;
}

export interface SectorConfig {
  id: string;
  label: string;
  entity: string;
  multipliers: SectorMultipliers;
}

export interface CompanyGroup {
  id: string;
  name: string;
  geography: "India" | "Global";
  sectors: SectorConfig[];
}

const DEFAULT_MULTIPLIERS: SectorMultipliers = {
  rate: 1,
  fx: 1,
  wpi: 1,
  crude: 1,
};

export const COMPANY_GROUPS: CompanyGroup[] = [
  {
    id: "aditya-birla",
    name: "Aditya Birla Group",
    geography: "India",
    sectors: [
      { id: "ab-metals", label: "Metals and Mining", entity: "Hindalco", multipliers: { rate: 1.15, fx: 1.35, wpi: 1.25, crude: 1.05 } },
      { id: "ab-cement", label: "Cement", entity: "UltraTech Cement", multipliers: { rate: 1.2, fx: 1.1, wpi: 1.35, crude: 1.15 } },
      { id: "ab-chem", label: "Chemicals", entity: "Grasim Chemicals", multipliers: { rate: 1.05, fx: 1.2, wpi: 1.15, crude: 1.2 } },
    ],
  },
  {
    id: "tata",
    name: "Tata Group",
    geography: "India",
    sectors: [
      { id: "tata-steel", label: "Steel", entity: "Tata Steel", multipliers: { rate: 1.2, fx: 1.25, wpi: 1.3, crude: 1.1 } },
      { id: "tata-auto", label: "Automobile", entity: "Tata Motors", multipliers: { rate: 1.1, fx: 1.2, wpi: 1.15, crude: 1.3 } },
      { id: "tata-it", label: "IT Services", entity: "TCS", multipliers: { rate: 0.95, fx: 1.4, wpi: 0.85, crude: 0.8 } },
    ],
  },
  {
    id: "reliance",
    name: "Reliance Industries",
    geography: "India",
    sectors: [
      { id: "ril-o2c", label: "Oil to Chemicals", entity: "Reliance O2C", multipliers: { rate: 1.05, fx: 1.3, wpi: 1.05, crude: 1.5 } },
      { id: "ril-telecom", label: "Telecom", entity: "Jio", multipliers: { rate: 0.9, fx: 0.8, wpi: 0.75, crude: 0.7 } },
    ],
  },
  {
    id: "adani",
    name: "Adani Group",
    geography: "India",
    sectors: [
      { id: "adani-ports", label: "Ports and Logistics", entity: "Adani Ports", multipliers: { rate: 1.25, fx: 1.3, wpi: 1.1, crude: 1.1 } },
      { id: "adani-energy", label: "Energy", entity: "Adani Energy", multipliers: { rate: 1.15, fx: 1.0, wpi: 1.0, crude: 1.4 } },
    ],
  },
  {
    id: "mahindra",
    name: "Mahindra Group",
    geography: "India",
    sectors: [
      { id: "mah-auto", label: "Automobile", entity: "Mahindra Auto", multipliers: { rate: 1.1, fx: 1.15, wpi: 1.2, crude: 1.2 } },
      { id: "mah-farm", label: "Farm Equipment", entity: "Mahindra Farm", multipliers: { rate: 1.0, fx: 1.05, wpi: 1.25, crude: 0.95 } },
    ],
  },
  {
    id: "jsw",
    name: "JSW Group",
    geography: "India",
    sectors: [
      { id: "jsw-steel", label: "Steel", entity: "JSW Steel", multipliers: { rate: 1.2, fx: 1.25, wpi: 1.35, crude: 1.05 } },
      { id: "jsw-cement", label: "Cement", entity: "JSW Cement", multipliers: { rate: 1.15, fx: 1.05, wpi: 1.4, crude: 1.1 } },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    geography: "Global",
    sectors: [
      { id: "amz-retail", label: "E-commerce", entity: "Amazon Retail", multipliers: { rate: 0.9, fx: 1.2, wpi: 0.95, crude: 0.85 } },
      { id: "amz-cloud", label: "Cloud", entity: "AWS", multipliers: { rate: 0.85, fx: 1.0, wpi: 0.7, crude: 0.7 } },
    ],
  },
  {
    id: "apple",
    name: "Apple",
    geography: "Global",
    sectors: [
      { id: "apl-devices", label: "Consumer Devices", entity: "iPhone", multipliers: { rate: 0.85, fx: 1.25, wpi: 0.9, crude: 0.75 } },
      { id: "apl-services", label: "Digital Services", entity: "App Store", multipliers: { rate: 0.75, fx: 1.05, wpi: 0.65, crude: 0.55 } },
    ],
  },
  {
    id: "microsoft",
    name: "Microsoft",
    geography: "Global",
    sectors: [
      { id: "msft-cloud", label: "Cloud", entity: "Azure", multipliers: { rate: 0.8, fx: 1.0, wpi: 0.7, crude: 0.6 } },
      { id: "msft-productivity", label: "Productivity Software", entity: "Microsoft 365", multipliers: { rate: 0.75, fx: 1.05, wpi: 0.65, crude: 0.55 } },
    ],
  },
  {
    id: "cocacola",
    name: "Coca-Cola",
    geography: "Global",
    sectors: [
      { id: "coke-bev", label: "Beverages", entity: "Coke Beverages", multipliers: { rate: 0.95, fx: 1.15, wpi: 1.2, crude: 0.9 } },
    ],
  },
  {
    id: "samsung",
    name: "Samsung",
    geography: "Global",
    sectors: [
      { id: "ssg-mobile", label: "Mobile Devices", entity: "Galaxy", multipliers: { rate: 0.9, fx: 1.2, wpi: 0.95, crude: 0.8 } },
      { id: "ssg-semi", label: "Semiconductors", entity: "Samsung Foundry", multipliers: { rate: 1.0, fx: 1.3, wpi: 0.85, crude: 0.75 } },
    ],
  },
  {
    id: "toyota",
    name: "Toyota",
    geography: "Global",
    sectors: [
      { id: "toyota-auto", label: "Automobile", entity: "Toyota Motors", multipliers: { rate: 1.1, fx: 1.15, wpi: 1.2, crude: 1.15 } },
    ],
  },
];

const ALL_SECTORS = COMPANY_GROUPS.flatMap((company) => company.sectors);

export function getSectorById(sectorId: string): SectorConfig | undefined {
  return ALL_SECTORS.find((sector) => sector.id === sectorId);
}

export function getSectorMultipliers(sectorId: string): SectorMultipliers {
  return getSectorById(sectorId)?.multipliers ?? DEFAULT_MULTIPLIERS;
}
