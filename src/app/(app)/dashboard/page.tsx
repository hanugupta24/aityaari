
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Loader2, AlertTriangle, ListChecks, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterviewSession } from "@/types"; // For mock data type
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { user, userProfile, initialLoading: authInitialLoading, loading: authLoading } = useAuth();

  // Mock data for Past Interviews - keeping this static for now
  const [mockPastInterviews, setMockPastInterviews] = useState<InterviewSession[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(false); // Keep this for consistency, though data is static

  useEffect(() => {
    // Simulate fetching static data
    setInterviewsLoading(true);
    setTimeout(() => {
      setMockPastInterviews([
        {
          id: "mock1",
          userId: user?.uid || "mockUser",
          status: "completed",
          duration: 30,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          questions: [{ id: "q1", text: "Mock Question 1", stage: "oral", type: "behavioral" }],
          feedback: {
            overallFeedback: "Good job on the mock interview!",
            correctAnswersSummary: "Answered well.",
            incorrectAnswersSummary: "Minor points to improve.",
            areasForImprovement: "Practice more.",
            overallScore: 85,
          },
        },
        {
          id: "mock2",
          userId: user?.uid || "mockUser",
          status: "completed",
          duration: 15,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          questions: [{ id: "q1", text: "Another Mock Question", stage: "oral", type: "conversational" }],
          feedback: {
            overallFeedback: "Solid performance.",
            correctAnswersSummary: "Clear communication.",
            incorrectAnswersSummary: "Could elaborate more on examples.",
            areasForImprovement: "More STAR method.",
            overallScore: 78,
          },
        },
      ]);
      setInterviewsLoading(false);
    }, 500); // Simulate network delay
  }, [user]);


  // Enhanced Loading States for Auth
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
     console.log("DashboardPage: Auth resolved, no user. Showing not authenticated message.");
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
  // OR if profile failed to load (userProfile is null after authLoading is false)
  if (user && (authLoading || (!userProfile && !authInitialLoading && !authLoading))) {
     console.log(`DashboardPage: User authenticated. AuthLoading: ${authLoading}, UserProfile Exists: ${!!userProfile}, InitialLoading: ${authInitialLoading}`);
     const message = authLoading ? "Loading user profile..." : "Could not load your user profile. Please try again later or contact support.";
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{message}</p>
        {!authLoading && !userProfile && (
          <Link href="/profile" className="mt-4">
            <Button variant="outline">Go to Profile</Button>
          </Link>
        )}
      </div>
    );
  }
  
  // Main dashboard content
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <User className="mr-3 h-7 w-7 text-primary" />
            Welcome to your aiTyaari Dashboard
          </CardTitle>
          <CardDescription>
            {userProfile ? `Hello, ${userProfile.name || user.email || 'User'}!` : 'Loading your details...'} 
            Manage your interview preparations and track your progress here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Ready to ace your next interview? Start a new practice session now.</p>
          <Link href="/interview/start" passHref>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Start New Interview
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <ListChecks className="mr-3 h-6 w-6 text-primary" />
            Past Interviews (Static Data)
          </CardTitle>
          <CardDescription>Review your performance in previous mock interview sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {interviewsLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading past interviews...</p>
            </div>
          )}
          {!interviewsLoading && mockPastInterviews.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">You haven't completed any interviews yet.</p>
              <Link href="/interview/start" passHref>
                <Button variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" /> Start Your First Interview
                </Button>
              </Link>
            </div>
          )}
          {!interviewsLoading && mockPastInterviews.length > 0 && (
            <div className="space-y-4">
              {mockPastInterviews.map((session) => (
                <Card key={session.id} className="bg-secondary/50 dark:bg-secondary/30">
                  <CardHeader>
                    <CardTitle className="text-lg">Interview on {new Date(session.createdAt).toLocaleDateString()}</CardTitle>
                    <CardDescription>Duration: {session.duration} minutes. Status: {session.status}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Link href={`/feedback/${session.id}`} passHref>
                      <Button variant="ghost" className="text-primary hover:text-primary/80">
                        View Detailed Feedback
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

    