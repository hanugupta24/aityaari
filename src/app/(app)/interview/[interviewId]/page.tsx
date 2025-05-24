
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, MessageCircle, Terminal, AlertTriangle, Volume2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, GeneratedQuestion, UserProfile } from "@/types";
import { analyzeInterviewFeedback, type AnalyzeInterviewFeedbackInput } from "@/ai/flows/analyze-interview-feedback";
import { Progress } from "@/components/ui/progress";


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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [userAnswer, setUserAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isAIDictating, setIsAIDictating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("Media tracks stopped.");
    }
    if (videoRef.current && videoRef.current.srcObject) {
      // Explicitly stop tracks on the srcObject as well
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log("Video element srcObject tracks stopped.");
    }
  }, []);

  // Effect to fetch initial session data and setup video
  useEffect(() => {
    if (!user || !interviewId) return;
    setIsLoading(true);
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
          // Initialize with empty answers and sort by ID (q1, q2...)
          // The sorting done in the AI flow should be primary, this is a fallback.
          const sortedQuestions = data.questions
            .map(q => ({...q, answer: q.answer || ""}))
            .sort((a, b) => (parseInt(a.id.substring(1)) || 0) - (parseInt(b.id.substring(1)) || 0));
          
          setAllQuestions(sortedQuestions);
          setCurrentQuestionIndex(data.questions.findIndex(q => !q.answer) > -1 ? data.questions.findIndex(q => !q.answer) : 0);


          if (sortedQuestions[0]?.stage === 'oral') {
             setIsAIDictating(true);
             setTimeout(() => setIsAIDictating(false), 1500); // Simulate AI dictation
          }

        } else {
          toast({ title: "Error", description: "No questions found for this session.", variant: "destructive" });
          stopMediaTracks();
          router.push("/interview/start");
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
      });
    
    return () => {
      unsubscribe();
      stopMediaTracks();
    };
  }, [user, interviewId, router, toast, stopMediaTracks]);


  const handleNextQuestion = async () => {
    if (!session || !allQuestions.length || currentQuestionIndex >= allQuestions.length) return;
    
    setIsSubmittingAnswer(true);

    const updatedQuestions = [...allQuestions];
    updatedQuestions[currentQuestionIndex] = { ...updatedQuestions[currentQuestionIndex], answer: userAnswer };
    setAllQuestions(updatedQuestions);

    const currentQ = updatedQuestions[currentQuestionIndex];
    setTranscript(prev => [...prev, `AI (${currentQ.stage}): ${currentQ.text}`, `You: ${userAnswer}`]);
    
    // Save current progress to Firestore (optional, but good for resilience)
    try {
        const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
        await updateDoc(sessionDocRef, {
            questions: updatedQuestions, // save current answers
            transcript: transcript.join('\n') + `\nAI (${currentQ.stage}): ${currentQ.text}\nYou: ${userAnswer}`,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error saving intermediate progress:", error);
        toast({title: "Save Error", description: "Could not save current answer. Please check connection.", variant: "destructive"})
    }

    setUserAnswer("");
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      if (allQuestions[nextQuestionIndex].stage === 'oral') {
        setIsAIDictating(true);
        setTimeout(() => setIsAIDictating(false), 1500); // Simulate AI dictation
      }
    } else {
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

    stopMediaTracks(); // Ensure media is stopped FIRST

    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      
      const questionsToStore = finalQuestionsData.map(({ ...q }) => q as GeneratedQuestion);

      await updateDoc(sessionDocRef, {
        status: "completed",
        questions: questionsToStore, 
        transcript: finalTranscript,
        updatedAt: new Date().toISOString(),
      });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
      });
      await refreshUserProfile(); 
      
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        interviewTranscript: finalTranscript,
        jobDescription: userProfile.role || "General Role", 
        candidateProfile: `Field: ${userProfile.profileField}, Education: ${userProfile.education}`,
        // expectedAnswers: "...", // Optional: if you have specific expected answers
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("Error ending interview / getting feedback:", error);
      toast({ title: "Error Finalizing Interview", description: error.message || "Failed to finalize interview or get feedback.", variant: "destructive" });
      // Don't set isEndingInterview to false here if we want to prevent retry on this specific error.
      // Instead, user might need to go to dashboard.
      router.push('/dashboard'); // Navigate away on final error
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session || !allQuestions.length) {
    return (
      <div className="flex flex-col justify-center items-center h-screen p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Interview</AlertTitle>
          <AlertDescription>
            There was an issue loading the interview session data. Please try returning to the dashboard.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }
  
  const currentQuestion = allQuestions[currentQuestionIndex];
  const totalQuestions = allQuestions.length;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const currentStage = currentQuestion?.stage; // Get stage from current question

  if (currentQuestionIndex >= totalQuestions && session.status !== 'completed' && !isEndingInterview) {
    // This case implies all questions answered but interview not formally ended by the function.
    // Could auto-trigger end or show a summary before ending. For now, let's assume handleNextQuestion/handleEndInterview logic covers this.
    // If stuck here, it's likely an issue in that logic.
     return (
      <div className="flex flex-col justify-center items-center h-screen p-4">
        <Card className="max-w-lg text-center">
            <CardHeader><CardTitle>Processing...</CardTitle></CardHeader>
            <CardContent><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></CardContent>
        </Card>
      </div>);
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4 p-4">
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
       {session.status !== 'completed' && currentQuestion ? (
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-2xl">
                {currentStage === 'oral' ? 'Oral Question' : 'Technical Question'} ({currentQuestionIndex + 1} of {totalQuestions})
                </CardTitle>
                <span className="text-sm text-muted-foreground">Stage: {currentStage}</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
            {isAIDictating && currentStage === 'oral' && (
                <div className="flex items-center text-primary pt-4">
                    <Volume2 className="h-5 w-5 mr-2 animate-pulse" />
                    <p className="text-lg">AI is asking the question...</p>
                </div>
            )}
            {!isAIDictating && (
                <CardDescription className="text-lg pt-4 whitespace-pre-wrap">{currentQuestion.text}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            {currentStage === "oral" ? (
              <div className="flex-grow flex flex-col justify-end">
                 <p className="text-sm text-muted-foreground mb-2">
                  Please answer this question orally. You can use the text area below for notes if needed.
                </p>
                <Textarea
                  placeholder="Jot down notes here if you wish..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="text-base min-h-[100px] mb-4"
                  disabled={isSubmittingAnswer || isEndingInterview || isAIDictating}
                />
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => toast({title: "Feature Coming Soon", description: "Speech-to-text and recording is planned for future updates."})} disabled={isSubmittingAnswer || isEndingInterview || isAIDictating}>
                      <Mic className="mr-2 h-4 w-4" /> Speak (Preview)
                    </Button>
                </div>
              </div>
            ) : ( // technical_written stage
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
                <Button 
                    onClick={handleNextQuestion} 
                    disabled={isSubmittingAnswer || isEndingInterview || !userAnswer.trim() || isAIDictating}
                >
                  {isSubmittingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                  Next Question
                </Button>
              ) : (
                <Button 
                  onClick={() => handleEndInterview(allQuestions, transcript.join('\n') + `\nAI (${currentQuestion.stage}): ${currentQuestion.text}\nYou: ${userAnswer}`)} 
                  disabled={isSubmittingAnswer || isEndingInterview || !userAnswer.trim() || isAIDictating} 
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
              <CardTitle className="text-2xl">Interview Session {session.status === 'completed' ? 'Completed' : 'Ended'}</CardTitle>
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
