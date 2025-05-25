
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Loader2, AlertTriangle, ListChecks, User, DatabaseZap, ExternalLink, ShieldCheck, TrendingUp, Sparkles, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterviewSession } from "@/types";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const FREE_INTERVIEW_LIMIT = 3;

function InterviewsErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;

  const isIndexError = error.includes("query requires an index");
  const indexCreationLinkMatch = error.match(/https:\/\/console\.firebase\.google\.com\/[^)]+/);
  const indexCreationLink = indexCreationLinkMatch ? indexCreationLinkMatch[0] : null;


  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error Loading Past Interviews</AlertTitle>
      <AlertDescription>
        Could not fetch your past interview data. {error}
        {isIndexError && indexCreationLink && (
          <p className="mt-2">
            This typically means a required database index is missing. Please
            <a
              href={indexCreationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-destructive-foreground/80 ml-1"
            >
              click here to create the index <ExternalLink className="inline-block h-3 w-3 ml-0.5" />
            </a>
            in your Firebase console. It might take a few minutes for the index to build.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}


export default function DashboardPage() {
  const { user, userProfile, initialLoading: authInitialLoading, loading: authLoading, refreshUserProfile } = useAuth();
  const { toast } = useToast();

  const [fetchedPastInterviews, setFetchedPastInterviews] = useState<InterviewSession[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);


  const fetchInterviews = useCallback(async () => {
    if (!user) {
      console.log("DashboardPage: No user, clearing past interviews and stopping loader.");
      setFetchedPastInterviews([]);
      setInterviewsLoading(false); 
      setInterviewsError(null);
      return;
    }

    console.log("DashboardPage: User available, attempting to fetch past interviews.");
    setInterviewsLoading(true);
    setInterviewsError(null);

    try {
      const interviewsRef = collection(db, "users", user.uid, "interviews");
      const q = query(interviewsRef, where("status", "==", "completed"), orderBy("createdAt", "desc"), limit(10));
      const querySnapshot = await getDocs(q);
      const interviewsData: InterviewSession[] = [];
      querySnapshot.forEach((doc) => {
        interviewsData.push({ id: doc.id, ...doc.data() } as InterviewSession);
      });
      setFetchedPastInterviews(interviewsData);
      console.log("DashboardPage: Successfully fetched interviews:", interviewsData.length);
    } catch (error: any) {
      console.error("DashboardPage: Error fetching past interviews:", error);
      const errorMessage = error.message || "An unknown error occurred while fetching interviews.";
      setInterviewsError(errorMessage);
      toast({
        title: "Error Loading Interviews",
        description: errorMessage,
        variant: "destructive",
      });
      setFetchedPastInterviews([]); 
    } finally {
      console.log("DashboardPage: Finished fetching interviews, setting interviewsLoading to false.");
      setInterviewsLoading(false);
    }
  }, [user, toast]); 

  useEffect(() => {
    if (!authInitialLoading && user) {
        fetchInterviews();
    } else if (!authInitialLoading && !user) {
        setInterviewsLoading(false);
        setFetchedPastInterviews([]);
        setInterviewsError(null);
    }
  }, [user, authInitialLoading, fetchInterviews]);


  if (authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!user && !authInitialLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Authenticated</AlertTitle>
          <AlertDescription>
            You need to be logged in to view the dashboard. Please
            <Link href="/login" className="font-semibold underline hover:text-destructive-foreground/80 ml-1">login</Link>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (user && (authLoading || (!userProfile && !authInitialLoading && !authLoading))) {
     const message = authLoading ? "Loading user profile..." : "Could not load your user profile. Please try refreshing or check your profile settings.";
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
  
  const interviewsTaken = userProfile?.interviewsTaken || 0;
  const remainingFreeInterviews = FREE_INTERVIEW_LIMIT - interviewsTaken;

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

      {userProfile && !userProfile.isPlusSubscriber && (
        <>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <TrendingUp className="mr-3 h-6 w-6 text-primary" />
                Your Free Interview Credits
              </CardTitle>
              <CardDescription>Track your usage of free interview sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2">You have used <span className="font-semibold">{interviewsTaken}</span> of your <span className="font-semibold">{FREE_INTERVIEW_LIMIT}</span> free interviews.</p>
              <Progress value={(interviewsTaken / FREE_INTERVIEW_LIMIT) * 100} className="mb-2 h-3" />
              {remainingFreeInterviews > 0 ? (
                <p className="text-sm text-muted-foreground">You have <span className="font-semibold text-green-600 dark:text-green-400">{remainingFreeInterviews}</span> free {remainingFreeInterviews === 1 ? 'interview' : 'interviews'} remaining.</p>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">You've used all your free interviews. Upgrade to Plus for unlimited access!</p>
              )}
            </CardContent>
            {remainingFreeInterviews <= 0 && (
              <CardFooter>
                  <Link href="/subscription" passHref>
                      <Button variant="default">
                          <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Plus
                      </Button>
                  </Link>
              </CardFooter>
            )}
          </Card>
          
          <Card className="shadow-md bg-gradient-to-br from-primary/10 via-background to-background dark:from-primary/20">
              <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                  <ShieldCheck className="mr-3 h-6 w-6 text-primary" />
                  Unlock Your Full Potential with Plus!
                  </CardTitle>
                  <CardDescription>Go unlimited and access exclusive features to supercharge your preparation.</CardDescription>
              </CardHeader>
              <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                      <li><span className="font-semibold text-foreground">Unlimited</span> interview sessions.</li>
                      <li>Access to <span className="font-semibold text-foreground">all question types</span> and difficulties.</li>
                      <li>More <span className="font-semibold text-foreground">detailed performance analytics</span> (coming soon).</li>
                      <li>Priority <span className="font-semibold text-foreground">AI model access</span> for faster responses.</li>
                  </ul>
              </CardContent>
              <CardFooter>
                  <Link href="/subscription" passHref>
                      <Button size="lg">
                          <Sparkles className="mr-2 h-5 w-5" /> Upgrade to aiTyaari Plus
                      </Button>
                  </Link>
              </CardFooter>
          </Card>
        </>
      )}
      
      {userProfile?.isPlusSubscriber && (
         <Card className="shadow-md bg-gradient-to-br from-green-500/10 via-background to-background dark:from-green-600/20 border-green-500/30">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <CheckCircle className="mr-1 h-7 w-7 text-green-600 dark:text-green-400" />
                  You are an aiTyaari Plus Member!
                </CardTitle>
                <CardDescription>Enjoy unlimited access to all features and prepare without limits.</CardDescription>
            </CardHeader>
            <CardContent>
                 <p className="text-sm text-muted-foreground">Thank you for being a Plus subscriber. You have unlimited interview sessions and access to all current and upcoming premium features.</p>
            </CardContent>
            {/* Optionally add a link to manage subscription if that page exists 
            <CardFooter>
                 <Link href="/manage-subscription" passHref>
                    <Button variant="outline" size="sm">Manage Subscription</Button>
                 </Link>
            </CardFooter>
            */}
        </Card>
      )}


      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <ListChecks className="mr-3 h-6 w-6 text-primary" />
            Past Interviews
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
          {!interviewsLoading && interviewsError && (
             <InterviewsErrorAlert error={interviewsError} />
          )}
          {!interviewsLoading && !interviewsError && fetchedPastInterviews.length === 0 && (
            <div className="text-center py-10">
              <DatabaseZap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">You haven't completed any interviews yet.</p>
              <p className="text-xs text-muted-foreground mb-4">Once you complete an interview, it will appear here.</p>
              <Link href="/interview/start" passHref>
                <Button variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" /> Start Your First Interview
                </Button>
              </Link>
            </div>
          )}
          {!interviewsLoading && !interviewsError && fetchedPastInterviews.length > 0 && (
            <div className="space-y-4">
              {fetchedPastInterviews.map((session) => (
                <Card key={session.id} className="bg-secondary/50 dark:bg-secondary/30 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">Interview on {new Date(session.createdAt).toLocaleDateString()}</CardTitle>
                    <CardDescription>Duration: {session.duration} minutes. Status: {session.status}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Feedback: {(session.feedback?.overallFeedback?.substring(0, 100) || "Feedback pending...") + (session.feedback?.overallFeedback && session.feedback.overallFeedback.length > 100 ? "..." : "")}
                    </p>
                     {session.feedback?.overallScore !== undefined && session.feedback.overallScore !== null && (
                        <p className="text-sm font-semibold mt-1">Score: {session.feedback.overallScore}/100</p>
                     )}
                  </CardContent>
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
}
