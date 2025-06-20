import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { siteConfig } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "aiTyaari – Best Interview Prep & Study Platform",
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
  openGraph: {
    title: "aiTyaari – Best Interview Prep & Study Platform",
    description:
      "Crack your next tech interview with aiTyaari — the smartest AI-based interview prep app with tailored content, mock interviews, and more.",
    url: "https://aityaari.com",
    siteName: "aiTyaari",
    type: "website",
    images: [
      {
        url: "https://aityaari.com/images/logo.png",
        width: 1200,
        height: 630,
        alt: "aiTyaari – Best Interview Prep & Study Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "aiTyaari – Best Interview Prep & Study Platform",
    description:
      "Best platform for interview preparation. Smart practice tools, personalized learning paths, and expert-backed guidance.",
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
