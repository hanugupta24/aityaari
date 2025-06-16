"use client";

import { useAuth } from "@/contexts/AuthContext";
import { hasPermission as checkPermission } from "@/lib/rbac/roles";
import type { Permission } from "@/types";
import { useCallback, useMemo } from "react";

export function usePermissions() {
  const { userProfile, isAdmin } = useAuth();

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isAdmin) return true;
      if (!userProfile || !userProfile.roles || userProfile.roles.length === 0)
        return false;
      return checkPermission(userProfile.roles, permission);
    },
    [userProfile, isAdmin]
  );

  const canUploadStudyMaterials = useMemo(() => {
    return hasPermission("UPLOAD_STUDY_MATERIALS");
  }, [hasPermission]);

  const canApproveStudyMaterials = useMemo(() => {
    return hasPermission("APPROVE_STUDY_MATERIALS");
  }, [hasPermission]);

  const canEditStudyMaterials = useMemo(() => {
    return hasPermission("EDIT_STUDY_MATERIALS");
  }, [hasPermission]);

  const canDeleteStudyMaterials = useMemo(() => {
    return hasPermission("DELETE_STUDY_MATERIALS");
  }, [hasPermission]);

  const canManageRoles = useMemo(() => {
    return hasPermission("MANAGE_ROLES");
  }, [hasPermission]);

  const canManageUsers = useMemo(() => {
    return hasPermission("MANAGE_USERS");
  }, [hasPermission]);

  return {
    hasPermission,
    canUploadStudyMaterials,
    canApproveStudyMaterials,
    canEditStudyMaterials,
    canDeleteStudyMaterials,
    canManageRoles,
    canManageUsers,
    userProfile,
    isAdmin,
  };
}
