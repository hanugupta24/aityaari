import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import ClientLayout from "./ClientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "aiTyaari – Best AI-Powered Interview Preparation Platform",
  description:
    "aiTyaari is your learning partner to crack professional interviews with smart study material, personalized guidance, and practice tools. Start your AI prep journey today!",
  keywords: [
    "Interview preparation",
    "best AI learning platform",
    "online interview prep tool",
    "free AI study material",
    "AI mock interviews",
    "AI EdTech platform India",
    "learn machine learning for interviews",
    "personalized interview preparation",
    "top EdTech startups",
    "AI-powered coding practice",
    "interview questions with analysis",
    "machine learning interview questions",
    "online AI tutor app",
    "practice AI questions online",
    "interactive AI study app",
    "AI learning assistant",
    "best app for AI interview preparation",
    "next generation learning platform",
    "smart learning for AI jobs",
    "crack interviews using AI tools",
  ],
  authors: [{ name: "Hanu Gupta", url: "https://aityaari.com" }],
  creator: "aiTyaari Team",
  applicationName: "aiTyaari",
  themeColor: "#0f172a",
  colorScheme: "light",
  openGraph: {
    title: "aiTyaari – Crack Interviews with AI",
    description:
      "Crack your next tech interview with aiTyaari — the smartest AI-based interview prep app with tailored content, mock interviews, and more.",
    url: "https://aityaari.com",
    siteName: "aiTyaari",
    type: "website",
    images: [
      {
        url: "https://aityaari.com/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "aiTyaari – Crack Interviews with AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "aiTyaari – Crack Interviews with AI",
    description:
      "Best AI-powered platform for interview preparation. Smart practice tools, personalized learning paths, and expert-backed guidance.",
    site: "@aityaari",
    creator: "@aityaari",
    images: ["https://aityaari.com/twitter-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#0f172a",
      },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "aiTyaari",
    capable: true,
    statusBarStyle: "black-translucent",
  },
  category: "education",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
