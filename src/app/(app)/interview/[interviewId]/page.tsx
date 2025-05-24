
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, GeneratedQuestion, UserProfile } from "@/types";
import { conversationalInterview, type ConversationalInterviewInput } from "@/ai/flows/conversational-interviewing";
import { analyzeInterviewFeedback, type AnalyzeInterviewFeedbackInput } from "@/ai/flows/analyze-interview-feedback";
import Image from "next/image";


// Mock a question type for UI display
interface DisplayQuestion extends GeneratedQuestion {
  answer?: string; // User's answer
  isCurrent?: boolean;
}

export default function InterviewPage() {
  const params = useParams();
  const interviewId = params.interviewId as string;
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<DisplayQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

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
          router.push("/dashboard");
        }
        // Mock questions if not present - in a real app, these would be generated
        if (!data.questions || data.questions.length === 0) {
           const mockQuestions: DisplayQuestion[] = [
            { id: "q1", text: "Tell me about yourself.", type: "conversational", isCurrent: true },
            { id: "q2", text: "What are your strengths?", type: "behavioral" },
            { id: "q3", text: "Describe a challenging project you worked on.", type: "behavioral" },
          ];
          setQuestions(mockQuestions);
        } else {
          setQuestions(data.questions.map((q, idx) => ({ ...q, isCurrent: idx === 0 })));
        }
      } else {
        toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
        router.push("/dashboard");
      }
      setIsLoading(false);
    });

    // Setup camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Failed to get media stream:", err);
        toast({ title: "Media Error", description: "Could not access camera/microphone.", variant: "destructive" });
      });
    
    return () => {
      unsubscribe();
      // Clean up media stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user, interviewId, router, toast]);


  const handleNextQuestion = async () => {
    if (!session || !questions.length) return;
    
    // Record answer (simplified)
    const updatedQuestions = questions.map((q, idx) => 
      idx === currentQuestionIndex ? { ...q, answer: userAnswer } : q
    );
    setQuestions(updatedQuestions);
    setTranscript(prev => [...prev, `Q: ${questions[currentQuestionIndex].text}`, `A: ${userAnswer}`]);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestions(prevQs => prevQs.map((q, idx) => ({ ...q, isCurrent: idx === currentQuestionIndex + 1 })));
      setUserAnswer("");
    } else {
      // End of interview
      await handleEndInterview(updatedQuestions, transcript.join('\n') + `\nQ: ${questions[currentQuestionIndex].text}\nA: ${userAnswer}`);
    }
  };

  const handleEndInterview = async (finalQuestions: DisplayQuestion[], finalTranscript: string) => {
    if (!user || !interviewId || !session || !userProfile) return;
    setIsSubmitting(true);
    toast({ title: "Interview Complete", description: "Analyzing your feedback..." });

    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      await updateDoc(sessionDocRef, {
        status: "completed",
        questions: finalQuestions.map(({answer, isCurrent, ...q}) => q), // Store core question data
        transcript: finalTranscript,
        updatedAt: new Date().toISOString(),
      });

      // Increment interviewsTaken
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
      });
      
      // Call GenAI flow for feedback analysis
      // This is a simplified call; actual flows might require more structured input
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        interviewTranscript: finalTranscript,
        jobDescription: userProfile.role || "General Role", // Use profile role as job description
        candidateProfile: `Field: ${userProfile.profileField}, Education: ${userProfile.education}`,
        // expectedAnswers: "...", // If you have them
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("Error ending interview / getting feedback:", error);
      toast({ title: "Error", description: "Failed to finalize interview or get feedback.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  // Mock conversational AI response
  const handleConversationalSubmit = async () => {
    if (!userAnswer.trim() || !session || !userProfile) return;
    setIsAiThinking(true);
    const currentQText = questions[currentQuestionIndex].text;
    setTranscript(prev => [...prev, `You: ${userAnswer}`]);
    setUserAnswer("");

    // This is a placeholder. Real conversational AI would involve streaming responses.
    // The provided `conversationalInterview` flow seems to be for a full interview.
    // For turn-by-turn, you'd typically use a chat model.
    // Here, we'll just simulate a follow-up or next question.
    setTimeout(() => {
      const aiResponse = "That's interesting. Can you elaborate on that?";
      setTranscript(prev => [...prev, `AI: ${aiResponse}`]);
      
      // For now, let's assume a conversational question might lead to the next "main" question
      // or this could be a sub-dialogue. We'll keep it simple and just log.
      // If this was the ONLY question, then we'd move to next.
      // If it's a sub-dialogue, the main question remains.
      
      setIsAiThinking(false);
    }, 1500);
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session || !questions.length) {
    return <div className="flex justify-center items-center h-screen"><p>Error loading interview session.</p></div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

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
            <CardTitle className="text-xl">Transcript / Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto space-y-2 p-2 bg-muted/50 rounded-b-md">
            {transcript.map((line, index) => (
              <p key={index} className={`text-sm p-2 rounded-md ${line.startsWith("AI:") ? "bg-secondary text-secondary-foreground self-start" : "bg-primary text-primary-foreground self-end ml-auto max-w-[80%]"}`}>
                {line}
              </p>
            ))}
             {isAiThinking && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </CardContent>
        </Card>
      </div>

      {/* Question and Answer Area */}
      <div className="lg:w-2/3 flex flex-col">
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
            <CardDescription className="text-lg pt-2">{currentQuestion?.text}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            {currentQuestion?.type === "conversational" ? (
              <div className="flex-grow flex flex-col justify-end">
                <Textarea
                  placeholder="Speak or type your answer..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="text-base min-h-[100px] mb-4"
                  disabled={isAiThinking}
                />
                 <div className="flex gap-2">
                    <Button onClick={handleConversationalSubmit} disabled={isAiThinking || !userAnswer.trim()}>
                      {isAiThinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send
                    </Button>
                    <Button variant="outline" onClick={() => { /* TODO: Speech-to-text */ }} disabled={isAiThinking}>
                      <Mic className="mr-2 h-4 w-4" /> Speak
                    </Button>
                </div>
              </div>
            ) : currentQuestion?.type === "coding" ? (
               <div className="flex-grow flex flex-col">
                <p className="text-sm text-muted-foreground mb-2">Use the editor below to write your code. Explain your approach.</p>
                {/* Placeholder for a code editor component */}
                <Textarea 
                  placeholder="// Your code here..." 
                  className="flex-grow font-mono text-sm"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)} 
                />
              </div>
            ) : (
              <Textarea
                placeholder="Type your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="text-base flex-grow min-h-[200px]"
              />
            )}
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-between items-center">
             <p className="text-sm text-muted-foreground">Interview Duration: {session.duration} mins</p>
            <div>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button onClick={handleNextQuestion} disabled={isSubmitting || (currentQuestion?.type !== 'conversational' && !userAnswer.trim())}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Next Question
                </Button>
              ) : (
                <Button onClick={() => handleEndInterview(questions, transcript.join('\n'))} disabled={isSubmitting || (currentQuestion?.type !== 'conversational' && !userAnswer.trim())} variant="destructive">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  End Interview & Get Feedback
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Helper to simulate AI question generation - replace with actual AI calls
async function generateQuestionsForSession(userProfile: UserProfile, duration: "15" | "30" | "45"): Promise<GeneratedQuestion[]> {
  // This would call the generateInterviewQuestions AI flow
  return [
    { id: "gen_q1", text: "Tell me about a time you faced a major setback. How did you handle it?", type: "behavioral" },
    { id: "gen_q2", text: "What are your salary expectations for this role?", type: "conversational" },
    { id: "gen_q3", text: "Explain the concept of closures in JavaScript.", type: "technical" },
  ];
}

