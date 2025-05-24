
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, BarChartHorizontalBig, History, Loader2 } from "lucide-react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import type { InterviewSession } from "@/types";

export default function DashboardPage() {
  const { user, userProfile, refreshUserProfile } = useAuth(); // Added refreshUserProfile
  const [fetchedPastInterviews, setFetchedPastInterviews] = useState<InterviewSession[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    // Refresh user profile to get latest interviewsTaken count when component mounts or user changes
    if (user) {
        refreshUserProfile();
    }

    const fetchInterviews = async () => {
      if (!user) {
        setFetchedPastInterviews([]);
        setInterviewsLoading(false);
        return;
      }
      setInterviewsLoading(true);
      try {
        const interviewsRef = collection(db, "users", user.uid, "interviews");
        // Query for completed interviews, ordered by creation date, limit to recent ones if needed
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
      } catch (error) {
        console.error("Error fetching past interviews:", error);
        // Optionally set an error state here
      } finally {
        setInterviewsLoading(false);
      }
    };
    
    fetchInterviews();
  }, [user, refreshUserProfile]); // Add refreshUserProfile to dependencies

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
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
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
              <p className="text-muted-foreground mb-4">You haven't completed any interviews yet.</p>
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
