import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RoleBadge } from "../role-badge";
import { roleDisplayNames } from "../../lib/rbac/roles";
import { usePermissions } from "../../hooks/usePermissions";
import { Shield, Users, Edit3, Save, X, Search } from "lucide-react";
import type { Role, UserProfile } from "../../types";

interface RoleManagementProps {
  users: UserProfile[];
  onUpdateUserRoles: (uid: string, roles: Role[]) => Promise<void>;
  loading?: boolean;
}

const ALL_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "CEO",
  "CTO",
  "CBO",
  "CMO",
  "CFO",
  "MANAGER",
];

export function RoleManagement({
  users,
  onUpdateUserRoles,
  loading = false,
}: RoleManagementProps) {
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<Role[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      roleFilter === "all" || user.roles?.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  const handleEditRoles = (user: UserProfile) => {
    setEditingUser(user.uid);
    setEditingRoles(user.roles || []);
  };

  const handleRoleToggle = (role: Role) => {
    setEditingRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;

    setIsUpdating(true);
    try {
      await onUpdateUserRoles(editingUser, editingRoles);
      setEditingUser(null);
      setEditingRoles([]);
    } catch (error) {
      console.error("Error updating roles:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditingRoles([]);
  };

  const getRoleStats = () => {
    const stats: Record<Role, number> = {} as Record<Role, number>;
    ALL_ROLES.forEach((role) => {
      stats[role] = users.filter((user) => user.roles?.includes(role)).length;
    });
    return stats;
  };

  const roleStats = getRoleStats();

  if (!hasPermission("MANAGE_ROLES")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            You don't have permission to manage roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ALL_ROLES.map((role) => (
          <Card key={role} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <RoleBadge role={role} className="mb-2" />
                <p className="text-2xl font-bold">{roleStats[role]}</p>
                <p className="text-sm text-gray-600">users</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </Card>
        ))}
      </div>

      {/* Role Management Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Management
          </CardTitle>
          <CardDescription>
            Assign and manage user roles. Users can have multiple roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value: any) => setRoleFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ALL_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleDisplayNames[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.name || "No name"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <RoleBadge
                              key={role}
                              role={role}
                              className="text-xs"
                            />
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No roles assigned
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingUser === user.uid ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveRoles}
                            disabled={isUpdating}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRoles(user)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit Roles
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Editor Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit User Roles</CardTitle>
              <CardDescription>
                Select the roles to assign to this user. Users can have multiple
                roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_ROLES.map((role) => (
                  <div
                    key={role}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      editingRoles.includes(role)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => handleRoleToggle(role)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {roleDisplayNames[role]}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {role === "SUPER_ADMIN" && "Full system access"}
                          {role === "ADMIN" && "Administrative access"}
                          {role === "CEO" && "Executive oversight"}
                          {role === "CTO" && "Technical leadership"}
                          {role === "CBO" && "Business operations"}
                          {role === "CMO" && "Marketing management"}
                          {role === "CFO" && "Financial oversight"}
                          {role === "MANAGER" && "Team management"}
                        </div>
                      </div>
                      {editingRoles.includes(role) && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveRoles} disabled={isUpdating}>
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
