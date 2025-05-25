
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart as BarChartIcon, Users, DollarSign, Activity, CreditCard, Loader2, AlertTriangle, TrendingUp, Package, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { UserProfile } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Plan prices
const PLAN_PRICES = {
  monthly: 9.99,
  quarterly: 27.99,
  yearly: 99.99,
};

// Mock data for sales chart (remains mock)
const mockSalesData = [
  { date: "2024-07-01", sales: 150 }, { date: "2024-07-02", sales: 200 }, { date: "2024-07-03", sales: 120 },
  { date: "2024-07-04", sales: 250 }, { date: "2024-07-05", sales: 180 }, { date: "2024-07-06", sales: 300 },
  { date: "2024-07-07", sales: 220 },
];

const chartConfig = {
  sales: { label: "Sales ($)", color: "hsl(var(--primary))" },
} satisfies Record<string, any>;


export default function AdminPage() {
  const { user, isAdmin, initialLoading: authInitialLoading } = useAuth();
  const router = useRouter();

  const [allUsersData, setAllUsersData] = useState<UserProfile[]>([]);
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

  if (authInitialLoading || (!isAdmin && !authInitialLoading)) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!isAdmin) { 
     return <div className="flex justify-center items-center h-screen"><p>Access Denied</p></div>;
  }

  // Calculate dynamic statistics
  const totalUsers = allUsersData.length;
  const plusSubscribers = allUsersData.filter(u => u.isPlusSubscriber);
  const totalPlusSubscriptions = plusSubscribers.length;

  const monthlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'monthly').length;
  const quarterlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'quarterly').length;
  const yearlySubscribers = plusSubscribers.filter(u => u.subscriptionPlan === 'yearly').length;
  const unknownPlanSubscribers = plusSubscribers.filter(u => !u.subscriptionPlan).length;


  let estimatedMonthlyRevenue = 0;
  plusSubscribers.forEach(u => {
    if (u.subscriptionPlan === 'monthly') {
      estimatedMonthlyRevenue += PLAN_PRICES.monthly;
    } else if (u.subscriptionPlan === 'quarterly') {
      estimatedMonthlyRevenue += PLAN_PRICES.quarterly / 3;
    } else if (u.subscriptionPlan === 'yearly') {
      estimatedMonthlyRevenue += PLAN_PRICES.yearly / 12;
    } else {
      // Fallback for Plus subscribers with no plan specified (e.g., older data)
      estimatedMonthlyRevenue += PLAN_PRICES.monthly; 
    }
  });


  const today = new Date();
  const twentyFourHoursAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
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
                <CardTitle className="text-sm font-medium">Plus Signups Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plusSubscriptionsToday}</div>
                <p className="text-xs text-muted-foreground">(Estimated based on profile update)</p>
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
              <CardTitle>Daily Plus Subscription Sales (Mock Data)</CardTitle>
              <CardDescription>
                Sales trends for the last 7 days. This chart currently uses mock data.
                Dynamic daily sales tracking requires a dedicated subscription event data model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={mockSalesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} dot={false} />
                </LineChart>
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
                      <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}</TableCell>
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

