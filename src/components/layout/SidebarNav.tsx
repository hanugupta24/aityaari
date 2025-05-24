
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Briefcase, Settings, Rocket, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig, type NavItem } from "@/config/site";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";


const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { title: "Profile", href: "/profile", icon: User },
  { title: "Start Interview", href: "/interview/start", icon: Rocket },
];

const adminNavItems: NavItem[] = [
  { title: "Admin Panel", href: "/admin", icon: Settings },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => {
      const Icon = item.icon || Briefcase; // Default icon
      return (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
              tooltip={item.title}
              className="justify-start"
            >
              <a> {/* <a> tag is required by asChild with Next.js Link */}
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      );
    });
  }

  return (
    <nav className="flex flex-col gap-4">
      <SidebarMenu>
        {renderNavItems(mainNavItems)}
      </SidebarMenu>
      {isAdmin && (
        <>
          <SidebarMenu>
             {renderNavItems(adminNavItems)}
          </SidebarMenu>
        </>
      )}
    </nav>
  );
}
