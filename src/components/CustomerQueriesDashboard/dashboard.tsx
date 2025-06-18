// DashboardPage.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const statusTabs = ["all", "pending", "in-progress", "resolved"];

const DashboardPage = () => {
  const [queries, setQueries] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchQueries = async () => {
      const querySnapshot = await getDocs(collection(db, "contact-queries"));
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQueries(data);
    };
    fetchQueries();
  }, []);

  const filteredQueries = queries
    .filter((q) => (statusFilter === "all" ? true : q.status === statusFilter))
    .filter((q) => q.name.toLowerCase().includes(searchName.toLowerCase()))
    .filter((q) => q.email.toLowerCase().includes(searchEmail.toLowerCase()));

  const chartData = [
    {
      name: "Pending",
      value: queries.filter((q) => q.status === "pending").length,
    },
    {
      name: "In Progress",
      value: queries.filter((q) => q.status === "in-progress").length,
    },
    {
      name: "Resolved",
      value: queries.filter((q) => q.status === "resolved").length,
    },
  ];

  const barChartData = Object.values(
    queries.reduce((acc: any, q) => {
      acc[q.name] = acc[q.name] || { name: q.name, queries: 0 };
      acc[q.name].queries += 1;
      return acc;
    }, {})
  );

  return (
    <div className="p-4 md:p-6 lg:p-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">
          Customer Support Dashboard
        </h1>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Filter by name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="max-w-sm"
        />
        <Input
          placeholder="Filter by email"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Customer Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All Customer Queries ({filteredQueries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-muted">
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Message</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueries.map((q) => (
                <tr key={q.id} className="border-b border-muted">
                  <td className="py-2">{q.name}</td>
                  <td className="py-2">{q.email}</td>
                  <td className="py-2">{q.message}</td>
                  <td className="py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge
                          className={cn("capitalize cursor-pointer", {
                            "bg-yellow-500 text-black": q.status === "pending",
                            "bg-blue-500 text-white":
                              q.status === "in-progress",
                            "bg-green-600 text-white": q.status === "resolved",
                          })}
                        >
                          {q.status}
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {["pending", "in-progress", "resolved"].map(
                          (statusOption) => (
                            <DropdownMenuItem
                              key={statusOption}
                              onSelect={async () => {
                                if (statusOption !== q.status) {
                                  const { updateDoc, doc } = await import(
                                    "firebase/firestore"
                                  );
                                  const docRef = doc(
                                    db,
                                    "contact-queries",
                                    q.id
                                  );
                                  await updateDoc(docRef, {
                                    status: statusOption,
                                    resolvedBy:
                                      statusOption === "resolved"
                                        ? userProfile?.roles?.[0]
                                        : null,
                                  });

                                  // update local state
                                  setQueries((prev) =>
                                    prev.map((item) =>
                                      item.id === q.id
                                        ? { ...item, status: statusOption }
                                        : item
                                    )
                                  );
                                }
                              }}
                            >
                              {statusOption.charAt(0).toUpperCase() +
                                statusOption.slice(1)}
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {q.status === "resolved" && q.resolvedBy && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        by {q.resolvedBy}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Query Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Queries per Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="queries" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
