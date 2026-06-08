import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { NavigationEvents } from "@/components/layout/NavigationEvents";

// Configure Inter font with Next.js font optimization
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "IntelliDepot — Fidelis Platform",
  description: "Smart warehouse operations platform by Fidelis",
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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Prevent flash of wrong theme (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('intelli-theme');
                  var theme = stored === 'light' ? 'light' : 'dark';
                  var root = document.documentElement;
                  if (theme === 'dark') {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.setAttribute('data-theme', 'dark');
                  } else {
                    root.classList.remove('dark');
                    root.classList.add('light');
                    root.setAttribute('data-theme', 'light');
                  }
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <LoadingProvider>
            <NavigationEvents />
            {children}
            <LoadingIndicator />
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
