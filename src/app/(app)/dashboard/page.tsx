
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardPage() {
  const { user, userProfile, initialLoading: authInitialLoading, loading: authLoading } = useAuth();

  // Basic loading state based on auth context
  if (authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  // If auth is resolved but no user (should be redirected by layout, but as a fallback)
  if (!user && !authInitialLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Authenticated</AlertTitle>
          <AlertDescription>
            You need to be logged in to view the dashboard.
          </AlertDescription>
        </Alert>
         <Link href="/login" className="mt-4">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }
  
  // If user is authenticated, but profile is still loading from AuthContext
  if (user && authLoading && !userProfile) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user profile...</p>
      </div>
    );
  }


  // Simplified static content
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Dashboard</CardTitle>
          <CardDescription>
            Welcome to your aiTyaari Dashboard.
            {userProfile ? ` (Profile: ${userProfile.name || 'User'})` : ' (Loading profile...)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is a simplified dashboard page for testing.</p>
          <p className="mt-2">User Email: {user?.email || "N/A"}</p>
          <div className="mt-4">
            <Link href="/interview/start" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Start New Interview
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Past Interviews Section (Static)</CardTitle>
          <CardDescription>This section is currently showing static placeholder content.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No dynamic past interview data is being fetched on this simplified page.</p>
           <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">Past interview data would appear here.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
