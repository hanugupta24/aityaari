"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

import CustomerQueriesDashboard from "@/components/CustomerQueriesDashboard/dashboard";

export default function QueriesPage() {
  const { isAdmin, initialLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!initialLoading && !isAdmin && !hasPermission("VIEW_USER_QUERY")) {
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

  if (!isAdmin && !hasPermission("VIEW_USER_QUERY")) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Access Denied</p>
      </div>
    );
  }

  return <CustomerQueriesDashboard />;
}
