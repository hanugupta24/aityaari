
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, Terminal, AlertTriangle, Volume2, MicOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, GeneratedQuestion } from "@/types";
import { analyzeInterviewFeedback, type AnalyzeInterviewFeedbackInput } from "@/ai/flows/analyze-interview-feedback";
import { Progress } from "@/components/ui/progress";

// Helper to manage questions with their answers
interface AnsweredQuestion extends GeneratedQuestion {
  answer?: string;
}

// For Web Speech API compatibility
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    speechSynthesis: SpeechSynthesis;
  }
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
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null); // SpeechRecognition instance

  // AI Speech Synthesis State
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [hasSpokenCurrentQuestion, setHasSpokenCurrentQuestion] = useState(false);
  const previousQuestionIdRef = useRef<string | null>(null);


  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("Media tracks stopped.");
    }
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log("Video element srcObject tracks stopped.");
    }
  }, []);
  
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); 
    }
    setIsListening(false); 
  }, []);

  const cancelSpeechSynthesis = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsAISpeaking(false); 
  }, []);


  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setSpeechRecognitionSupported(true);
    } else {
      setSpeechRecognitionSupported(false);
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser does not support speech-to-text. For oral questions, please type your answers or use a supported browser (e.g., Chrome, Edge).",
        variant: "default",
        duration: 7000,
      });
    }
  }, [toast]);


  useEffect(() => {
    if (!user || !interviewId) return;
    setIsLoading(true);
    const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
    
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as InterviewSession;
        setSession(data);
        setTranscriptLog(data.transcript ? data.transcript.split('\n') : []);


        if (data.status === "completed" || data.status === "cancelled") {
          toast({ title: "Interview Ended", description: "This interview session is no longer active."});
          cancelSpeechSynthesis();
          stopMediaTracks();
          stopSpeechRecognition();
          router.push("/dashboard");
          return;
        }
        
        if (data.questions && data.questions.length > 0) {
          const sortedQuestions = data.questions
            .map(q => ({...q, answer: q.answer || ""}))
            .sort((a, b) => (parseInt(a.id.substring(1)) || 0) - (parseInt(b.id.substring(1)) || 0));
          
          setAllQuestions(sortedQuestions);
          const firstUnansweredIndex = sortedQuestions.findIndex(q => !q.answer);
          setCurrentQuestionIndex(firstUnansweredIndex > -1 ? firstUnansweredIndex : (data.questions.length > 0 ? data.questions.length -1 : 0));

        } else {
          toast({ title: "Error", description: "No questions found for this session. Please start a new interview.", variant: "destructive" });
          cancelSpeechSynthesis();
          stopMediaTracks();
          stopSpeechRecognition();
          router.push("/interview/start");
        }
      } else {
        toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
        cancelSpeechSynthesis();
        stopMediaTracks();
        stopSpeechRecognition();
        router.push("/dashboard");
      }
      setIsLoading(false);
    });

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
      cancelSpeechSynthesis();
      stopMediaTracks();
      stopSpeechRecognition();
    };
  }, [user, interviewId, router, toast, stopMediaTracks, stopSpeechRecognition, cancelSpeechSynthesis]);

  const currentQuestion = allQuestions[currentQuestionIndex];

  // Effect for AI Speech Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (currentQuestion?.id !== previousQuestionIdRef.current) {
      setHasSpokenCurrentQuestion(false); // Reset speaking status for new question
      previousQuestionIdRef.current = currentQuestion?.id || null;
    }

    if (currentQuestion && currentQuestion.stage === 'oral' && !currentQuestion.answer && !isEndingInterview && session?.status !== 'completed' && !isListening && !hasSpokenCurrentQuestion) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        utterance.onstart = () => setIsAISpeaking(true);
        utterance.onend = () => {
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true);
        };
        utterance.onerror = (event) => {
          console.error('SpeechSynthesis Error:', event);
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true); // Mark as spoken even on error to prevent loop
          toast({ title: "AI Voice Error", description: "Could not play AI voice.", variant: "destructive" });
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        setIsAISpeaking(false);
      }
    } else if (currentQuestion?.stage !== 'oral' || currentQuestion?.answer || hasSpokenCurrentQuestion) {
      // If not an oral question, already answered, or already spoken, ensure AI is not marked as speaking
      setIsAISpeaking(false);
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsAISpeaking(false);
      }
    };
  }, [currentQuestion, isEndingInterview, session?.status, toast, isListening, hasSpokenCurrentQuestion]);


  const handleToggleListening = useCallback(() => {
    if (!speechRecognitionSupported) {
      toast({ title: "Speech Recognition Not Supported", description: "Cannot start voice input.", variant: "destructive"});
      return;
    }

    if (isListening) { // User wants to stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false); 
    } else { // User wants to start listening
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel(); 
        setIsAISpeaking(false);
      }

      setUserAnswer(''); // Clear previous answer from Textarea before starting new recognition
      setSpeechError(null); // Clear previous speech errors

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) { 
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = true; 
        recognitionRef.current.interimResults = true; 
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };
        
        recognitionRef.current.onresult = (event: any) => {
          let finalSegments: string[] = [];
          let latestInterim = '';

          for (let i = 0; i < event.results.length; i++) {
              const segment = event.results[i];
              if (segment.isFinal) {
                  finalSegments.push(segment[0].transcript);
              } else {
                  latestInterim = segment[0].transcript; 
              }
          }
          
          const finalTranscriptPortion = finalSegments.join(' ').trim();
          
          let combinedAnswer = finalTranscriptPortion;
          if (latestInterim) {
              if (combinedAnswer.length > 0 && !combinedAnswer.endsWith(' ')) {
                  combinedAnswer += ' '; 
              }
              combinedAnswer += latestInterim;
          }
          setUserAnswer(combinedAnswer.trim());
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          let errorMsg = "Speech recognition error: " + event.error;
          if (event.error === 'no-speech') errorMsg = "No speech detected. Please try again.";
          if (event.error === 'audio-capture') errorMsg = "Audio capture failed. Check microphone permissions.";
          if (event.error === 'not-allowed') errorMsg = "Microphone access denied. Please grant permission.";
          setSpeechError(errorMsg);
          setIsListening(false); 
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
      
      recognitionRef.current.start();
    }
  }, [isListening, speechRecognitionSupported, toast]);


  const handleNextQuestion = async () => {
    if (!user || !session || !allQuestions.length || currentQuestionIndex >= allQuestions.length) return;
    
    if (isListening) stopSpeechRecognition();
    if (isAISpeaking) cancelSpeechSynthesis();

    setIsSubmittingAnswer(true);

    const updatedQuestions = [...allQuestions];
    const currentQ = updatedQuestions[currentQuestionIndex];
    currentQ.answer = userAnswer.trim(); 
    setAllQuestions(updatedQuestions); 

    const newTranscriptLogEntries = [
        `AI (${currentQ.stage} - ${currentQ.type}): ${currentQ.text}`,
        `You: ${userAnswer.trim() || (currentQ.stage === 'oral' ? "[No verbal answer recorded]" : "[No answer provided]")}`
    ];
    const updatedTranscriptLogArray = [...transcriptLog, ...newTranscriptLogEntries];
    setTranscriptLog(updatedTranscriptLogArray);
    
    try {
        const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
        await updateDoc(sessionDocRef, {
            questions: updatedQuestions.map(({answer, ...q}) => ({...q, answer})), 
            transcript: updatedTranscriptLogArray.join('\n'),
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error saving intermediate progress:", error);
        toast({title: "Save Error", description: "Could not save current answer. Please check connection.", variant: "destructive"})
    }

    setUserAnswer(""); 
    setSpeechError(null);
    setHasSpokenCurrentQuestion(false); // Reset for next question
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
    } else {
      await handleEndInterview(updatedQuestions, updatedTranscriptLogArray.join('\n'));
    }
    setIsSubmittingAnswer(false);
  };

  const handleEndInterview = async (finalQuestionsData: AnsweredQuestion[], finalTranscriptString: string) => {
    if (!user || !interviewId || !session || !userProfile) {
      toast({ title: "Error", description: "User or session data missing.", variant: "destructive" });
      setIsEndingInterview(false); 
      return;
    }
    setIsEndingInterview(true);
    toast({ title: "Interview Complete", description: "Finalizing and analyzing your feedback..." });

    cancelSpeechSynthesis();
    stopSpeechRecognition();
    stopMediaTracks(); 

    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      
      const questionsToStore = finalQuestionsData.map(({ answer, ...q }) => ({ ...q, answer: answer || "" }) as GeneratedQuestion);

      await updateDoc(sessionDocRef, {
        status: "completed",
        questions: questionsToStore, 
        transcript: finalTranscriptString,
        updatedAt: new Date().toISOString(),
      });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
      });
      await refreshUserProfile(); 
      
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        interviewTranscript: finalTranscriptString,
        jobDescription: userProfile.role || "General Role", 
        candidateProfile: `Field: ${userProfile.profileField}, Role: ${userProfile.role}, Education: ${userProfile.education}`,
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("Error ending interview / getting feedback:", error);
      toast({ title: "Error Finalizing Interview", description: error.message || "Failed to finalize interview or get feedback.", variant: "destructive" });
      setIsEndingInterview(false); 
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (currentQuestion?.stage === 'technical_written') {
        e.preventDefault();
        toast({
            title: "Pasting Disabled",
            description: "Please type your answer directly for technical questions.",
            variant: "default", 
            duration: 3000,
        });
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!session || !allQuestions.length || (currentQuestionIndex >= allQuestions.length && !isEndingInterview && session.status !== 'completed')) {
    if (isEndingInterview) { 
      return (
        <div className="flex flex-col justify-center items-center h-screen p-4">
          <Card className="max-w-lg text-center">
              <CardHeader><CardTitle>Processing Results...</CardTitle></CardHeader>
              <CardContent><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="flex flex-col justify-center items-center h-screen p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Interview Data Issue</AlertTitle>
          <AlertDescription>
            There was a problem loading the interview questions or the session has ended. Please try returning to the dashboard.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }
  
  const totalQuestions = allQuestions.length;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex +1) / totalQuestions) * 100 : 0;
  const currentStage = currentQuestion?.stage;
  const currentQuestionType = currentQuestion?.type;

  const isSubmitButtonDisabled = isSubmittingAnswer || isEndingInterview || isAISpeaking || isListening || (currentStage === 'technical_written' && !userAnswer.trim());

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4 p-4">
      <div className="lg:w-1/3 flex flex-col gap-4">
        <Card className="flex-shrink-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Your Video</CardTitle>
          </CardHeader>
          <CardContent>
            <video ref={videoRef} autoPlay muted className="w-full aspect-video rounded-md bg-muted object-cover" data-ai-hint="video conference"></video>
          </CardContent>
        </Card>
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto space-y-2 p-2 bg-muted/50 rounded-b-md">
            {transcriptLog.map((line, index) => (
              <p key={index} className={`text-sm p-2 rounded-md ${line.startsWith("AI") ? "bg-secondary text-secondary-foreground self-start mr-auto max-w-[90%]" : "bg-primary text-primary-foreground self-end ml-auto max-w-[90%]"}`}>
                {line}
              </p>
            ))}
             {isSubmittingAnswer && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
          </CardContent>
        </Card>
      </div>

      <div className="lg:w-2/3 flex flex-col">
       {session.status !== 'completed' && currentQuestion ? (
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-2xl">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </CardTitle>
                <span className="text-sm text-muted-foreground capitalize">Stage: {currentStage?.replace('_', ' ')} ({currentQuestionType})</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
            
            {isAISpeaking && currentStage === 'oral' && (
                <div className="flex items-center text-primary pt-2">
                    <Volume2 className="h-5 w-5 mr-2 animate-pulse" />
                    <p className="text-md font-medium">AI is asking the question...</p>
                </div>
            )}
            {currentQuestion && (
                <CardDescription className={`text-lg pt-2 whitespace-pre-wrap ${isAISpeaking && currentStage === 'oral' ? 'pb-1' : 'pb-0'}`}>{currentQuestion.text}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            {currentStage === "oral" ? (
              <div className="flex-grow flex flex-col justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Your transcribed answer will appear below. Click the mic to speak.
                  </p>
                  <Textarea
                    placeholder={isListening ? "Listening... Speak now." : (userAnswer ? userAnswer : "Your transcribed answer will appear here...")}
                    value={userAnswer}
                    readOnly 
                    className="text-base min-h-[100px] mb-4 bg-background/70 cursor-not-allowed"
                    disabled={isSubmittingAnswer || isEndingInterview || isAISpeaking}
                  />
                  {speechError && <Alert variant="destructive" className="mb-2"><AlertTriangle className="h-4 w-4" /><AlertTitle>Speech Error</AlertTitle><AlertDescription>{speechError}</AlertDescription></Alert>}
                </div>
                 <div className="flex gap-2 items-center">
                    <Button 
                        variant="outline" 
                        onClick={handleToggleListening} 
                        disabled={isSubmittingAnswer || isEndingInterview || isAISpeaking || !speechRecognitionSupported}
                        className={isListening ? "border-red-500 text-red-500 hover:bg-red-500/10" : ""}
                    >
                      {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                      {isListening ? "Stop Listening" : (userAnswer ? "Listen Again (clears previous)" : "Start Listening")}
                    </Button>
                    {!speechRecognitionSupported && <p className="text-xs text-destructive">Voice input not supported by your browser.</p>}
                 </div>
              </div>
            ) : ( // technical_written stage
               <div className="flex-grow flex flex-col">
                <div className="flex items-center text-sm text-muted-foreground mb-2 gap-1">
                  <Terminal className="h-4 w-4" />
                  <span>{currentQuestion?.type === 'coding' ? "Use the editor below to write your code. Explain your approach if prompted. Pasting is disabled." : "Provide your detailed answer below. Pasting is disabled."}</span>
                </div>
                <Textarea 
                  placeholder={currentQuestion?.type === 'coding' ? "// Your code here...\nfunction solution() {\n  \n}" : "Your detailed answer..."}
                  className="flex-grow font-mono text-sm min-h-[200px] bg-background/70"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)} 
                  onPaste={handlePaste}
                  disabled={isSubmittingAnswer || isEndingInterview || isAISpeaking}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-between items-center">
             <p className="text-sm text-muted-foreground">Interview Duration: {session.duration} mins</p>
            <div>
              <Button 
                  onClick={handleNextQuestion} 
                  disabled={isSubmitButtonDisabled}
              >
                {isSubmittingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                {currentQuestionIndex < totalQuestions - 1 ? "Next Question" : "End Interview & Get Feedback"}
              </Button>
            </div>
          </CardFooter>
        </Card>
         ) : ( 
          <Card className="flex-grow flex flex-col shadow-lg items-center justify-center">
            <CardHeader>
              <CardTitle className="text-2xl">Interview Session {session?.status === 'completed' ? 'Completed' : 'Ended'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Your interview responses are being processed or the session has concluded.</p>
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
    

    

    

    