
export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  external?: boolean;
};

export const siteConfig = {
  name: "aiTyaari",
  description:
    "AI-powered interview preparation platform to help you ace your next job interview.",
  mainNav: [
    {
      title: "Dashboard",
      href: "/dashboard",
    },
    {
      title: "Profile",
      href: "/profile",
    },
    {
      title: "Start Interview",
      href: "/interview/start",
    },
  ] satisfies NavItem[],
  adminNav: [
     {
      title: "Admin Dashboard",
      href: "/admin",
    },
  ] satisfies NavItem[]
};
