export type DemoRole = "warehouse_manager" | "regional_manager" | "admin";

export interface DemoCredential {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: DemoRole;
  location?: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    id: "wh-blr",
    email: "wm.blr@fidelis-demo.com",
    password: "MacroPulse2025!",
    fullName: "Warehouse Manager - Bengaluru",
    role: "warehouse_manager",
    location: "Bengaluru",
  },
  {
    id: "wh-hyd",
    email: "wm.hyd@fidelis-demo.com",
    password: "MacroPulse2025!",
    fullName: "Warehouse Manager - Hyderabad",
    role: "warehouse_manager",
    location: "Hyderabad",
  },
  {
    id: "wh-mum",
    email: "wm.mum@fidelis-demo.com",
    password: "MacroPulse2025!",
    fullName: "Warehouse Manager - Mumbai",
    role: "warehouse_manager",
    location: "Mumbai",
  },
  {
    id: "regional-india",
    email: "regional@fidelis-demo.com",
    password: "MacroPulse2025!",
    fullName: "Regional Manager - India",
    role: "regional_manager",
    location: "India",
  },
  {
    id: "admin-platform",
    email: "admin@fidelis-demo.com",
    password: "MacroPulse2025!",
    fullName: "Platform Admin",
    role: "admin",
  },
];

export function getDemoCredential(email: string, password: string): DemoCredential | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  return DEMO_CREDENTIALS.find(
    (credential) => credential.email.toLowerCase() === normalizedEmail && credential.password === password
  );
}
