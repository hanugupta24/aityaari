
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, MessageCircle, Terminal, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, GeneratedQuestion, UserProfile } from "@/types";
import { analyzeInterviewFeedback, type AnalyzeInterviewFeedbackInput } from "@/ai/flows/analyze-interview-feedback";

// Helper to manage questions with their answers
interface AnsweredQuestion extends GeneratedQuestion {
  answer?: string;
}

export default function InterviewPage() {
  const params = useParams();
  const interviewId = params.interviewId as string;
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [allQuestions, setAllQuestions] = useState<AnsweredQuestion[]>([]);
  const [currentStage, setCurrentStage] = useState<'oral' | 'technical_written' | 'completed'>('oral');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Overall index in allQuestions
  
  const [userAnswer, setUserAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false); // For AI thinking or next question logic
  const [isEndingInterview, setIsEndingInterview] = useState(false); // For final submission
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    console.log("Media tracks stopped.");
  }, []);

  // Effect to fetch initial session data and setup video
  useEffect(() => {
    if (!user || !interviewId) return;

    const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
    
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as InterviewSession;
        setSession(data);

        if (data.status === "completed" || data.status === "cancelled") {
          toast({ title: "Interview Ended", description: "This interview session is no longer active."});
          stopMediaTracks();
          router.push("/dashboard");
          return;
        }
        
        if (data.questions && data.questions.length > 0) {
          setAllQuestions(data.questions.map(q => ({...q, answer: ""}))); // Initialize with empty answers
          // Determine initial stage based on first question, or default to oral
          setCurrentStage(data.questions[0]?.stage || 'oral');
        } else {
          toast({ title: "Error", description: "No questions found for this session.", variant: "destructive" });
          stopMediaTracks();
          router.push("/interview/start"); // Or dashboard
        }
      } else {
        toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
        stopMediaTracks();
        router.push("/dashboard");
      }
      setIsLoading(false);
    });

    // Setup camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Failed to get media stream:", err);
        toast({ title: "Media Error", description: "Could not access camera/microphone. Please check permissions.", variant: "destructive" });
        // Optionally, disable interview functionality if media is essential
      });
    
    return () => {
      unsubscribe();
      stopMediaTracks();
    };
  }, [user, interviewId, router, toast, stopMediaTracks]);


  const handleNextQuestion = async () => {
    if (!session || !allQuestions.length || currentQuestionIndex >= allQuestions.length) return;
    
    setIsSubmittingAnswer(true);

    // Record answer for the current question
    const updatedQuestions = [...allQuestions];
    updatedQuestions[currentQuestionIndex] = { ...updatedQuestions[currentQuestionIndex], answer: userAnswer };
    setAllQuestions(updatedQuestions);

    // Add to transcript
    const currentQ = updatedQuestions[currentQuestionIndex];
    setTranscript(prev => [...prev, `AI (${currentQ.stage}): ${currentQ.text}`, `You: ${userAnswer}`]);
    setUserAnswer("");

    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setCurrentStage(allQuestions[nextQuestionIndex].stage); // Update stage based on next question
    } else {
      // This was the last question
      setCurrentStage('completed'); // Mark as completed to trigger end interview logic or UI change
      await handleEndInterview(updatedQuestions, transcript.join('\n') + `\nAI (${currentQ.stage}): ${currentQ.text}\nYou: ${userAnswer}`);
    }
    setIsSubmittingAnswer(false);
  };

  const handleEndInterview = async (finalQuestionsData: AnsweredQuestion[], finalTranscript: string) => {
    if (!user || !interviewId || !session || !userProfile) {
      toast({ title: "Error", description: "User or session data missing.", variant: "destructive" });
      return;
    }
    setIsEndingInterview(true);
    toast({ title: "Interview Complete", description: "Finalizing and analyzing your feedback..." });

    stopMediaTracks(); // Ensure media is stopped

    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      
      // Map finalQuestionsData to store in Firestore (remove temporary UI fields if any)
      const questionsToStore = finalQuestionsData.map(({ ...q }) => q as GeneratedQuestion);

      await updateDoc(sessionDocRef, {
        status: "completed",
        questions: questionsToStore, 
        transcript: finalTranscript,
        updatedAt: new Date().toISOString(),
      });

      // Increment interviewsTaken
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
      });
      await refreshUserProfile(); // Refresh profile in context
      
      // Call GenAI flow for feedback analysis
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        interviewTranscript: finalTranscript,
        jobDescription: userProfile.role || "General Role", 
        candidateProfile: `Field: ${userProfile.profileField}, Education: ${userProfile.education}`,
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("Error ending interview / getting feedback:", error);
      toast({ title: "Error Finalizing Interview", description: error.message || "Failed to finalize interview or get feedback.", variant: "destructive" });
      setIsEndingInterview(false); // Allow retry or manual navigation if stuck
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session || !allQuestions.length || currentQuestionIndex >= allQuestions.length && currentStage !== 'completed') {
     // This case might happen if questions didn't load or index is out of bounds before completion
    return (
      <div className="flex flex-col justify-center items-center h-screen p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Interview</AlertTitle>
          <AlertDescription>
            There was an issue loading the interview questions or session data. Please try returning to the dashboard.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }
  
  const currentQuestion = allQuestions[currentQuestionIndex];
  const totalQuestions = allQuestions.length;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-var(--header-height,4rem))] gap-4 p-4">
      {/* Video and Transcript Area */}
      <div className="lg:w-1/3 flex flex-col gap-4">
        <Card className="flex-shrink-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Your Video</CardTitle>
          </CardHeader>
          <CardContent>
            <video ref={videoRef} autoPlay muted className="w-full aspect-video rounded-md bg-muted object-cover" data-ai-hint="video feed"></video>
          </CardContent>
        </Card>
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto space-y-2 p-2 bg-muted/50 rounded-b-md">
            {transcript.map((line, index) => (
              <p key={index} className={`text-sm p-2 rounded-md ${line.startsWith("AI") ? "bg-secondary text-secondary-foreground self-start mr-auto max-w-[90%]" : "bg-primary text-primary-foreground self-end ml-auto max-w-[90%]"}`}>
                {line}
              </p>
            ))}
             {isSubmittingAnswer && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
          </CardContent>
        </Card>
      </div>

      {/* Question and Answer Area */}
      <div className="lg:w-2/3 flex flex-col">
       {currentStage !== 'completed' && currentQuestion ? (
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">
              Stage: {currentQuestion.stage === 'oral' ? 'Oral Question' : 'Technical Question'} ({currentQuestionIndex + 1} of {totalQuestions})
            </CardTitle>
            <CardDescription className="text-lg pt-2 whitespace-pre-wrap">{currentQuestion.text}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            {currentQuestion.stage === "oral" ? (
              <div className="flex-grow flex flex-col justify-end">
                <Textarea
                  placeholder="You can type your answer here if needed, or focus on speaking..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="text-base min-h-[100px] mb-4"
                  disabled={isSubmittingAnswer || isEndingInterview}
                />
                 <div className="flex gap-2">
                    {/* The Mic button is a placeholder for STT functionality */}
                    <Button variant="outline" onClick={() => toast({title: "Feature Coming Soon", description: "Speech-to-text is planned for future updates."})} disabled={isSubmittingAnswer || isEndingInterview}>
                      <Mic className="mr-2 h-4 w-4" /> Speak (Preview)
                    </Button>
                </div>
              </div>
            ) : ( // technical_written stage (includes 'coding' or 'technical' types)
               <div className="flex-grow flex flex-col">
                <p className="text-sm text-muted-foreground mb-2">
                  {currentQuestion.type === 'coding' ? "Use the editor below to write your code. Explain your approach if prompted." : "Provide your detailed answer below."}
                </p>
                <Textarea 
                  placeholder={currentQuestion.type === 'coding' ? "// Your code here..." : "Your detailed answer..."}
                  className="flex-grow font-mono text-sm min-h-[200px]"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)} 
                  disabled={isSubmittingAnswer || isEndingInterview}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-between items-center">
             <p className="text-sm text-muted-foreground">Interview Duration: {session.duration} mins</p>
            <div>
              {currentQuestionIndex < totalQuestions -1 ? (
                <Button onClick={handleNextQuestion} disabled={isSubmittingAnswer || isEndingInterview || !userAnswer.trim()}>
                  {isSubmittingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                  Next Question
                </Button>
              ) : (
                <Button 
                  onClick={() => handleEndInterview(allQuestions, transcript.join('\n') + `\nAI (${currentQuestion.stage}): ${currentQuestion.text}\nYou: ${userAnswer}`)} 
                  disabled={isSubmittingAnswer || isEndingInterview || !userAnswer.trim()} 
                  variant="destructive"
                >
                  {isEndingInterview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  End Interview & Get Feedback
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
         ) : (
          <Card className="flex-grow flex flex-col shadow-lg items-center justify-center">
            <CardHeader>
              <CardTitle className="text-2xl">Interview Session Ended</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Your interview responses are being processed.</p>
              {isEndingInterview && <Loader2 className="h-8 w-8 animate-spin text-primary my-4" />}
            </CardContent>
            <CardFooter>
                <Button onClick={() => router.push('/dashboard')} variant="outline">
                    Return to Dashboard
                </Button>
            </CardFooter>
          </Card>
         )}
      </div>
    </div>
  );
}
