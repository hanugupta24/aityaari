
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PanelLeft, Bot } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GlobalLoading } from "@/components/common/GlobalLoading";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { siteConfig } from "@/config/site";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, initialLoading, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialLoading && !user) {
      router.push("/login");
    }
  }, [user, initialLoading, router]);

  if (initialLoading || authLoading) {
    return <GlobalLoading />;
  }
  
  if (!user && !initialLoading) {
     // This case should ideally be caught by the useEffect redirect,
     // but as a fallback, prevent rendering children.
     // Or, render a specific "redirecting..." message.
    return <GlobalLoading />;
  }


  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 transition-all" />
            <h1 className="text-xl font-semibold group-data-[collapsible=icon]:hidden">
              {siteConfig.name}
            </h1>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
            {/* Breadcrumbs or Page Title can go here */}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserDropdown />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
