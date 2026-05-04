import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INTELLI",
  description: "A Fidelis Platform",
  icons: {
    icon: "/fidelis-logo.png",
    shortcut: "/fidelis-logo.png",
    apple: "/fidelis-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
