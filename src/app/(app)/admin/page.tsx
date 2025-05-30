
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, CreditCard, Loader2, AlertTriangle, CalendarDays, CalendarRange, CalendarCheck2, CalendarClock, BarChart3, Calendar as CalendarIcon, FilterX, Filter } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { UserProfile } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfDay, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from "@/lib/utils"; // Added import

// Plan prices
const PLAN_PRICES = {
  monthly: 9.99,
  quarterly: 27.99,
  yearly: 99.99,
};

const lineChartConfig = {
  newSubscriptions: { label: "New Plus Subscriptions", color: "hsl(var(--primary))" },
} satisfies Record<string, any>;

const barChartConfig = {
  subscriptions: { label: "New Plus Subscriptions", color: "hsl(var(--accent))" },
} satisfies Record<string, any>;


export default function AdminPage() {
  const { user, isAdmin, initialLoading: authInitialLoading } = useAuth();
  const router = useRouter();

  const [allUsersData, setAllUsersData] = useState<UserProfile[]>([]);
  const [dailySubscriptionData, setDailySubscriptionData] = useState<Array<{ date: string; newSubscriptions: number }>>([]);
  const [monthlySubscriptionData, setMonthlySubscriptionData] = useState<Array<{ month: string; subscriptions: number }>>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [plusSignupsToday, setPlusSignupsToday] = useState(0);
  const [plusSignupsCurrentMonth, setPlusSignupsCurrentMonth] = useState(0);
  const [plusSignupsLastMonth, setPlusSignupsLastMonth] = useState(0);

  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "monthly" | "quarterly" | "yearly" | "plus_unknown">("all");
  const [adminFilter, setAdminFilter] = useState<"all" | "yes" | "no">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });


  useEffect(() => {
    if (!authInitialLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [user, isAdmin, authInitialLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      const fetchAllUsers = async () => {
        setIsLoadingData(true);
        setFetchError(null);
        try {
          const usersCollectionRef = collection(db, "users");
          const querySnapshot = await getDocs(usersCollectionRef);
          const usersList: UserProfile[] = [];
          querySnapshot.forEach((doc) => {
            usersList.push({ uid: doc.id, ...doc.data() } as UserProfile);
          });
          setAllUsersData(usersList);
          processSubscriptionData(usersList);
          processMonthlyChartData(usersList);
        } catch (error: any) {
          console.error("Error fetching all users:", error);
          setFetchError(error.message || "Failed to fetch user data. Check Firestore rules and connectivity.");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchAllUsers();
    }
  }, [isAdmin]);

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

    users.forEach(u => {
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
          
          if (updatedAtDayStart >= lastMonthStart && updatedAtDayStart <= lastMonthEnd) {
            signupsLastMonthCount++;
          }

        } catch (e) {
          console.warn("Could not parse updatedAt date for user:", u.uid, u.updatedAt);
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

    for (let i = 5; i >= 0; i--) { // Data for the last 6 months (current month + 5 previous)
        const monthDate = subMonths(today, i);
        const monthKey = format(monthDate, "yyyy-MM"); // e.g., "2023-10"
        monthlyCounts[monthKey] = 0;
    }

    users.forEach(u => {
        if (u.isPlusSubscriber && u.updatedAt) {
            try {
                const updatedAtDate = startOfDay(new Date(u.updatedAt)); // Normalize to start of day
                const monthKey = format(updatedAtDate, "yyyy-MM");
                if (monthlyCounts.hasOwnProperty(monthKey)) {
                    monthlyCounts[monthKey]++;
                }
            } catch (e) {
                console.warn("Could not parse updatedAt for monthly chart:", u.uid, u.updatedAt);
            }
        }
    });

    const chartData = Object.entries(monthlyCounts)
        .map(([monthKey, count]) => ({
            month: format(new Date(monthKey + '-01'), "MMM yyyy"), // Display format like "Oct 2023"
            subscriptions: count,
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()); // Ensure chronological order

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
      };
    }

    const totalUsers = allUsersData.length;
    const plusSubscribers = allUsersData.filter(u => u.isPlusSubscriber);
    const totalPlusSubscriptions = plusSubscribers.length;

    const monthlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'monthly').length;
    const quarterlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'quarterly').length;
    const yearlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'yearly').length;
    const unknownPlanSubscribers = plusSubscribers.filter(u => u.isPlusSubscriber && !u.subscriptionPlan).length;

    let estimatedMonthlyRevenue = 0;
    plusSubscribers.forEach(u => {
      if (u.subscriptionPlan === 'monthly') {
        estimatedMonthlyRevenue += PLAN_PRICES.monthly;
      } else if (u.subscriptionPlan === 'quarterly') {
        estimatedMonthlyRevenue += PLAN_PRICES.quarterly / 3; // Average monthly
      } else if (u.subscriptionPlan === 'yearly') {
        estimatedMonthlyRevenue += PLAN_PRICES.yearly / 12; // Average monthly
      } else {
        // If plan is unknown but they are a Plus subscriber, assume a default for revenue (e.g., monthly)
        // Or you could choose to exclude them from this specific revenue calculation
        estimatedMonthlyRevenue += PLAN_PRICES.monthly; 
      }
    });

    const totalInterviewsTaken = allUsersData.reduce((sum, u) => sum + (u.interviewsTaken || 0), 0);
    
    return {
      totalUsers,
      totalPlusSubscriptions,
      monthlySubscribers,
      quarterlySubscribers,
      yearlySubscribers,
      unknownPlanSubscribers,
      estimatedMonthlyRevenue,
      totalInterviewsTaken,
    };
  }, [allUsersData, isLoadingData, fetchError]);

  const filteredUsers = useMemo(() => {
    return allUsersData.filter(u => {
      const nameMatch = u.name?.toLowerCase().includes(nameFilter.toLowerCase()) ?? true;
      const emailMatch = u.email?.toLowerCase().includes(emailFilter.toLowerCase()) ?? true;
      
      let planMatch = true;
      if (planFilter !== "all") {
        if (planFilter === "free") planMatch = !u.isPlusSubscriber;
        else if (planFilter === "plus_unknown") planMatch = u.isPlusSubscriber && !u.subscriptionPlan;
        else planMatch = u.isPlusSubscriber && u.subscriptionPlan === planFilter;
      }

      const adminMatch = adminFilter === "all" || (adminFilter === "yes" && u.isAdmin) || (adminFilter === "no" && !u.isAdmin);
      
      let dateMatch = true;
      if (u.createdAt && (dateRangeFilter.from || dateRangeFilter.to)) {
        try {
            const userJoinedDate = startOfDay(parseISO(u.createdAt));
            const from = dateRangeFilter.from ? startOfDay(dateRangeFilter.from) : new Date(0); // Beginning of time
            const to = dateRangeFilter.to ? startOfDay(dateRangeFilter.to) : new Date(); // Today
            dateMatch = isWithinInterval(userJoinedDate, { start: from, end: to });
        } catch (e) {
            console.warn("Could not parse createdAt date for user:", u.uid, u.createdAt);
            dateMatch = false; // Or true, depending on desired behavior for unparseable dates
        }
      }
      return nameMatch && emailMatch && planMatch && adminMatch && dateMatch;
    });
  }, [allUsersData, nameFilter, emailFilter, planFilter, adminFilter, dateRangeFilter]);

  const clearFilters = () => {
    setNameFilter("");
    setEmailFilter("");
    setPlanFilter("all");
    setAdminFilter("all");
    setDateRangeFilter({ from: undefined, to: undefined });
  };

  if (authInitialLoading || (!isAdmin && !authInitialLoading)) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!isAdmin) { // This check is after initialLoading, so we know user state is resolved
     return <div className="flex justify-center items-center h-screen"><p>Access Denied</p></div>; // Or redirect
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

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
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memoizedStats.totalUsers}</div>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plus Subscriptions</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memoizedStats.totalPlusSubscriptions}</div>
                 {memoizedStats.unknownPlanSubscribers > 0 && <p className="text-xs text-muted-foreground">{memoizedStats.unknownPlanSubscribers} with unspecified plan</p>}
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${memoizedStats.estimatedMonthlyRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Interviews Taken</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memoizedStats.totalInterviewsTaken}</div>
              </CardContent>
            </Card>
          </div>

          {/* Signup Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
             <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plus Signups (Last 24h)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plusSignupsToday}</div>
                <p className="text-xs text-muted-foreground">(Based on profile update)</p>
              </CardContent>
            </Card>
             <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plus Signups (This Month)</CardTitle>
                <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plusSignupsCurrentMonth}</div>
                 <p className="text-xs text-muted-foreground">Month: {format(new Date(), "MMMM yyyy")}</p>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plus Signups (Last Month)</CardTitle>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plusSignupsLastMonth}</div>
                 <p className="text-xs text-muted-foreground">Month: {format(subMonths(new Date(), 1), "MMMM yyyy")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Plan Breakdown */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
                <CardTitle>Subscription Plan Breakdown</CardTitle>
                <CardDescription>Current number of active Plus subscribers by plan type.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Subscribers</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{memoizedStats.monthlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.monthly.toFixed(2)}/mo</p>
                    </CardContent>
                </Card>
                <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quarterly Subscribers</CardTitle>
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{memoizedStats.quarterlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.quarterly.toFixed(2)}/qtr</p>
                    </CardContent>
                </Card>
                <Card className="bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Yearly Subscribers</CardTitle>
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{memoizedStats.yearlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.yearly.toFixed(2)}/yr</p>
                    </CardContent>
                </Card>
            </CardContent>
          </Card>
          
          {/* Monthly New Subscriptions Chart */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>New Plus Subscriptions (Last 6 Months)</CardTitle>
              <CardDescription>
                Count of new Plus subscriptions based on recent profile updates by month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                {monthlySubscriptionData.length > 0 ? (
                  <BarChart data={monthlySubscriptionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8} 
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip 
                      content={<ChartTooltipContent indicator="dashed" />} 
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
                    <p className="text-muted-foreground">No monthly subscription data available.</p>
                  </div>
                )}
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Daily New Subscriptions Chart */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Daily New Plus Subscriptions (Last 7 Days)</CardTitle>
              <CardDescription>
                Count of new Plus subscriptions based on recent profile updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={lineChartConfig} className="h-[300px] w-full">
                {dailySubscriptionData.length > 0 ? (
                  <LineChart data={dailySubscriptionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8} 
                      tickFormatter={(value) => format(new Date(value + 'T00:00:00'), 'MMM d')} // Ensure correct date parsing for formatter
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip 
                      content={<ChartTooltipContent indicator="line" labelFormatter={(label, payload) => {
                        if (payload && payload.length && payload[0].payload.date) {
                          // Ensure date is treated as local, add T00:00:00 if only date string
                          return format(new Date(payload[0].payload.date + 'T00:00:00'), "MMMM d, yyyy");
                        }
                        return label;
                      }}/>} 
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="newSubscriptions" 
                      stroke="var(--color-newSubscriptions)" 
                      strokeWidth={2} 
                      dot={{ r: 4, fill: "var(--color-newSubscriptions)", stroke: "var(--background)" }} 
                      activeDot={{r: 6}}
                    />
                  </LineChart>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No subscription data available for the last 7 days.</p>
                  </div>
                )}
              </ChartContainer>
            </CardContent>
          </Card>

          {/* User Management Table with Filters */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" /> User Management
              </CardTitle>
              <CardDescription>View and manage user accounts. Use filters below to refine the list.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
                <Input placeholder="Filter by Name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
                <Input placeholder="Filter by Email..." value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} />
                <Select value={planFilter} onValueChange={(value: any) => setPlanFilter(value)}>
                  <SelectTrigger><SelectValue placeholder="Filter by Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="plus_unknown">Plus (Unspecified Plan)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={adminFilter} onValueChange={(value: any) => setAdminFilter(value)}>
                  <SelectTrigger><SelectValue placeholder="Filter by Admin Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="yes">Admin Only</SelectItem>
                    <SelectItem value="no">Non-Admins Only</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("justify-start text-left font-normal", !dateRangeFilter.from && !dateRangeFilter.to && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRangeFilter.from ? (
                        dateRangeFilter.to ? (
                          `${format(dateRangeFilter.from, "LLL dd, y")} - ${format(dateRangeFilter.to, "LLL dd, y")}`
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
                      selected={{ from: dateRangeFilter.from, to: dateRangeFilter.to }}
                      onSelect={(range) => setDateRangeFilter({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={clearFilters} variant="outline" className="lg:col-span-1 flex items-center gap-2">
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
                      <TableHead className="text-right">Interviews</TableHead>
                      <TableHead>Is Admin?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.uid}>
                        <TableCell className="font-medium">{u.name || "N/A"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.isPlusSubscriber ? "default" : "secondary"}>
                            {u.isPlusSubscriber 
                              ? (u.subscriptionPlan ? u.subscriptionPlan.charAt(0).toUpperCase() + u.subscriptionPlan.slice(1) : "Plus") 
                              : "Free"}
                          </Badge>
                        </TableCell>
                        <TableCell>{u.createdAt ? format(parseISO(u.createdAt), "P") : "N/A"}</TableCell>
                        <TableCell className="text-right">{u.interviewsTaken || 0}</TableCell>
                        <TableCell>
                          <Badge variant={u.isAdmin ? "destructive" : "outline"}>
                            {u.isAdmin ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredUsers.length === 0 && !isLoadingData && (
                  <p className="py-4 text-center text-muted-foreground">No users match the current filters.</p>
              )}
              {allUsersData.length === 0 && !isLoadingData && (
                <p className="py-4 text-center text-muted-foreground">No users found in the system.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
