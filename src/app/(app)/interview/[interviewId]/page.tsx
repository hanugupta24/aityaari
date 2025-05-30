
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, Terminal, AlertTriangle, Volume2, MicOff, TimerIcon } from "lucide-react";
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

const MAX_VISIBILITY_CHANGES = 2; // Allow 2 switches, end on 3rd

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

  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null); 

  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [hasSpokenCurrentQuestion, setHasSpokenCurrentQuestion] = useState(false);
  const previousQuestionIdRef = useRef<string | null>(null);

  const [timeLeftInSeconds, setTimeLeftInSeconds] = useState<number | null>(null);
  const [visibilityChangeCount, setVisibilityChangeCount] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for latest state values to be used in callbacks like setInterval
  const isEndingInterviewRef = useRef(isEndingInterview);
  useEffect(() => {
    isEndingInterviewRef.current = isEndingInterview;
  }, [isEndingInterview]);

  const allQuestionsRef = useRef(allQuestions);
  useEffect(() => {
    allQuestionsRef.current = allQuestions;
  }, [allQuestions]);

  const transcriptLogRef = useRef(transcriptLog);
  useEffect(() => {
    transcriptLogRef.current = transcriptLog;
  }, [transcriptLog]);


  const stopMediaTracks = useCallback(() => {
    console.log("InterviewPage: stopMediaTracks called.");
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null; 
      console.log("InterviewPage: mediaStreamRef.current tracks stopped and cleared.");
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const videoStream = videoRef.current.srcObject as MediaStream;
      videoStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null; 
      console.log("InterviewPage: videoRef.current.srcObject tracks stopped and cleared.");
    }
  }, []);
  
  const stopSpeechRecognition = useCallback(() => {
    console.log("InterviewPage: stopSpeechRecognition called.");
    if (recognitionRef.current) {
      recognitionRef.current.stop(); 
    }
    setIsListening(false); 
  }, []);

  const cancelSpeechSynthesis = useCallback(() => {
    console.log("InterviewPage: cancelSpeechSynthesis called.");
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if(window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    }
    setIsAISpeaking(false); 
  }, []);

  const isInterviewEffectivelyActive = useCallback(() => {
    return session && session.status !== "completed" && session.status !== "cancelled" && !isEndingInterview;
  }, [session, isEndingInterview]);


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

  const handleEndInterview = useCallback(async (finalQuestionsData: AnsweredQuestion[], finalTranscriptString: string) => {
    if (!user || !interviewId || !session || !userProfile || isEndingInterviewRef.current) { // Use ref here
      if(!isEndingInterviewRef.current) toast({ title: "Error", description: "User or session data missing for ending interview.", variant: "destructive" });
      // setIsEndingInterview(false); // Only set to true, not false here
      return;
    }
    console.log("InterviewPage: handleEndInterview - Starting process.");
    setIsEndingInterview(true); 
    toast({ title: "Interview Complete", description: "Finalizing and analyzing your feedback..." });

    cancelSpeechSynthesis();
    stopSpeechRecognition();
    stopMediaTracks(); 
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }

    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      
      const questionsToStore = finalQuestionsData.map(q => ({
        id: q.id,
        text: q.text,
        stage: q.stage,
        type: q.type,
        answer: q.answer || "", 
      }));

      await updateDoc(sessionDocRef, {
        status: "completed",
        questions: questionsToStore, 
        transcript: finalTranscriptString,
        updatedAt: new Date().toISOString(),
      });
      
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      await refreshUserProfile(); 
      
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        questions: questionsToStore,
        jobDescription: userProfile.role || "General Role", 
        candidateProfile: `Field: ${userProfile.profileField}, Role: ${userProfile.role}, Education: ${userProfile.education}`,
        interviewTranscript: finalTranscriptString, 
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("InterviewPage: Error ending interview / getting feedback:", error);
      toast({ title: "Error Finalizing Interview", description: error.message || "Failed to finalize interview or get feedback.", variant: "destructive" });
    }
  }, [user, interviewId, session, userProfile, router, toast, refreshUserProfile, cancelSpeechSynthesis, stopSpeechRecognition, stopMediaTracks]);


  // Main useEffect for Firestore listener, media setup, and cleanup
  useEffect(() => {
    console.log("InterviewPage: Main useEffect mounting/running. User:", user?.uid, "Interview ID:", interviewId);
    if (!user || !interviewId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
    
    let unsubscribe: Unsubscribe | null = null;
    try {
      unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
        console.log("InterviewPage: Firestore onSnapshot triggered. Document exists:", docSnap.exists());
        if (docSnap.exists()) {
          const data = docSnap.data() as InterviewSession;
          setSession(data);
          setTranscriptLog(data.transcript ? data.transcript.split('\\n') : []);

          if (data.status === "completed" || data.status === "cancelled") {
            if (!isEndingInterviewRef.current) { // Prevent race condition if handleEndInterview already called
                toast({ title: "Interview Ended", description: "This interview session is no longer active."});
                cancelSpeechSynthesis();
                stopSpeechRecognition();
                stopMediaTracks();
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
                router.push("/dashboard");
            }
            return;
          }
          
          if (data.questions && data.questions.length > 0) {
            const sortedQuestions = data.questions
              .map(q => ({...q, answer: q.answer || ""})) 
              .sort((a, b) => { 
                  if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
                  if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
                  return (parseInt(a.id.substring(1)) || 0) - (parseInt(b.id.substring(1)) || 0);
              });
            
            setAllQuestions(sortedQuestions);
            const firstUnansweredIndex = sortedQuestions.findIndex(q => !q.answer); 
            const newIndex = firstUnansweredIndex > -1 ? firstUnansweredIndex : (data.questions.length > 0 ? data.questions.length -1 : 0);
            if (currentQuestionIndex !== newIndex) {
                setCurrentQuestionIndex(newIndex);
            }
            
            if (timeLeftInSeconds === null && data.status !== 'completed' && data.status !== 'cancelled' && data.duration) {
              setTimeLeftInSeconds(data.duration * 60);
            }

          } else {
            toast({ title: "Error", description: "No questions found for this session. Please start a new interview.", variant: "destructive" });
            if (!isEndingInterviewRef.current) {
                cancelSpeechSynthesis();
                stopSpeechRecognition();
                stopMediaTracks();
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
                router.push("/interview/start");
            }
          }
        } else {
          toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
          if (!isEndingInterviewRef.current) {
              cancelSpeechSynthesis();
              stopSpeechRecognition();
              stopMediaTracks();
              if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current);
                  timerIntervalRef.current = null;
              }
              router.push("/dashboard");
          }
        }
        setIsLoading(false);
      }, (error) => {
        console.error("InterviewPage: Error in Firestore onSnapshot:", error);
        toast({ title: "Firestore Error", description: "Could not listen to interview updates.", variant: "destructive" });
        setIsLoading(false);
      });
    } catch (e) {
        console.error("InterviewPage: Exception setting up Firestore listener:", e);
        setIsLoading(false);
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        toast({ title: "Media Error", description: "Could not access camera/microphone. Please check permissions.", variant: "destructive" });
      });
    
    return () => {
      console.log("InterviewPage: Unmounting component. Running cleanup functions.");
      if (unsubscribe) unsubscribe();
      cancelSpeechSynthesis();
      stopSpeechRecognition();
      stopMediaTracks();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      console.log("InterviewPage: All cleanup functions called from main useEffect.");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, interviewId, router, toast]); // handleEndInterview removed to break cycle, cancel/stop/toast already memoized

  const currentQuestion = allQuestions[currentQuestionIndex];

  // AI Speech Synthesis Effect
  useEffect(() => {
    if (currentQuestion?.id !== previousQuestionIdRef.current) {
        setHasSpokenCurrentQuestion(false); // Reset for new question
        previousQuestionIdRef.current = currentQuestion?.id || null;
        // If AI was speaking, cancel it for the new question
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
            window.speechSynthesis.cancel();
            setIsAISpeaking(false);
        }
    }

    if (currentQuestion && currentQuestion.stage === 'oral' && !currentQuestion.answer && isInterviewEffectivelyActive() && !isListening && !hasSpokenCurrentQuestion && !isAISpeaking) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        console.log("InterviewPage: AI attempting to speak question:", currentQuestion.text);
        const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.onstart = () => {
            console.log("InterviewPage: AI speech started.");
            setIsAISpeaking(true);
        };
        utterance.onend = () => {
          console.log("InterviewPage: AI speech ended.");
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true); // Mark as spoken
        };
        utterance.onerror = (event) => {
          console.error('InterviewPage: SpeechSynthesis Error:', event);
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true); // Allow user to proceed even if AI voice fails
          toast({ title: "AI Voice Error", description: "Could not play AI voice.", variant: "destructive" });
        };
        window.speechSynthesis.speak(utterance);
      } else {
        // If speech synthesis isn't available, skip speaking
        setIsAISpeaking(false); // Ensure it's false
        setHasSpokenCurrentQuestion(true); // Mark as "spoken" to allow flow to continue
      }
    } else if (isAISpeaking && (!isInterviewEffectivelyActive() || currentQuestion?.stage !== 'oral' || currentQuestion?.answer || hasSpokenCurrentQuestion)) {
        // Conditions to stop AI speaking prematurely if state changes
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
            window.speechSynthesis.cancel();
        }
        setIsAISpeaking(false);
    }
  }, [currentQuestion, isInterviewEffectivelyActive, toast, isListening, hasSpokenCurrentQuestion, isAISpeaking]);

  // Timer Countdown Effect
  useEffect(() => {
    if (isInterviewEffectivelyActive() && timeLeftInSeconds !== null && timeLeftInSeconds > 0) {
      // Interval is only set if active, time exists, and time > 0
      timerIntervalRef.current = setInterval(() => {
        setTimeLeftInSeconds(prevTime => {
          if (prevTime === null) return null; // Should not happen if initial check is good
          if (prevTime <= 1) {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            if (!isEndingInterviewRef.current) {
                toast({ title: "Time's up!", description: "The interview has ended.", variant: "destructive" });
                handleEndInterview(allQuestionsRef.current, transcriptLogRef.current.join('\\n'));
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    // Cleanup function of the useEffect
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null; // Important to nullify here as well
      }
    };
  }, [isInterviewEffectivelyActive, timeLeftInSeconds, handleEndInterview, toast]);


  // Tab/Window Focus Change Listener Effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isInterviewEffectivelyActive()) {
        handleFocusChange();
      }
    };
    const handleWindowBlur = () => {
        if (!document.hasFocus() && isInterviewEffectivelyActive()){
             handleFocusChange();
        }
    };

    const handleFocusChange = () => {
      setVisibilityChangeCount(prevCount => {
        const newCount = prevCount + 1;
        console.log(`InterviewPage: Visibility/Focus lost. Count: ${newCount}`);
        if (newCount <= MAX_VISIBILITY_CHANGES) {
          toast({
            title: "Interview Warning",
            description: `Switching away from the interview is not recommended. This is warning ${newCount} of ${MAX_VISIBILITY_CHANGES}.`,
            variant: "default",
            duration: 5000,
          });
        } else {
          toast({
            title: "Interview Ended",
            description: "Interview terminated due to excessive tab/window switching.",
            variant: "destructive",
            duration: 7000,
          });
          if (!isEndingInterviewRef.current) {
            handleEndInterview(allQuestionsRef.current, transcriptLogRef.current.join('\\n'));
          }
        }
        return newCount;
      });
    };

    if (isInterviewEffectivelyActive()) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("blur", handleWindowBlur);
      console.log("InterviewPage: Focus listeners added.");
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      console.log("InterviewPage: Focus listeners removed.");
    };
  }, [isInterviewEffectivelyActive, handleEndInterview, toast]);

  const handleToggleListening = useCallback(() => {
    if (!speechRecognitionSupported) {
      toast({ title: "Speech Recognition Not Supported", description: "Cannot start voice input.", variant: "destructive"});
      return;
    }

    if (isListening) { 
      if (recognitionRef.current) {
        recognitionRef.current.stop(); // This will trigger onend, which sets isListening(false)
      }
      setIsListening(false); // Also set immediately for UI responsiveness
    } else { 
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel(); 
        setIsAISpeaking(false);
        setHasSpokenCurrentQuestion(true); 
      }

      setUserAnswer(''); 
      setSpeechError(null);

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) { 
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = true; 
        recognitionRef.current.interimResults = true; 
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log("InterviewPage: Speech recognition started.");
          setIsListening(true);
          setSpeechError(null);
        };
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript = event.results[i][0].transcript;
            }
          }
          setUserAnswer(finalTranscript.trim() + (interimTranscript ? (finalTranscript.trim() ? ' ' : '') + interimTranscript : ''));
        };

        recognitionRef.current.onerror = (event: any) => {
          let errorMsg = "Speech recognition error: " + event.error;
          if (event.error === 'no-speech') errorMsg = "No speech detected. Please try again.";
          if (event.error === 'audio-capture') errorMsg = "Audio capture failed. Check microphone permissions.";
          if (event.error === 'not-allowed') errorMsg = "Microphone access denied. Please grant permission.";
          console.error("InterviewPage: Speech recognition error -", errorMsg);
          setSpeechError(errorMsg);
          setIsListening(false); 
        };

        recognitionRef.current.onend = () => {
          console.log("InterviewPage: Speech recognition ended.");
          setIsListening(false); // Ensure isListening is false when recognition naturally ends
        };
      }
      recognitionRef.current.start();
    }
  }, [isListening, speechRecognitionSupported, toast]);


  const handleNextQuestion = async () => {
    if (!user || !session || !allQuestions.length || currentQuestionIndex >= allQuestions.length || isEndingInterviewRef.current) {
        return;
    }
    
    if (isListening) stopSpeechRecognition();
    if (isAISpeaking) {
       cancelSpeechSynthesis();
       setHasSpokenCurrentQuestion(true); 
    }

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
            questions: updatedQuestions.map(({answer, ...q}) => ({...q, answer: answer || ""})), 
            transcript: updatedTranscriptLogArray.join('\\n'),
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        toast({title: "Save Error", description: "Could not save current answer.", variant: "destructive"})
    }

    setUserAnswer(""); 
    setSpeechError(null);
    setHasSpokenCurrentQuestion(false); 
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
    } else {
      await handleEndInterview(updatedQuestions, updatedTranscriptLogArray.join('\\n'));
    }
    setIsSubmittingAnswer(false);
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

  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null || totalSeconds < 0) return "00:00";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };


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
            <CardTitle className="text-xl">Transcript Log</CardTitle>
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
       {isInterviewEffectivelyActive() && currentQuestion ? (
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-2xl">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </CardTitle>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                   <TimerIcon className="h-5 w-5" />
                   <span>Time Left: {formatTime(timeLeftInSeconds)}</span>
                 </div>
            </div>
            <Progress value={progress} className="w-full h-2" />
            
            {currentQuestion && (
                <CardDescription className={`text-lg pt-2 whitespace-pre-wrap ${isAISpeaking && currentStage === 'oral' ? 'pb-1' : 'pb-0'}`}>
                    {currentQuestion.text}
                </CardDescription>
            )}
             {isAISpeaking && currentStage === 'oral' && (
                <div className="flex items-center text-primary pt-1">
                    <Volume2 className="h-5 w-5 mr-2 animate-pulse" />
                    <p className="text-md font-medium">AI is asking the question...</p>
                </div>
            )}
            <p className="text-xs text-muted-foreground capitalize mt-1">Stage: {currentStage?.replace('_', ' ')} ({currentQuestionType})</p>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            {currentStage === "oral" ? (
              <div className="flex-grow flex flex-col justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {isListening ? "Speak now. Your transcribed answer will appear below." : (userAnswer ? "Review your transcribed answer or listen again." : "Click the mic to speak your answer.")}
                  </p>
                  <Textarea
                    placeholder={isListening ? "Listening... Speak now." : (userAnswer ? userAnswer : "Your transcribed answer will appear here...")}
                    value={userAnswer}
                    readOnly // Always readOnly for oral, content driven by Speech-to-Text
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
              <CardTitle className="text-2xl">Interview Session {session?.status === 'completed' ? 'Completed' : (isEndingInterview ? 'Ending...' : 'Ended')}</CardTitle>
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

    