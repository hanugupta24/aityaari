import { Badge } from "./ui/badge";
import { roleDisplayNames, roleColors } from "../lib/rbac/roles";
import type { Role } from "../types";

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${roleColors[role]} ${className} font-medium`}
    >
      {roleDisplayNames[role]}
    </Badge>
  );
}
