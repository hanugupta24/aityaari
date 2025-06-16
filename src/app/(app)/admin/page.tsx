"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

// Import the actual admin dashboard component
import AdminDashboard from "@/components/admin/dashboard";

export default function AdminPage() {
  const { isAdmin, initialLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!initialLoading && !isAdmin && !hasPermission("VIEW_ADMIN_DASHBOARD")) {
      router.push("/dashboard");
    }
  }, [isAdmin, hasPermission, initialLoading, router]);

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !hasPermission("VIEW_ADMIN_DASHBOARD")) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Access Denied</p>
      </div>
    );
  }

  return <AdminDashboard />;
}
