
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, BarChartHorizontalBig, History } from "lucide-react";
import Image from "next/image";

export default function DashboardPage() {
  const { userProfile } = useAuth();

  // Placeholder data for past interviews
  const pastInterviews = [
    { id: "1", date: "2024-07-15", role: "Software Engineer", score: "85%", feedbackHighlights: "Strong problem-solving skills." },
    { id: "2", date: "2024-07-10", role: "Product Manager", score: "78%", feedbackHighlights: "Good communication, needs more domain depth." },
  ];
  
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
                      {interviewsRemaining > 0 ? `${interviewsRemaining} free interviews remaining.` : "Upgrade to Plus for more."}
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
          {pastInterviews.length > 0 ? (
            <div className="space-y-4">
              {pastInterviews.map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{interview.role}</CardTitle>
                    <CardDescription>Date: {interview.date} | Score: {interview.score}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{interview.feedbackHighlights}</p>
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
                data-ai-hint="empty state"
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
