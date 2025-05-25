
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart as BarChartIcon, Users, DollarSign, TrendingUp, CreditCard, Loader2, AlertTriangle, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"; // Removed ResponsiveContainer for now as ChartContainer handles it
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { UserProfile } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, subDays, startOfDay } from 'date-fns';

// Plan prices
const PLAN_PRICES = {
  monthly: 9.99,
  quarterly: 27.99,
  yearly: 99.99,
};

const chartConfig = {
  newSubscriptions: { label: "New Plus Subscriptions", color: "hsl(var(--primary))" },
} satisfies Record<string, any>;


export default function AdminPage() {
  const { user, isAdmin, initialLoading: authInitialLoading } = useAuth();
  const router = useRouter();

  const [allUsersData, setAllUsersData] = useState<UserProfile[]>([]);
  const [dailySubscriptionData, setDailySubscriptionData] = useState<Array<{ date: string; newSubscriptions: number }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

    users.forEach(u => {
      if (u.isPlusSubscriber && u.updatedAt) {
        try {
          const updatedAtDate = startOfDay(new Date(u.updatedAt));
          const formattedUpdatedAt = format(updatedAtDate, "yyyy-MM-dd");
          if (dailyCounts.hasOwnProperty(formattedUpdatedAt)) {
            dailyCounts[formattedUpdatedAt]++;
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
  };


  if (authInitialLoading || (!isAdmin && !authInitialLoading)) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!isAdmin) { 
     return <div className="flex justify-center items-center h-screen"><p>Access Denied</p></div>;
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
      estimatedMonthlyRevenue += PLAN_PRICES.quarterly / 3;
    } else if (u.subscriptionPlan === 'yearly') {
      estimatedMonthlyRevenue += PLAN_PRICES.yearly / 12;
    } else {
      // Fallback for Plus subscribers with no plan specified
      estimatedMonthlyRevenue += PLAN_PRICES.monthly; 
    }
  });

  const todayDate = new Date();
  const twentyFourHoursAgo = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
  const plusSubscriptionsToday = allUsersData.filter(u => 
    u.isPlusSubscriber && 
    u.updatedAt && 
    new Date(u.updatedAt) > twentyFourHoursAgo
  ).length;

  const totalInterviewsTaken = allUsersData.reduce((sum, u) => sum + (u.interviewsTaken || 0), 0);

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plus Subscriptions</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPlusSubscriptions}</div>
                 {unknownPlanSubscribers > 0 && <p className="text-xs text-muted-foreground">{unknownPlanSubscribers} with unspecified plan</p>}
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plus Signups (Last 24h)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plusSubscriptionsToday}</div>
                <p className="text-xs text-muted-foreground">(Based on profile update)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${estimatedMonthlyRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Interviews Taken</CardTitle>
                <BarChartIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalInterviewsTaken}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
                <CardTitle>Subscription Plan Breakdown</CardTitle>
                <CardDescription>Current number of active Plus subscribers by plan type.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                <Card className="bg-secondary/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Subscribers</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.monthly.toFixed(2)}/mo</p>
                    </CardContent>
                </Card>
                <Card className="bg-secondary/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quarterly Subscribers</CardTitle>
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{quarterlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.quarterly.toFixed(2)}/qtr</p>
                    </CardContent>
                </Card>
                <Card className="bg-secondary/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Yearly Subscribers</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{yearlySubscribers}</div>
                        <p className="text-xs text-muted-foreground">@ ${PLAN_PRICES.yearly.toFixed(2)}/yr</p>
                    </CardContent>
                </Card>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily New Plus Subscriptions (Last 7 Days)</CardTitle>
              <CardDescription>
                Count of new Plus subscriptions based on recent profile updates.
                This is an estimation and may not reflect exact sales dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                {dailySubscriptionData.length > 0 ? (
                  <LineChart data={dailySubscriptionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8} 
                      tickFormatter={(value) => format(new Date(value), 'MMM d')} 
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip 
                      content={<ChartTooltipContent indicator="line" labelFormatter={(label, payload) => {
                        if (payload && payload.length) {
                          return format(new Date(payload[0].payload.date), "MMMM d, yyyy");
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

          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage user accounts.</CardDescription>
            </CardHeader>
            <CardContent>
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
                  {allUsersData.map((u) => (
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
                      <TableCell>{u.createdAt ? format(new Date(u.createdAt), "P") : "N/A"}</TableCell>
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
               {allUsersData.length === 0 && (
                <p className="py-4 text-center text-muted-foreground">No users found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
