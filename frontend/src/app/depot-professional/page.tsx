import { redirect } from "next/navigation";

export const metadata = {
  title: "IntelliDepot Professional",
  description: "Embedded IntelliDepot professional UI inside the Next.js frontend.",
};

export default function DepotProfessionalPage() {
  redirect("/depot");
}
