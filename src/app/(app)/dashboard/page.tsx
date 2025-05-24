
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, BarChartHorizontalBig, History, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
// import { db } from "@/lib/firebase"; // No longer needed for static data
// import { collection, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore"; // No longer needed
import type { InterviewSession } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// Mock data for past interviews
const mockPastInterviews: InterviewSession[] = [
  {
    id: "mock1",
    userId: "mockUser",
    duration: 30,
    status: "completed",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    questions: [
      { id: "q1", text: "Tell me about yourself.", stage: "oral", type: "conversational", answer: "I am a..." },
      { id: "q2", text: "Why this role?", stage: "oral", type: "conversational", answer: "Because..." },
    ],
    feedback: {
      overallScore: 85,
      overallFeedback: "Good performance overall, clear communication.",
      correctAnswersSummary: "Answered behavioral questions well.",
      incorrectAnswersSummary: "Could elaborate more on technical examples.",
      areasForImprovement: "Practice STAR method for technical scenarios.",
    },
    transcript: "AI: Tell me about yourself.\\nYou: I am a...\\nAI: Why this role?\\nYou: Because..."
  },
  {
    id: "mock2",
    userId: "mockUser",
    duration: 15,
    status: "completed",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    questions: [
       { id: "q1", text: "Describe a challenging project.", stage: "oral", type: "behavioral", answer: "It was..." },
    ],
    feedback: {
      overallScore: 78,
      overallFeedback: "Solid answers, good examples provided.",
      correctAnswersSummary: "Provided a good example for the challenge.",
      incorrectAnswersSummary: "A bit hesitant at the start.",
      areasForImprovement: "Speak with more confidence.",
    },
  },
];


export default function DashboardPage() {
  const { user, userProfile, loading: authLoading, initialLoading: authInitialLoading, refreshUserProfile } = useAuth();
  const [fetchedPastInterviews, setFetchedPastInterviews] = useState<InterviewSession[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState<boolean>(false);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);
  const { toast } = useToast();

  console.log("DashboardPage: authInitialLoading:", authInitialLoading, "authLoading (profile fetch):", authLoading, "user:", !!user, "userProfile:", !!userProfile);

  useEffect(() => {
    // This effect is for refreshing the user profile if the user object is available
    // and user.uid specifically, to avoid re-runs if user object identity changes but uid is same
    if (user?.uid) {
      console.log("DashboardPage: User detected, attempting to refresh profile once on mount if needed.");
      refreshUserProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]); // refreshUserProfile is memoized, user.uid ensures it runs when actual user identity changes

  // UseEffect to set static mock data for past interviews
  // useEffect(() => {
  //   console.log("DashboardPage: Setting mock past interviews data.");
  //   setInterviewsLoading(true);
  //   const timer = setTimeout(() => {
  //     setFetchedPastInterviews(mockPastInterviews);
  //     setInterviewsLoading(false);
  //     setInterviewsError(null);
  //     console.log("DashboardPage: Mock past interviews data set.");
  //   }, 300); // Reduced delay for mock data

  //   return () => clearTimeout(timer);
  // }, []);


  if (authInitialLoading) {
    console.log("DashboardPage: Rendering initial auth loading state.");
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  // After initial auth, check if user object exists.
  // authLoading refers to the profile fetching state.
  if (!user) {
    console.log("DashboardPage: No user authenticated after initial load. Showing auth error.");
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>
            Could not verify your login status. Please try logging out and logging back in.
          </AlertDescription>
        </Alert>
         <Link href="/login" className="mt-4">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }

  // User is authenticated, now check if profile is loading or failed to load
  if (authLoading) { // This 'authLoading' is specifically for the profile fetch
    console.log("DashboardPage: User authenticated, profile is loading.");
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  if (!userProfile) {
    console.log("DashboardPage: User authenticated, but profile not loaded. Showing profile error.");
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile Loading Error</AlertTitle>
          <AlertDescription>
            Could not load your user profile. This might be due to a connection issue or if the profile hasn't been created yet.
            Please ensure your internet connection is stable and Firebase services are correctly configured for this project.
            You can try to <Button variant="link" className="p-0 h-auto inline" onClick={refreshUserProfile}>refresh</Button> or
            <Link href="/profile" className="font-semibold underline hover:text-destructive-foreground/80 mx-1">visit your profile page</Link> to create/update it.
            If the problem persists, contact support.
          </AlertDescription>
        </Alert>
         <Link href="/login" className="mt-4"> {/* Changed to /login, implies re-auth might help */}
          <Button variant="outline">Logout and Login Again</Button>
        </Link>
      </div>
    );
  }

  // If we reach here, user and userProfile are loaded.
  console.log("DashboardPage: Rendering main content with userProfile:", userProfile);
  const interviewsRemaining = userProfile ? Math.max(0, 3 - (userProfile.interviewsTaken || 0)) : 3;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, {userProfile?.name || "User"}!</CardTitle>
          <CardDescription>Here's an overview of your interview preparation journey.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Interviews Taken</CardTitle>
                    <BarChartHorizontalBig className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userProfile?.interviewsTaken || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {userProfile?.isPlusSubscriber ? "Unlimited interviews." : (interviewsRemaining > 0 ? `${interviewsRemaining} free interviews remaining.` : "Upgrade to Plus for more.")}
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Subscription Status</CardTitle>
                    <PlusCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userProfile?.isPlusSubscriber ? "Plus Member" : "Free Tier"}</div>
                     <p className="text-xs text-muted-foreground">
                      {userProfile?.isPlusSubscriber ? "Unlimited interviews & features." : "3 free interviews included."}
                    </p>
                </CardContent>
            </Card>
        </CardContent>
        <CardFooter>
          <Link href="/interview/start" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Start New Interview
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <History className="h-5 w-5" /> Past Interviews
          </CardTitle>
          <CardDescription>Review your previous interview performance and feedback. (Displaying static mock data)</CardDescription>
        </CardHeader>
        <CardContent>
          {interviewsLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Loading past interviews...</p>
            </div>
          ) : interviewsError ? ( 
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to Load Past Interviews</AlertTitle>
              <AlertDescription>
                {interviewsError}
                This app is currently configured to show static mock data for past interviews. If you are expecting live data, please check the Firestore setup and code.
              </AlertDescription>
            </Alert>
          ) :
          fetchedPastInterviews.length > 0 ? (
            <div className="space-y-4">
              {fetchedPastInterviews.map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">Interview on {new Date(interview.createdAt).toLocaleDateString()}</CardTitle>
                    <CardDescription>
                      Duration: {interview.duration} mins | Score: {interview.feedback?.overallScore !== undefined ? `${interview.feedback.overallScore}%` : "N/A"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground truncate">
                      {interview.feedback?.overallFeedback ?
                        (interview.feedback.overallFeedback.substring(0,150) + (interview.feedback.overallFeedback.length > 150 ? "..." : ""))
                        : "Feedback not available for mock data."}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/feedback/${interview.id}`} passHref>
                      <Button variant="outline" size="sm">View Detailed Feedback</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) :  (
            <div className="text-center py-10">
              <Image
                src="https://placehold.co/300x200.png?text=No+Interviews+Yet"
                alt="No interviews"
                width={300}
                height={200}
                className="mx-auto mb-4 rounded-md"
                data-ai-hint="empty state illustration"
              />
              <p className="text-muted-foreground mb-4">You haven't completed any interviews yet (or showing static data).</p>
              <Link href="/interview/start" passHref>
                <Button>Start Your First Interview</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

