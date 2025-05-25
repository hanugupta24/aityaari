
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
import { Loader2, ThumbsUp, ThumbsDown, Lightbulb, MessageSquare, FileText, HelpCircle, CheckCircle, Smile, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, InterviewFeedback, DetailedQuestionFeedbackItem } from "@/types";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Helper function to determine badge variant based on score
const getScoreBadgeVariant = (score: number, maxScore: number = 10): "default" | "secondary" | "destructive" | "outline" => {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return "default"; // Greenish/Primary for high scores
  if (percentage >= 50) return "secondary"; // Yellowish/Secondary for medium
  return "destructive"; // Reddish for low scores
};


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

    const fetchFeedbackData = async () => {
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
            toast({ title: "Feedback Pending", description: "Feedback for this interview is not yet available. It might still be processing.", variant: "default" });
          } else {
             toast({ title: "Interview Not Completed", description: "This interview was not completed, so no feedback is available.", variant: "default" });
             router.push("/dashboard"); 
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

    fetchFeedbackData();
  }, [user, interviewId, router, toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session) {
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
              It might still be processing, or there was an issue generating it. Please check back later or contact support if this persists.
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
    return <div className="flex justify-center items-center h-screen"><p>No feedback available for this session.</p></div>;
  }

  const overallScorePercentage = feedback.overallScore !== undefined && feedback.overallScore !== null ? feedback.overallScore : 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6">
          <CardTitle className="text-3xl font-bold flex items-center gap-3">
            <Star className="h-8 w-8 text-primary" />
            Interview Feedback Analysis
          </CardTitle>
          <CardDescription className="text-lg">
            Detailed report for your interview on {new Date(session.createdAt).toLocaleDateString()} ({session.duration} minutes).
          </CardDescription>
        </CardHeader>
        {feedback.overallScore !== undefined && feedback.overallScore !== null && (
            <CardContent className="p-6 border-b">
                <Label className="text-lg font-semibold">Overall Interview Score: {feedback.overallScore}/100</Label>
                <Progress value={overallScorePercentage} className="w-full h-3 mt-2" />
                <p className="text-sm text-muted-foreground mt-1">
                    {overallScorePercentage >= 80 ? "Excellent performance!" : overallScorePercentage >= 60 ? "Good effort, some areas to polish." : "Needs significant improvement, keep practicing!"}
                </p>
            </CardContent>
        )}
      </Card>

      <Accordion type="multiple" collapsible className="w-full space-y-4">
        <AccordionItem value="overall-feedback" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline text-left">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Overall Impressions & Summary</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 text-muted-foreground whitespace-pre-wrap">
            {feedback.overallFeedback}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="strengths" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline text-left">
            <div className="flex items-center gap-3">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <h3 className="text-xl font-semibold">Strengths Summary</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 text-muted-foreground whitespace-pre-wrap">
            {feedback.strengthsSummary}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="weaknesses" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline text-left">
            <div className="flex items-center gap-3">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold">Weaknesses Summary</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 text-muted-foreground whitespace-pre-wrap">
            {feedback.weaknessesSummary}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="overall-improvement" className="rounded-lg border bg-card text-card-foreground shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline text-left">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
              <h3 className="text-xl font-semibold">Overall Areas for Improvement</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 text-muted-foreground whitespace-pre-wrap">
            {feedback.overallAreasForImprovement}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {feedback.detailedQuestionFeedback && feedback.detailedQuestionFeedback.length > 0 && (
        <Card className="shadow-xl mt-6">
            <CardHeader className="bg-muted/30">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                    <HelpCircle className="h-7 w-7 text-primary"/>
                    Question-by-Question Breakdown
                </CardTitle>
                <CardDescription>Detailed analysis for each question you answered.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Accordion type="multiple" collapsible className="w-full">
                    {feedback.detailedQuestionFeedback.map((item, index) => (
                        <AccordionItem key={item.questionId || index} value={`q-item-${index}`} className="border-b last:border-b-0">
                             <AccordionTrigger className="p-6 hover:no-underline text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 sm:gap-4">
                                    <span className="font-medium text-base flex-1">Q{index + 1}: {item.questionText.substring(0,100)}{item.questionText.length > 100 ? '...' : ''}</span>
                                    <Badge variant={getScoreBadgeVariant(item.score)} className="whitespace-nowrap text-sm px-3 py-1">
                                        Score: {item.score}/10
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0 space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">Your Answer:</Label>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/50 rounded-md">
                                        {item.userAnswer || <span className="italic">No answer provided.</span>}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold text-green-600 dark:text-green-400">Ideal Answer/Key Points:</Label>
                                     <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-green-500/10 rounded-md border border-green-500/20">
                                        {item.idealAnswer}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold text-amber-600 dark:text-amber-400">Refinement Suggestions:</Label>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-amber-500/10 rounded-md border border-amber-500/20">
                                        {item.refinementSuggestions}
                                    </p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
      )}
        
      {session.transcript && (
         <Accordion type="single" collapsible className="w-full mt-6">
            <AccordionItem value="full-transcript" className="rounded-lg border bg-card text-card-foreground shadow-md">
              <AccordionTrigger className="p-6 hover:no-underline text-left">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-500" />
                  <h3 className="text-xl font-semibold">Full Interview Transcript</h3>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 pt-0">
                <ScrollArea className="h-80 w-full rounded-md border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.transcript}</p>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
         </Accordion>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="lg" className="gap-2">
            <Smile className="h-5 w-5" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
