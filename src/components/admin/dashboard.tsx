"use client";

import { CardFooter } from "@/components/ui/card";

import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  Loader2,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  CalendarClock,
  BarChart3,
  CalendarIcon,
  FilterX,
  Filter,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteField,
  deleteDoc,
} from "firebase/firestore";
import type { UserProfile, Role, StudyMaterial } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  subDays,
  startOfDay,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBadge } from "@/components/role-badge";
import { roleDisplayNames } from "@/lib/rbac/roles";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

// Plan prices
const PLAN_PRICES = {
  monthly: 99,
  quarterly: 249,
  yearly: 999,
};

const lineChartConfig = {
  newSubscriptions: {
    label: "New Plus Subscriptions",
    color: "hsl(var(--primary))",
  },
} satisfies Record<string, any>;

const barChartConfig = {
  subscriptions: {
    label: "New Plus Subscriptions",
    color: "hsl(var(--accent))",
  },
} satisfies Record<string, any>;

const ALL_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "CEO",
  "CTO",
  "CBO",
  "CMO",
  "CFO",
  "MANAGER",
  "NO_ROLE",
];

export default function AdminPage() {
  const {
    userProfile,
    isAdmin,
    initialLoading: authInitialLoading,
    updateUserRoles,
  } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [allUsersData, setAllUsersData] = useState<UserProfile[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [dailySubscriptionData, setDailySubscriptionData] = useState<
    Array<{ date: string; newSubscriptions: number }>
  >([]);
  const [monthlySubscriptionData, setMonthlySubscriptionData] = useState<
    Array<{ month: string; subscriptions: number }>
  >([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [plusSignupsToday, setPlusSignupsToday] = useState(0);
  const [plusSignupsCurrentMonth, setPlusSignupsCurrentMonth] = useState(0);
  const [plusSignupsLastMonth, setPlusSignupsLastMonth] = useState(0);

  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [planFilter, setPlanFilter] = useState<
    "all" | "free" | "monthly" | "quarterly" | "yearly" | "plus_unknown"
  >("all");
  const [adminFilter, setAdminFilter] = useState<"all" | "yes" | "no">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Study materials filters
  const [materialTitleFilter, setMaterialTitleFilter] = useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = useState<
    "all" | StudyMaterial["type"]
  >("all");
  const [materialApprovalFilter, setMaterialApprovalFilter] = useState<
    "all" | "approved" | "pending"
  >("all");

  // Role management
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editingRoles, setEditingRoles] = useState<Role[]>([]);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (!authInitialLoading && !hasPermission("VIEW_ADMIN_DASHBOARD")) {
      router.push("/dashboard");
    }
  }, [userProfile, isAdmin, authInitialLoading, router, hasPermission]);

  useEffect(() => {
    if (hasPermission("VIEW_ADMIN_DASHBOARD")) {
      console.log("hasPermission is true, fetching data");
      const fetchAllData = async () => {
        setIsLoadingData(true);
        setFetchError(null);
        try {
          // Fetch users
          const usersCollectionRef = collection(db, "users");
          const usersSnapshot = await getDocs(usersCollectionRef);
          const usersList: UserProfile[] = [];
          usersSnapshot.forEach((doc) => {
            usersList.push({ uid: doc.id, ...doc.data() } as UserProfile);
          });
          setAllUsersData(usersList);
          processSubscriptionData(usersList);
          processMonthlyChartData(usersList);

          // Fetch study materials
          const materialsCollectionRef = collection(db, "study-materials");
          const materialsSnapshot = await getDocs(materialsCollectionRef);
          const materialsList: StudyMaterial[] = [];
          materialsSnapshot.forEach((doc) => {
            materialsList.push({ id: doc.id, ...doc.data() } as StudyMaterial);
          });
          setStudyMaterials(materialsList);
        } catch (error: any) {
          console.error("Error fetching data:", error);
          setFetchError(
            error.message ||
              "Failed to fetch data. Check Firestore rules and connectivity."
          );
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchAllData();
    }
  }, [hasPermission]);

  const processSubscriptionData = (users: UserProfile[]) => {
    const today = startOfDay(new Date());
    const last7DaysData: Array<{ date: string; newSubscriptions: number }> = [];
    const dailyCounts: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, "yyyy-MM-dd");
      dailyCounts[formattedDate] = 0;
    }

    let signupsTodayCount = 0;
    let signupsCurrentMonthCount = 0;
    let signupsLastMonthCount = 0;

    const currentMonthStart = startOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));

    users.forEach((u) => {
      if (u.isPlusSubscriber && u.updatedAt) {
        try {
          const updatedAtDate = new Date(u.updatedAt);
          const updatedAtDayStart = startOfDay(updatedAtDate);

          const formattedUpdatedAtDay = format(updatedAtDayStart, "yyyy-MM-dd");
          if (dailyCounts.hasOwnProperty(formattedUpdatedAtDay)) {
            dailyCounts[formattedUpdatedAtDay]++;
          }

          // Check if updatedAtDate is today
          if (updatedAtDayStart.getTime() === today.getTime()) {
            signupsTodayCount++;
          }

          if (updatedAtDayStart >= currentMonthStart) {
            signupsCurrentMonthCount++;
          }

          if (
            updatedAtDayStart >= lastMonthStart &&
            updatedAtDayStart <= lastMonthEnd
          ) {
            signupsLastMonthCount++;
          }
        } catch (e) {
          console.warn(
            "Could not parse updatedAt date for user:",
            u.uid,
            u.updatedAt
          );
        }
      }
    });

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, "yyyy-MM-dd");
      last7DaysData.push({
        date: formattedDate,
        newSubscriptions: dailyCounts[formattedDate] || 0,
      });
    }
    setDailySubscriptionData(last7DaysData);
    setPlusSignupsToday(signupsTodayCount);
    setPlusSignupsCurrentMonth(signupsCurrentMonthCount);
    setPlusSignupsLastMonth(signupsLastMonthCount);
  };

  const processMonthlyChartData = (users: UserProfile[]) => {
    const monthlyCounts: Record<string, number> = {};
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      // Data for the last 6 months (current month + 5 previous)
      const monthDate = subMonths(today, i);
      const monthKey = format(monthDate, "yyyy-MM"); // e.g., "2023-10"
      monthlyCounts[monthKey] = 0;
    }

    users.forEach((u) => {
      if (u.isPlusSubscriber && u.updatedAt) {
        try {
          const updatedAtDate = startOfDay(new Date(u.updatedAt)); // Normalize to start of day
          const monthKey = format(updatedAtDate, "yyyy-MM");
          if (monthlyCounts.hasOwnProperty(monthKey)) {
            monthlyCounts[monthKey]++;
          }
        } catch (e) {
          console.warn(
            "Could not parse updatedAt for monthly chart:",
            u.uid,
            u.updatedAt
          );
        }
      }
    });

    const chartData = Object.entries(monthlyCounts)
      .map(([monthKey, count]) => ({
        month: format(new Date(monthKey + "-01"), "MMM yyyy"), // Display format like "Oct 2023"
        subscriptions: count,
      }))
      .sort(
        (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
      ); // Ensure chronological order

    setMonthlySubscriptionData(chartData);
  };

  const memoizedStats = useMemo(() => {
    if (isLoadingData || fetchError || allUsersData.length === 0) {
      return {
        totalUsers: 0,
        totalPlusSubscriptions: 0,
        monthlySubscribers: 0,
        quarterlySubscribers: 0,
        yearlySubscribers: 0,
        unknownPlanSubscribers: 0,
        estimatedMonthlyRevenue: 0,
        totalInterviewsTaken: 0,
        totalStudyMaterials: 0,
        pendingApprovals: 0,
      };
    }

    const totalUsers = allUsersData.length;
    const plusSubscribers = allUsersData.filter((u) => u.isPlusSubscriber);
    const totalPlusSubscriptions = plusSubscribers.length;

    const monthlySubscribers = plusSubscribers.filter(
      (u) => u.subscriptionPlan === "monthly"
    ).length;
    const quarterlySubscribers = plusSubscribers.filter(
      (u) => u.subscriptionPlan === "quarterly"
    ).length;
    const yearlySubscribers = plusSubscribers.filter(
      (u) => u.subscriptionPlan === "yearly"
    ).length;
    const unknownPlanSubscribers = plusSubscribers.filter(
      (u) => u.isPlusSubscriber && !u.subscriptionPlan
    ).length;

    let estimatedMonthlyRevenue = 0;
    plusSubscribers.forEach((u) => {
      if (u.subscriptionPlan === "monthly") {
        estimatedMonthlyRevenue += PLAN_PRICES.monthly;
      } else if (u.subscriptionPlan === "quarterly") {
        estimatedMonthlyRevenue += PLAN_PRICES.quarterly / 3; // Average monthly
      } else if (u.subscriptionPlan === "yearly") {
        estimatedMonthlyRevenue += PLAN_PRICES.yearly / 12; // Average monthly
      } else {
        // If plan is unknown but they are a Plus subscriber, assume a default for revenue (e.g., monthly)
        // Or you could choose to exclude them from this specific revenue calculation
        estimatedMonthlyRevenue += PLAN_PRICES.monthly;
      }
    });

    const totalInterviewsTaken = allUsersData.reduce(
      (sum, u) => sum + (u.interviewsTaken || 0),
      0
    );
    const totalStudyMaterials = studyMaterials.length;
    const pendingApprovals = studyMaterials.filter(
      (m) => m.approved === false
    ).length;

    return {
      totalUsers,
      totalPlusSubscriptions,
      monthlySubscribers,
      quarterlySubscribers,
      yearlySubscribers,
      unknownPlanSubscribers,
      estimatedMonthlyRevenue,
      totalInterviewsTaken,
      totalStudyMaterials,
      pendingApprovals,
    };
  }, [allUsersData, studyMaterials, isLoadingData, fetchError]);

  const filteredUsers = useMemo(() => {
    return allUsersData.filter((u) => {
      const nameMatch =
        u.name?.toLowerCase().includes(nameFilter.toLowerCase()) ?? true;
      const emailMatch =
        u.email?.toLowerCase().includes(emailFilter.toLowerCase()) ?? true;

      let planMatch = true;
      if (planFilter !== "all") {
        if (planFilter === "free") planMatch = !u.isPlusSubscriber;
        else if (planFilter === "plus_unknown")
          planMatch = u.isPlusSubscriber && !u.subscriptionPlan;
        else
          planMatch = u.isPlusSubscriber && u.subscriptionPlan === planFilter;
      }

      const adminMatch =
        adminFilter === "all" ||
        (adminFilter === "yes" && u.isAdmin) ||
        (adminFilter === "no" && !u.isAdmin);

      let roleMatch = true;
      if (roleFilter !== "all") {
        roleMatch = u.roles?.includes(roleFilter) || false;
      }

      let dateMatch = true;
      if (u.createdAt && (dateRangeFilter.from || dateRangeFilter.to)) {
        try {
          const userJoinedDate = startOfDay(parseISO(u.createdAt));
          const from = dateRangeFilter.from
            ? startOfDay(dateRangeFilter.from)
            : new Date(0); // Beginning of time
          const to = dateRangeFilter.to
            ? startOfDay(dateRangeFilter.to)
            : new Date(); // Today
          dateMatch = isWithinInterval(userJoinedDate, {
            start: from,
            end: to,
          });
        } catch (e) {
          console.warn(
            "Could not parse createdAt date for user:",
            u.uid,
            u.createdAt
          );
          dateMatch = false; // Or true, depending on desired behavior for unparseable dates
        }
      }
      return (
        nameMatch &&
        emailMatch &&
        planMatch &&
        adminMatch &&
        roleMatch &&
        dateMatch
      );
    });
  }, [
    allUsersData,
    nameFilter,
    emailFilter,
    planFilter,
    adminFilter,
    roleFilter,
    dateRangeFilter,
  ]);

  const filteredMaterials = useMemo(() => {
    return studyMaterials.filter((m) => {
      const titleMatch = m.title
        .toLowerCase()
        .includes(materialTitleFilter.toLowerCase());

      let typeMatch = true;
      if (materialTypeFilter !== "all") {
        typeMatch = m.type === materialTypeFilter;
      }

      let approvalMatch = true;
      if (materialApprovalFilter !== "all") {
        approvalMatch =
          materialApprovalFilter === "approved"
            ? m.approved === true
            : m.approved === false;
      }

      return titleMatch && typeMatch && approvalMatch;
    });
  }, [
    studyMaterials,
    materialTitleFilter,
    materialTypeFilter,
    materialApprovalFilter,
  ]);

  const clearUserFilters = () => {
    setNameFilter("");
    setEmailFilter("");
    setPlanFilter("all");
    setAdminFilter("all");
    setRoleFilter("all");
    setDateRangeFilter({ from: undefined, to: undefined });
  };

  const clearMaterialFilters = () => {
    setMaterialTitleFilter("");
    setMaterialTypeFilter("all");
    setMaterialApprovalFilter("all");
  };

  const handleEditRoles = (user: UserProfile) => {
    setSelectedUser(user);
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
    if (!selectedUser?.uid) return;

    setIsUpdatingRoles(true);
    try {
      await updateUserRoles(selectedUser.uid, editingRoles);

      // Update local state
      setAllUsersData((prev) =>
        prev.map((u) =>
          u.uid === selectedUser.uid ? { ...u, roles: editingRoles } : u
        )
      );

      toast({
        title: "Roles updated",
        description: `Roles for ${
          selectedUser.name || selectedUser.email
        } have been updated.`,
      });

      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: "Error updating roles",
        description: error.message || "There was an error updating roles.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingRoles(false);
    }
  };

  const handleApproveMaterial = async (material: StudyMaterial) => {
    try {
      await updateDoc(doc(db, "study-materials", material.id), {
        approved: true,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setStudyMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, approved: true } : m))
      );

      toast({
        title: "Material approved",
        description: `"${material.title}" has been approved and is now visible to users.`,
      });
    } catch (error: any) {
      toast({
        title: "Error approving material",
        description:
          error.message || "There was an error approving the material.",
        variant: "destructive",
      });
    }
  };

  const handleUnApproveMaterial = async (material: StudyMaterial) => {
    try {
      await updateDoc(doc(db, "study-materials", material.id), {
        approved: false,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setStudyMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, approved: false } : m))
      );

      toast({
        title: "Material Un-approved",
        description: `"${material.title}" has been approved and is now visible to users.`,
      });
    } catch (error: any) {
      toast({
        title: "Error approving material",
        description:
          error.message || "There was an error approving the material.",
        variant: "destructive",
      });
    }
  };

  const handleRejectMaterial = async (material: StudyMaterial) => {
    try {
      await deleteDoc(doc(db, "study-materials", material.id));

      toast({
        title: "Material rejected",
        description: `"${material.title}" has been rejected and will not be visible to users.`,
      });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error rejecting material",
        description:
          error.message || "There was an error rejecting the material.",
        variant: "destructive",
      });
    }
  };

  if (
    authInitialLoading ||
    (!hasPermission("VIEW_ADMIN_DASHBOARD") && !authInitialLoading)
  ) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission("VIEW_ADMIN_DASHBOARD")) {
    // This check is after initialLoading, so we know user state is resolved
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Access Denied</p>
      </div>
    ); // Or redirect
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>

        {userProfile?.roles && userProfile.roles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Logged in as:</span>
            {userProfile.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        )}
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {isLoadingData && !fetchError && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading admin data...</p>
        </div>
      )}

      {!isLoadingData && !fetchError && (
        <>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 md:grid-cols-4 w-full">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="materials">Study Materials</TabsTrigger>
              <TabsTrigger value="roles" className="hidden md:block">
                Role Management
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6 mt-6">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Users
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoizedStats.totalUsers}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Plus Subscriptions
                    </CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoizedStats.totalPlusSubscriptions}
                    </div>
                    {memoizedStats.unknownPlanSubscribers > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {memoizedStats.unknownPlanSubscribers} with unspecified
                        plan
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Est. Monthly Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{memoizedStats.estimatedMonthlyRevenue.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Interviews Taken
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoizedStats.totalInterviewsTaken}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Study Materials Stats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Study Materials
                    </CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoizedStats.totalStudyMaterials}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Pending Approvals
                    </CardTitle>
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoizedStats.pendingApprovals}
                    </div>
                    {memoizedStats.pendingApprovals > 0 && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-primary"
                        onClick={() => {
                          setActiveTab("materials");
                          setMaterialApprovalFilter("pending");
                        }}
                      >
                        Review pending materials
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Signup Metrics Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Plus Signups (Last 24h)
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{plusSignupsToday}</div>
                    <p className="text-xs text-muted-foreground">
                      (Based on profile update)
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Plus Signups (This Month)
                    </CardTitle>
                    <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {plusSignupsCurrentMonth}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Month: {format(new Date(), "MMMM yyyy")}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Plus Signups (Last Month)
                    </CardTitle>
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {plusSignupsLastMonth}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Month: {format(subMonths(new Date(), 1), "MMMM yyyy")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Subscription Plan Breakdown */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>Subscription Plan Breakdown</CardTitle>
                  <CardDescription>
                    Current number of active Plus subscribers by plan type.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[500px] grid gap-4 md:grid-cols-3">
                      <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Monthly Subscribers
                          </CardTitle>
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {memoizedStats.monthlySubscribers}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @ ₹{PLAN_PRICES.monthly.toFixed(2)}/mo
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Quarterly Subscribers
                          </CardTitle>
                          <CalendarRange className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {memoizedStats.quarterlySubscribers}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @ ₹{PLAN_PRICES.quarterly.toFixed(2)}/qtr
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Yearly Subscribers
                          </CardTitle>
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {memoizedStats.yearlySubscribers}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @ ₹{PLAN_PRICES.yearly.toFixed(2)}/yr
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly New Subscriptions Chart */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>New Plus Subscriptions (Last 6 Months)</CardTitle>
                  <CardDescription>
                    Count of new Plus subscriptions based on recent profile
                    updates by month.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[500px]">
                      <ChartContainer
                        config={barChartConfig}
                        className="h-[300px] w-full"
                      >
                        {monthlySubscriptionData.length > 0 ? (
                          <BarChart
                            data={monthlySubscriptionData}
                            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="month"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              allowDecimals={false}
                            />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent indicator="dashed" />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar
                              dataKey="subscriptions"
                              fill="var(--color-subscriptions)"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">
                              No monthly subscription data available.
                            </p>
                          </div>
                        )}
                      </ChartContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily New Subscriptions Chart */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>
                    Daily New Plus Subscriptions (Last 7 Days)
                  </CardTitle>
                  <CardDescription>
                    Count of new Plus subscriptions based on recent profile
                    updates.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[500px]">
                      <ChartContainer
                        config={lineChartConfig}
                        className="h-[300px] w-full"
                      >
                        {dailySubscriptionData.length > 0 ? (
                          <LineChart
                            data={dailySubscriptionData}
                            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tickFormatter={(value) =>
                                format(new Date(value + "T00:00:00"), "MMM d")
                              } // Ensure correct date parsing for formatter
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              allowDecimals={false}
                            />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  indicator="line"
                                  labelFormatter={(label, payload) => {
                                    if (
                                      payload &&
                                      payload.length &&
                                      payload[0].payload.date
                                    ) {
                                      // Ensure date is treated as local, add T00:00:00 if only date string
                                      return format(
                                        new Date(
                                          payload[0].payload.date + "T00:00:00"
                                        ),
                                        "MMMM d, yyyy"
                                      );
                                    }
                                    return label;
                                  }}
                                />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Line
                              type="monotone"
                              dataKey="newSubscriptions"
                              stroke="var(--color-newSubscriptions)"
                              strokeWidth={2}
                              dot={{
                                r: 4,
                                fill: "var(--color-newSubscriptions)",
                                stroke: "var(--background)",
                              }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">
                              No subscription data available for the last 7
                              days.
                            </p>
                          </div>
                        )}
                      </ChartContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6 mt-6">
              {/* User Management Table with Filters */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" /> User Management
                  </CardTitle>
                  <CardDescription>
                    View and manage user accounts. Use filters below to refine
                    the list.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
                    <Input
                      placeholder="Filter by Name..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                    />
                    <Input
                      placeholder="Filter by Email..."
                      value={emailFilter}
                      onChange={(e) => setEmailFilter(e.target.value)}
                    />
                    <Select
                      value={planFilter}
                      onValueChange={(value: any) => setPlanFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by Plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Plans</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="plus_unknown">
                          Plus (Unspecified Plan)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={adminFilter}
                      onValueChange={(value: any) => setAdminFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by Admin Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="yes">Admin Only</SelectItem>
                        <SelectItem value="no">Non-Admins Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={roleFilter}
                      onValueChange={(value: any) => setRoleFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by Role" />
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "justify-start text-left font-normal",
                            !dateRangeFilter.from &&
                              !dateRangeFilter.to &&
                              "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRangeFilter.from ? (
                            dateRangeFilter.to ? (
                              `${format(
                                dateRangeFilter.from,
                                "LLL dd, y"
                              )} - ${format(dateRangeFilter.to, "LLL dd, y")}`
                            ) : (
                              format(dateRangeFilter.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Filter by Joined Date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRangeFilter.from}
                          selected={{
                            from: dateRangeFilter.from,
                            to: dateRangeFilter.to,
                          }}
                          onSelect={(range) =>
                            setDateRangeFilter({
                              from: range?.from,
                              to: range?.to,
                            })
                          }
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={clearUserFilters}
                      variant="outline"
                      className="lg:col-span-1 flex items-center gap-2"
                    >
                      <FilterX className="h-4 w-4" /> Clear Filters
                    </Button>
                  </div>

                  {/* User Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Plan Tier</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">
                            Interviews
                          </TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => (
                          <TableRow key={u.uid}>
                            <TableCell className="font-medium">
                              {u.name || "N/A"}
                            </TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  u.isPlusSubscriber ? "default" : "secondary"
                                }
                              >
                                {u.isPlusSubscriber
                                  ? u.subscriptionPlan
                                    ? u.subscriptionPlan
                                        .charAt(0)
                                        .toUpperCase() +
                                      u.subscriptionPlan.slice(1)
                                    : "Plus"
                                  : "Free"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.createdAt
                                ? format(parseISO(u.createdAt), "P")
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              {u.interviewsTaken || 0}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {u.roles && u.roles.length > 0 ? (
                                  u.roles.map((role) => (
                                    <RoleBadge
                                      key={role}
                                      role={role}
                                      className="text-xs"
                                    />
                                  ))
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    No Role
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasPermission("MANAGE_ROLES") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditRoles(u)}
                                >
                                  Edit Roles
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredUsers.length === 0 && !isLoadingData && (
                    <p className="py-4 text-center text-muted-foreground">
                      No users match the current filters.
                    </p>
                  )}
                  {allUsersData.length === 0 && !isLoadingData && (
                    <p className="py-4 text-center text-muted-foreground">
                      No users found in the system.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Role Management Modal */}
              {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <Card className="w-full max-w-md">
                    <CardHeader>
                      <CardTitle>
                        Edit Roles for {selectedUser.name || selectedUser.email}
                      </CardTitle>
                      <CardDescription>
                        Select the roles to assign to this user
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_ROLES.map((role) => (
                          <div
                            key={role}
                            className={`p-2 border rounded-md cursor-pointer ${
                              editingRoles.includes(role)
                                ? "bg-primary/10 border-primary"
                                : "bg-background border-border"
                            }`}
                            onClick={() => handleRoleToggle(role)}
                          >
                            <div className="flex items-center justify-between">
                              <span>{roleDisplayNames[role]}</span>
                              {editingRoles.includes(role) && (
                                <div className="w-3 h-3 rounded-full bg-primary"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedUser(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveRoles}
                        disabled={isUpdatingRoles}
                      >
                        {isUpdatingRoles ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Roles"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="materials" className="space-y-6 mt-6">
              {/* Study Materials Management */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Study Materials Management
                  </CardTitle>
                  <CardDescription>
                    Manage study materials and approve new submissions.
                    {hasPermission("UPLOAD_STUDY_MATERIALS") && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary"
                        onClick={() => router.push("/studyMaterials/upload")}
                      >
                        Upload new material
                      </Button>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
                    <Input
                      placeholder="Filter by Title..."
                      value={materialTitleFilter}
                      onChange={(e) => setMaterialTitleFilter(e.target.value)}
                    />
                    <Select
                      value={materialTypeFilter}
                      onValueChange={(value: any) =>
                        setMaterialTypeFilter(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="article">Articles</SelectItem>
                        <SelectItem value="video">Videos</SelectItem>
                        <SelectItem value="course">Courses</SelectItem>
                        <SelectItem value="quiz">Quizzes</SelectItem>
                        <SelectItem value="podcast">Podcasts</SelectItem>
                        <SelectItem value="code">Code</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={materialApprovalFilter}
                      onValueChange={(value: any) =>
                        setMaterialApprovalFilter(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by Approval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Materials</SelectItem>
                        <SelectItem value="approved">Approved Only</SelectItem>
                        <SelectItem value="pending">
                          Pending Approval
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={clearMaterialFilters}
                      variant="outline"
                      className="md:col-span-3"
                    >
                      <FilterX className="h-4 w-4 mr-2" /> Clear Filters
                    </Button>
                  </div>

                  {/* Materials Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMaterials.map((material) => (
                          <TableRow key={material.id}>
                            <TableCell className="font-medium">
                              {material.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {material.type.charAt(0).toUpperCase() +
                                  material.type.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{material.author}</span>
                                {material.authorRole && (
                                  <RoleBadge
                                    role={material.authorRole}
                                    className="mt-1 text-xs"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {material.createdAt
                                ? format(new Date(material.createdAt), "PP")
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  material.approved ? "success" : "outline"
                                }
                              >
                                {material.approved ? "Approved" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/studyMaterials/${material.id}`
                                    )
                                  }
                                >
                                  View
                                </Button>

                                {hasPermission("APPROVE_STUDY_MATERIALS") &&
                                  !material.approved && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() =>
                                        handleApproveMaterial(material)
                                      }
                                    >
                                      Approve
                                    </Button>
                                  )}
                                {hasPermission("EDIT_STUDY_MATERIALS") &&
                                  !material.approved && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        handleRejectMaterial(material)
                                      }
                                    >
                                      Reject
                                    </Button>
                                  )}
                                {hasPermission("EDIT_STUDY_MATERIALS") &&
                                  material.approved && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        handleUnApproveMaterial(material)
                                      }
                                    >
                                      Un-Approve
                                    </Button>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredMaterials.length === 0 && !isLoadingData && (
                    <p className="py-4 text-center text-muted-foreground">
                      No study materials match the current filters.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6 mt-6">
              {/* Role Management */}
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" /> Role Management
                  </CardTitle>
                  <CardDescription>
                    View role permissions and manage access control.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Key Permissions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ALL_ROLES.map((role) => {
                          const usersWithRole = allUsersData.filter((u) =>
                            u.roles?.includes(role)
                          ).length;

                          return (
                            <TableRow key={role}>
                              <TableCell>
                                <RoleBadge role={role} />
                              </TableCell>
                              <TableCell>
                                {role === "SUPER_ADMIN" &&
                                  "Full system access with all permissions"}
                                {role === "ADMIN" &&
                                  "Administrative access to manage users and content"}
                                {role === "CEO" &&
                                  "Executive access with financial and analytics visibility"}
                                {role === "CTO" &&
                                  "Technical leadership with system oversight"}
                                {role === "CBO" &&
                                  "Business operations management"}
                                {role === "CMO" &&
                                  "Marketing and content management"}
                                {role === "CFO" &&
                                  "Financial data access and reporting"}
                                {role === "MANAGER" &&
                                  "Team and content management capabilities"}
                              </TableCell>
                              <TableCell>{usersWithRole}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {role === "SUPER_ADMIN" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        All Permissions
                                      </Badge>
                                    </>
                                  )}
                                  {role === "ADMIN" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Manage Users
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Approve Content
                                      </Badge>
                                    </>
                                  )}
                                  {role === "CEO" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Financials
                                      </Badge>
                                    </>
                                  )}
                                  {role === "CTO" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Approve Content
                                      </Badge>
                                    </>
                                  )}
                                  {role === "CBO" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Upload Content
                                      </Badge>
                                    </>
                                  )}
                                  {role === "CMO" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Upload Content
                                      </Badge>
                                    </>
                                  )}
                                  {role === "CFO" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Financials
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                    </>
                                  )}
                                  {role === "MANAGER" && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Upload Content
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        View Analytics
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
