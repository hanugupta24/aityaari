"use client";

import type React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Target, Calendar, Bell } from "lucide-react";
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

const styles = `
  .sidebar-gradient {
    background: linear-gradient(180deg, 
      hsl(var(--background)) 0%,
      hsl(var(--background)/0.98) 10%,
      hsl(var(--background)/0.95) 50%,
      hsl(var(--background)/0.98) 90%,
      hsl(var(--background)) 100%
    );
  }

  .glassmorphism {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-logo {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: linear-gradient(135deg, 
      rgba(var(--primary), 0.2), 
      rgba(var(--accent), 0.2)
    );
    border: 1px solid rgba(var(--primary), 0.3);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.1),
      inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .sidebar-logo::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.7s;
  }

  .sidebar-logo:hover::before {
    left: 100%;
  }

  .sidebar-logo:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 8px 20px rgba(0, 0, 0, 0.15),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .header-gradient {
    background: linear-gradient(
      90deg,
      hsl(var(--background)/0.8),
      hsl(var(--background)/0.9),
      hsl(var(--background)/0.8)
    );
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
`;

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, initialLoading, loading: authLoading } = useAuth();
  const router = useRouter();
  const logoPath =
    pathname === "/interview/start"
      ? ".././images/logo_solid.svg"
      : "./images/logo_solid.svg";

  useEffect(() => {
    if (!initialLoading && !user) {
      router.push("/login");
    }
  }, [user, initialLoading, router]);

  if (initialLoading || authLoading) {
    return <GlobalLoading />;
  }

  if (!user && !initialLoading) {
    return <GlobalLoading />;
  }

  return (
    <>
      <style>{styles}</style>
      <SidebarProvider defaultOpen>
        <Sidebar
          variant="sidebar"
          collapsible="icon"
          className="sidebar-gradient border-r border-border/30"
        >
          <SidebarHeader className="p-6">
            <Link
              href="/dashboard"
              className="sidebar-logo p-3 flex items-center justify-center group"
            >
              <div className="flex items-center gap-3">
                {/* <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-lg blur-md opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
                  <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                    <Target className="w-6 h-6 text-white animate-float" />
                  </div>
                </div>
                <div className="group-data-[collapsible=icon]:hidden">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                    {siteConfig.name}
                  </h1>
                  <p className="text-xs font-medium text-muted-foreground/80 tracking-wide">
                    Interview Mastery Platform
                  </p>
                </div> */}
                <img
                  src={logoPath}
                  className="h-15 w-80 text-primary rounded-lg"
                  alt="Logo"
                />
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-4 lg:px-0 md:px-0">
            <SidebarNav />
          </SidebarContent>

          {/* <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden border-t border-border/20">
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground/60">
                © {new Date().getFullYear()} {siteConfig.name}
              </p>
              <p className="text-xs text-muted-foreground/40">
                Powered by AI Technology
              </p>
            </div>
          </SidebarFooter> */}
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-30 header-gradient backdrop-blur-xl border-b border-border/30">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger className="block hover:bg-primary/10 transition-colors rounded-lg" />

              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-2 rounded-xl border border-primary/20 shadow-lg backdrop-blur-sm">
                      {/* <Target className="h-5 w-5 text-primary" /> */}
                      <img
                        src=" ../favicon.ico"
                        className="h-8 w-8 text-primary rounded-lg"
                        alt="Logo"
                      ></img>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg font-bold bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                      {pathname === "/dashboard"
                        ? "Dashboard"
                        : pathname === "/interview/start"
                        ? "Start Interview"
                        : pathname === "/interview/history"
                        ? "Interview History"
                        : pathname === "/interview/feedback"
                        ? "Feedback"
                        : pathname === "/settings"
                        ? "Settings"
                        : pathname === "/subscription"
                        ? "Subscriptions"
                        : "Welcome"}
                    </h1>
                    <p className="text-xs font-medium text-muted-foreground/80 tracking-wide md:hidden">
                      Welcome back to your interview preparation
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center space-x-2 bg-muted/20 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/30">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full relative hover:bg-primary/10"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
                </Button>

                <ThemeToggle />
                <UserDropdown />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
