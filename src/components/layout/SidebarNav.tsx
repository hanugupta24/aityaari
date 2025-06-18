"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Briefcase,
  Settings,
  Rocket,
  BarChart3,
  BookOpen,
  CreditCard,
  History,
  ChevronRight,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/site";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const styles = `
  .nav-item {
    position: relative;
    border-radius: 12px;
    transition: all 0.3s ease;
    margin-bottom: 4px;
    overflow: hidden;
  }

  .nav-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.5s;
  }

  .nav-item:hover::before {
    left: 100%;
  }

  .nav-item.active {
    background: linear-gradient(
      90deg,
      rgba(var(--primary), 0.15),
      rgba(var(--primary), 0.05)
    );
    border-left: 3px solid hsl(var(--primary));
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.3s ease;
  }

  .nav-item.active .nav-icon {
    background: rgba(var(--primary), 0.15);
    color: hsl(var(--primary));
  }

  .nav-item:hover .nav-icon {
    transform: translateY(-2px);
  }

  .nav-text {
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: all 0.3s ease;
  }

  .nav-item.active .nav-text {
    color: hsl(var(--primary));
    font-weight: 600;
  }

  .nav-description {
    font-size: 0.75rem;
    opacity: 0.6;
    transition: all 0.3s ease;
  }

  .nav-item.active .nav-description {
    opacity: 0.8;
  }

  .user-profile {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.03),
      rgba(255, 255, 255, 0.06)
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px;
    transition: all 0.3s ease;
  }

  .user-profile:hover {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.08)
    );
    transform: translateY(-2px);
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      rgba(var(--primary), 0.3),
      rgba(var(--accent), 0.3)
    );
    border: 2px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    font-size: 1rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .status-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    position: absolute;
    bottom: 0;
    right: 0;
    border: 2px solid rgba(15, 23, 42, 0.8);
  }

  .subscription-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
  }

  .subscription-badge.free {
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .subscription-badge.plus {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .credits-badge {
    background: rgba(var(--primary), 0.15);
    color: hsl(var(--primary));
    border: 1px solid rgba(var(--primary), 0.3);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .sidebar-upgrade-btn {
    background: linear-gradient(
      90deg,
      hsl(var(--primary)),
      hsl(var(--accent))
    );
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 0.875rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(var(--primary), 0.3);
    position: relative;
    overflow: hidden;
  }

  .sidebar-upgrade-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transition: left 0.7s;
  }

  .sidebar-upgrade-btn:hover::before {
    left: 100%;
  }

  .sidebar-upgrade-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--primary), 0.4);
  }
`;

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    description: "Overview & insights",
  },
  {
    title: "Start Interview",
    href: "/interview/start",
    icon: Rocket,
    description: "Begin new session",
  },
  {
    title: "History",
    href: "/history",
    icon: History,
    description: "Past sessions",
  },
  {
    title: "Performance",
    href: "/performance",
    icon: BarChart3,
    description: "Analytics & trends",
  },
  {
    title: "Study Materials",
    href: "/studyMaterials",
    icon: BookOpen,
    description: "Learning resources",
  },
];

const accountNavItems: NavItem[] = [
  {
    title: "Profile",
    href: "/profile",
    icon: User,
    description: "Personal settings",
  },
  {
    title: "Subscription",
    href: "/subscription",
    icon: CreditCard,
    description: "Manage plan",
  },
  {
    title: "Contact Us",
    href: "/contactUs",
    icon: Briefcase,
    description: "Get in touch",
  },
  {
    title: "Feedback",
    href: "/userFeedback",
    icon: Briefcase,
    description: "Share your thoughts",
  },
];

const adminNavItems: NavItem[] = [
  {
    title: "Admin Panel",
    href: "/admin",
    icon: Settings,
    description: "Admin dashboard",
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { isAdmin, userProfile } = useAuth();
  const { toggleSidebar } = useSidebar();

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!userProfile?.name)
      return <div className="text-green-500  font-semibold text-lg">"U"</div>;
    return (
      <div className="text-green-500  font-semibold text-lg">
        {userProfile.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)}
      </div>
    );
  };

  const FREE_INTERVIEW_LIMIT = 3;
  const interviewsTaken = userProfile?.interviewsTaken || 0;
  const remainingFreeInterviews = FREE_INTERVIEW_LIMIT - interviewsTaken;

  const renderNavItems = (items: NavItem[], showDescription = true) => {
    return items.map((item) => {
      const Icon = item.icon || Briefcase;
      const isActive =
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href));

      const handleClick = () => {
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          toggleSidebar(); // Only close sidebar on mobile
        }
      };

      return (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.title}
              className={cn("nav-item justify-start p-3", isActive && "active")}
            >
              <a
                className="flex items-center gap-3 w-full h-auto"
                onClick={handleClick}
              >
                <div className="nav-icon">
                  <Icon className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden min-h-10">
                  <div className="nav-text">{item.title}</div>
                  <div className="nav-description">{item.description}</div>
                </div>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-primary group-data-[collapsible=icon]:hidden" />
                )}
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      );
    });
  };

  return (
    <>
      <style>{styles}</style>
      <nav className="flex flex-col gap-6">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-2 px-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {renderNavItems(mainNavItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-gradient-to-r from-transparent via-border/50 to-transparent" />

        {/* Account Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-2 px-2">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {renderNavItems(accountNavItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Navigation */}
        {userProfile?.roles && (
          <>
            <SidebarSeparator className="bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-2 px-2">
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {renderNavItems(adminNavItems, false)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* User Profile Section */}
        {userProfile && (
          <>
            <SidebarSeparator className="bg-gradient-to-r from-transparent via-border/50 to-transparent group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupContent>
                <div className="user-profile">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="avatar">{getUserInitials()}</div>
                      <div className="status-badge"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground  truncate">
                        {userProfile.name || "User"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {userProfile.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`subscription-badge ${
                        userProfile.isPlusSubscriber ? "plus" : "free"
                      }`}
                    >
                      {userProfile.isPlusSubscriber ? "✦ Plus" : "Free Plan"}
                    </div>

                    {!userProfile.isPlusSubscriber && (
                      <div className="credits-badge">
                        {remainingFreeInterviews} credits left
                      </div>
                    )}
                  </div>

                  {!userProfile.isPlusSubscriber && (
                    <Link href="/subscription" className="block">
                      <button className="sidebar-upgrade-btn w-full flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>Upgrade to Plus</span>
                      </button>
                    </Link>
                  )}

                  {userProfile.isPlusSubscriber && (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Unlimited Access</span>
                    </div>
                  )}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </nav>
    </>
  );
}
