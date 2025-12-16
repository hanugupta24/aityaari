"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Home,
  LogIn,
  UserPlus,
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  History,
  User,
  BookOpen,
  CreditCard,
  Settings,
  HelpCircle,
  FileText,
  Mail,
  ShieldCheck,
  FileCheck,
} from "lucide-react";

export default function SitemapPage() {
  const sitemapSections = [
    {
      title: "Public Pages",
      icon: Home,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      links: [
        { name: "Home", href: "/", icon: Home, description: "Landing page" },
        { name: "Login", href: "/login", icon: LogIn, description: "User login" },
        { name: "Sign Up", href: "/signup", icon: UserPlus, description: "Create account" },
        { name: "Sitemap", href: "/sitemap-page", icon: FileText, description: "This page" },
      ],
    },
    {
      title: "Dashboard & Tools",
      icon: LayoutDashboard,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      links: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Main dashboard" },
        { name: "Start Interview", href: "/interview/start", icon: MessageSquare, description: "Begin interview session" },
        { name: "Interview Session", href: "/interview/start", icon: MessageSquare, description: "Active interview (dynamic route)", isDynamic: true },
        { name: "Interview History", href: "/history", icon: History, description: "Past interviews" },
        { name: "Performance", href: "/performance", icon: BarChart3, description: "Analytics & stats" },
        { name: "Feedback", href: "/history", icon: FileCheck, description: "Interview feedback (dynamic route)", isDynamic: true },
      ],
    },
    {
      title: "Learning & Resources",
      icon: BookOpen,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      links: [
        { name: "Study Materials", href: "/studyMaterials", icon: BookOpen, description: "Learning resources" },
        { name: "Study Material Details", href: "/studyMaterials", icon: FileText, description: "View material (dynamic route)", isDynamic: true },
        { name: "Upload Materials", href: "/studyMaterials/upload", icon: FileText, description: "Admin only" },
      ],
    },
    {
      title: "Account & Settings",
      icon: User,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      links: [
        { name: "Profile", href: "/profile", icon: User, description: "User profile" },
        { name: "Subscription", href: "/subscription", icon: CreditCard, description: "Manage subscription" },
      ],
    },
    {
      title: "Support & Admin",
      icon: HelpCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      links: [
        { name: "Customer Support", href: "/customerSupport", icon: Mail, description: "Contact support" },
        { name: "Query Dashboard", href: "/queryDashboard", icon: HelpCircle, description: "Support queries" },
        { name: "Admin Dashboard", href: "/admin", icon: ShieldCheck, description: "Admin panel" },
      ],
    },
    {
      title: "Legal & Information",
      icon: FileText,
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      links: [
        { name: "Privacy Policy", href: "#", icon: ShieldCheck, description: "Privacy information" },
        { name: "Terms of Service", href: "#", icon: FileCheck, description: "Terms & conditions" },
        { name: "Contact Us", href: "/#contact", icon: Mail, description: "Get in touch" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <Badge className="mb-4">Site Navigation</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-primary">aiTyaari</span> Sitemap
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Complete overview of all pages and features available on the aiTyaari platform
            </p>
          </motion.div>
        </div>
      </div>

      {/* Sitemap content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {sitemapSections.map((section, sectionIndex) => {
            const SectionIcon = section.icon;
            
            return (
              <motion.div
                key={sectionIndex}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIndex * 0.1, duration: 0.5 }}
              >
                <Card className="h-full hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-12 h-12 rounded-xl ${section.bgColor} flex items-center justify-center`}>
                        <SectionIcon className={`h-6 w-6 ${section.color}`} />
                      </div>
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {section.links.map((link, linkIndex) => {
                        const LinkIcon = link.icon;
                        const isExternal = link.href.startsWith("#");
                        const isDynamic = (link as any).isDynamic;
                        
                        // For dynamic routes, render as div instead of Link
                        if (isDynamic) {
                          return (
                            <li key={linkIndex}>
                              <div className="group flex items-start gap-3 p-3 rounded-lg opacity-75 cursor-not-allowed">
                                <LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium flex items-center gap-2">
                                    {link.name}
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      Dynamic
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {link.description}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        }
                        
                        return (
                          <li key={linkIndex}>
                            <Link
                              href={link.href}
                              className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                            >
                              <LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium group-hover:text-primary transition-colors">
                                  {link.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {link.description}
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Back to home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

