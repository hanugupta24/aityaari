
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, BarChartHorizontalBig, History, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import type { InterviewSession } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading, initialLoading: authInitialLoading, refreshUserProfile } = useAuth();
  const [fetchedPastInterviews, setFetchedPastInterviews] = useState<InterviewSession[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState<boolean>(false); // Default to false
  const [interviewsError, setInterviewsError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      // This refreshes the user profile data (like interviewsTaken count)
      // It doesn't directly refetch the interviews list here.
      refreshUserProfile();
    }
  }, [user, refreshUserProfile]);

  useEffect(() => {
    const fetchInterviews = async () => {
      if (!user) {
        setFetchedPastInterviews([]);
        setInterviewsLoading(false);
        setInterviewsError(null);
        return;
      }

      setInterviewsLoading(true); // Set loading to true right before the fetch attempt
      setInterviewsError(null); // Clear any previous errors

      try {
        const interviewsRef = collection(db, "users", user.uid, "interviews");
        const q = query(interviewsRef, where("status", "==", "completed"), orderBy("createdAt", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        const interviews: InterviewSession[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<InterviewSession, 'id' | 'createdAt'> & { createdAt: Timestamp | string };
          interviews.push({
            ...data,
            id: doc.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt
          } as InterviewSession);
        });
        setFetchedPastInterviews(interviews);
      } catch (error: any) {
        // Set error state first
        const errorMessage = error.message || "Failed to load past interviews. This might be due to a missing database index. Please check Firebase console if this persists.";
        setInterviewsError(errorMessage);
        console.error("Error fetching past interviews:", error); // Log the full error
        toast({
          title: "Error Loading Interviews",
          description: "Could not fetch past interview data. If this issue continues, a database index might be required. See console for details or the message on the dashboard.",
          variant: "destructive",
        });
        setFetchedPastInterviews([]); // Clear any potentially stale data
      } finally {
        setInterviewsLoading(false); // Always set loading to false after attempt
      }
    };

    // Only fetch interviews if auth is not loading and user exists
    if (!authInitialLoading && !authLoading && user) {
      fetchInterviews();
    } else if (!authInitialLoading && !authLoading && !user) {
      // No user, so not loading interviews, ensure states are reset
      setInterviewsLoading(false);
      setInterviewsError(null);
      setFetchedPastInterviews([]);
    }
  }, [user, authLoading, authInitialLoading]); // Dependency array simplified

  if (authInitialLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Could not load your user profile. Please try logging out and logging back in.
            If the problem persists, contact support.
          </AlertDescription>
        </Alert>
         <Link href="/login" className="mt-4">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }

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
          <CardDescription>Review your previous interview performance and feedback.</CardDescription>
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
                <br />
                <strong className="my-2 block">This usually means a Firestore index is required.</strong>
                <Link href="https://console.firebase.google.com/v1/r/project/tyaari-e0307/firestore/indexes?create_composite=Ck9wcm9qZWN0cy90eWFhcmktZTAzMDcvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2ludGVydmlld3MvaW5kZXhlcy9fEAEaCgoGc3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg" target="_blank" rel="noopener noreferrer" className="underline hover:text-destructive-foreground">
                  Click here to create the required Firestore index in the Firebase Console.
                </Link>
                 This process may take a few minutes to build after creation. Please ensure the index status is "Enabled".
              </AlertDescription>
            </Alert>
          ) : fetchedPastInterviews.length > 0 ? (
            <div className="space-y-4">
              {fetchedPastInterviews.map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">Interview on {new Date(interview.createdAt).toLocaleDateString()}</CardTitle>
                    <CardDescription>
                      Duration: {interview.duration} mins | Score: {interview.feedback?.overallScore !== undefined ? `${interview.feedback.overallScore}%` : "Pending"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground truncate">
                      {interview.feedback?.overallFeedback ?
                        (interview.feedback.overallFeedback.substring(0,150) + (interview.feedback.overallFeedback.length > 150 ? "..." : ""))
                        : "Feedback processing or not available."}
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
          ) : (
            <div className="text-center py-10">
              <Image
                src="https://placehold.co/300x200.png?text=No+Interviews+Yet"
                alt="No interviews"
                width={300}
                height={200}
                className="mx-auto mb-4 rounded-md"
                data-ai-hint="empty state illustration"
              />
              <p className="text-muted-foreground mb-4">You haven't completed any interviews yet, or we couldn't load them.</p>
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
