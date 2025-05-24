
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Loader2, ThumbsUp, ThumbsDown, Lightbulb, MessageSquare, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, InterviewFeedback } from "@/types";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FeedbackPage() {
  const params = useParams();
  const interviewId = params.interviewId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !interviewId) return;

    const fetchFeedback = async () => {
      setIsLoading(true);
      try {
        const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
        const docSnap = await getDoc(sessionDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as InterviewSession;
          setSession(data);
          if (data.feedback) {
            setFeedback(data.feedback);
          } else if (data.status === "completed") {
            // Feedback might still be generating or failed
            toast({ title: "Feedback Pending", description: "Feedback for this interview is not yet available or failed to generate.", variant: "default" });
          } else {
             toast({ title: "Interview Not Completed", description: "This interview was not completed, so no feedback is available.", variant: "default" });
             router.push("/dashboard"); // Redirect if interview not completed
          }
        } else {
          toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Error fetching feedback:", error);
        toast({ title: "Error", description: "Could not load interview feedback.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [user, interviewId, router, toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session) {
    // This case should be handled by redirect in useEffect, but as a fallback:
    return <div className="flex justify-center items-center h-screen"><p>Interview session not found.</p></div>;
  }
  
  if (!feedback && session.status === "completed") {
     return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Feedback Not Available</CardTitle>
            <CardDescription>
              Feedback for interview on {new Date(session.createdAt).toLocaleDateString()} (ID: {session.id.substring(0,6)}...) is currently unavailable.
              It might still be processing, or there was an issue generating it. Please check back later.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!feedback) {
     // Should have been redirected or handled above if session completed
    return <div className="flex justify-center items-center h-screen"><p>No feedback available for this session.</p></div>;
  }


  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Interview Feedback</CardTitle>
          <CardDescription>
            Detailed analysis of your interview on {new Date(session.createdAt).toLocaleDateString()} for {session.duration} minutes.
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
        <AccordionItem value="item-1" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Overall Performance</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0">
            <p className="text-muted-foreground whitespace-pre-wrap">{feedback.overallFeedback}</p>
            {feedback.overallScore && (
                 <div className="mt-4">
                    <Label>Overall Score: {feedback.overallScore}/100</Label>
                    {/* Basic progress bar, can be replaced with shadcn/ui Progress if available and styled */}
                    <div className="w-full bg-muted rounded-full h-2.5 mt-1">
                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${feedback.overallScore}%` }}></div>
                    </div>
                </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <h3 className="text-xl font-semibold">Correct Answers / Strengths</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0">
            <p className="text-muted-foreground whitespace-pre-wrap">{feedback.correctAnswersSummary}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold">Incorrect Answers / Weaknesses</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0">
            <p className="text-muted-foreground whitespace-pre-wrap">{feedback.incorrectAnswersSummary}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
              <h3 className="text-xl font-semibold">Areas for Improvement</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0">
            <p className="text-muted-foreground whitespace-pre-wrap">{feedback.areasForImprovement}</p>
          </AccordionContent>
        </AccordionItem>
        
        {session.transcript && (
           <AccordionItem value="item-5" className="rounded-lg border bg-card text-card-foreground shadow-md">
            <AccordionTrigger className="p-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <h3 className="text-xl font-semibold">Full Transcript</h3>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 pt-0">
              <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.transcript}</p>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <div className="mt-8 flex justify-center">
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="lg">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
