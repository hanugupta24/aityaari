
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
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

  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null); 

  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [hasSpokenCurrentQuestion, setHasSpokenCurrentQuestion] = useState(false);
  const previousQuestionIdRef = useRef<string | null>(null);


  const stopMediaTracks = useCallback(() => {
    console.log("InterviewPage: stopMediaTracks called.");
    let tracksWereStopped = false;
    if (mediaStreamRef.current) {
      console.log("InterviewPage: Found mediaStreamRef.current. Stopping its tracks.");
      mediaStreamRef.current.getTracks().forEach(track => {
        console.log(`InterviewPage: Stopping media track ID: ${track.id}, kind: ${track.kind}, label: '${track.label}', readyState: ${track.readyState}`);
        if (track.readyState === 'live') {
          track.stop();
          console.log(`InterviewPage: Track ID: ${track.id} stopped.`);
          tracksWereStopped = true;
        } else {
          console.log(`InterviewPage: Track ID: ${track.id} was already ended or not live.`);
        }
      });
      mediaStreamRef.current = null; 
      console.log("InterviewPage: mediaStreamRef.current cleared.");
    } else {
      console.log("InterviewPage: mediaStreamRef.current is null. No tracks from this ref to stop.");
    }

    if (videoRef.current && videoRef.current.srcObject) {
      console.log("InterviewPage: Found videoRef.current.srcObject. Stopping its tracks.");
      const videoStream = videoRef.current.srcObject as MediaStream;
      videoStream.getTracks().forEach(track => {
         console.log(`InterviewPage: Stopping videoRef track ID: ${track.id}, kind: ${track.kind}, label: '${track.label}', readyState: ${track.readyState}`);
        if (track.readyState === 'live') {
          track.stop();
          console.log(`InterviewPage: videoRef track ID: ${track.id} stopped.`);
          tracksWereStopped = true;
        } else {
            console.log(`InterviewPage: videoRef track ID: ${track.id} was already ended or not live.`);
        }
      });
      videoRef.current.srcObject = null; 
      console.log("InterviewPage: videoRef.current.srcObject cleared.");
    } else {
      console.log("InterviewPage: videoRef.current.srcObject is null. No tracks from video element to stop.");
    }

    if (tracksWereStopped) {
      console.log("InterviewPage: Media tracks operation complete. Tracks should be stopped.");
    } else {
      console.log("InterviewPage: No live media tracks were found/stopped by stopMediaTracks.");
    }
  }, []);
  
  const stopSpeechRecognition = useCallback(() => {
    console.log("InterviewPage: stopSpeechRecognition called.");
    if (recognitionRef.current) {
      console.log("InterviewPage: Stopping existing speech recognition instance.");
      recognitionRef.current.stop(); 
    }
    setIsListening(false); 
    console.log("InterviewPage: isListening set to false.");
  }, []);

  const cancelSpeechSynthesis = useCallback(() => {
    console.log("InterviewPage: cancelSpeechSynthesis called.");
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if(window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        console.log("InterviewPage: Cancelling active or pending speech synthesis.");
        window.speechSynthesis.cancel();
      }
    }
    setIsAISpeaking(false); 
    console.log("InterviewPage: isAISpeaking set to false.");
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

  // Main useEffect for Firestore listener, media setup, and cleanup
  useEffect(() => {
    console.log("InterviewPage: Main useEffect mounting/running. User:", user?.uid, "Interview ID:", interviewId);
    if (!user || !interviewId) {
      setIsLoading(false);
      console.log("InterviewPage: Main useEffect - No user or interviewId. Aborting setup.");
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
            toast({ title: "Interview Ended", description: "This interview session is no longer active."});
            console.log("InterviewPage: Interview status is completed/cancelled. Cleaning up and redirecting.");
            cancelSpeechSynthesis();
            stopSpeechRecognition();
            stopMediaTracks();
            router.push("/dashboard");
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
            if (currentQuestionIndex !== newIndex) { // Only update if index changes to avoid unnecessary re-renders
                setCurrentQuestionIndex(newIndex);
            }
            console.log("InterviewPage: Questions processed. Current index:", newIndex);

          } else {
            toast({ title: "Error", description: "No questions found for this session. Please start a new interview.", variant: "destructive" });
            console.error("InterviewPage: No questions found in session data. Redirecting.");
            cancelSpeechSynthesis();
            stopSpeechRecognition();
            stopMediaTracks();
            router.push("/interview/start");
          }
        } else {
          toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
          console.error("InterviewPage: Interview session document not found. Redirecting.");
          cancelSpeechSynthesis();
          stopSpeechRecognition();
          stopMediaTracks();
          router.push("/dashboard");
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
        console.log("InterviewPage: Media stream acquired successfully.");
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("InterviewPage: Video metadata loaded, video should be playing.");
          };
        }
      })
      .catch(err => {
        console.error("InterviewPage: Failed to get media stream:", err);
        toast({ title: "Media Error", description: "Could not access camera/microphone. Please check permissions.", variant: "destructive" });
      });
    
    return () => {
      console.log("InterviewPage: Unmounting component. Running cleanup functions.");
      if (unsubscribe) {
        console.log("InterviewPage: Unsubscribing from Firestore snapshot listener.");
        unsubscribe();
      } else {
        console.log("InterviewPage: No active Firestore subscription to unsubscribe from.");
      }
      console.log("InterviewPage: Calling cancelSpeechSynthesis from cleanup.");
      cancelSpeechSynthesis();
      console.log("InterviewPage: Calling stopSpeechRecognition from cleanup.");
      stopSpeechRecognition();
      console.log("InterviewPage: Calling stopMediaTracks from cleanup.");
      stopMediaTracks();
      console.log("InterviewPage: All cleanup functions called from main useEffect.");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, interviewId, router, toast]); // stopMediaTracks, stopSpeechRecognition, cancelSpeechSynthesis are memoized

  const currentQuestion = allQuestions[currentQuestionIndex];

  useEffect(() => {
    if (currentQuestion?.id !== previousQuestionIdRef.current) {
        console.log("InterviewPage: Question changed. Resetting hasSpokenCurrentQuestion.");
        setHasSpokenCurrentQuestion(false);
        previousQuestionIdRef.current = currentQuestion?.id || null;
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
            console.log("InterviewPage: Cancelling speech from previous question.");
            window.speechSynthesis.cancel();
            setIsAISpeaking(false);
        }
    }

    if (currentQuestion && currentQuestion.stage === 'oral' && !currentQuestion.answer && !isEndingInterview && session?.status !== 'completed' && !isListening && !hasSpokenCurrentQuestion) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        console.log("InterviewPage: AI attempting to speak question:", currentQuestion.text);
        const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        utterance.onstart = () => {
            console.log("InterviewPage: AI speech started.");
            setIsAISpeaking(true);
        };
        utterance.onend = () => {
          console.log("InterviewPage: AI speech ended.");
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true);
        };
        utterance.onerror = (event) => {
          console.error('InterviewPage: SpeechSynthesis Error:', event);
          setIsAISpeaking(false);
          setHasSpokenCurrentQuestion(true); 
          toast({ title: "AI Voice Error", description: "Could not play AI voice.", variant: "destructive" });
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        console.log("InterviewPage: SpeechSynthesis API not available or conditions not met for speaking.");
        setIsAISpeaking(false);
      }
    } else if (currentQuestion?.stage !== 'oral' || currentQuestion?.answer || hasSpokenCurrentQuestion) {
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
            console.log("InterviewPage: Conditions for speaking not met, cancelling any ongoing speech.");
            window.speechSynthesis.cancel();
        }
        setIsAISpeaking(false);
    }
  }, [currentQuestion, isEndingInterview, session?.status, toast, isListening, hasSpokenCurrentQuestion]);


  const handleToggleListening = useCallback(() => {
    if (!speechRecognitionSupported) {
      toast({ title: "Speech Recognition Not Supported", description: "Cannot start voice input.", variant: "destructive"});
      return;
    }

    if (isListening) { 
      console.log("InterviewPage: handleToggleListening - Stopping listening.");
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false); 
    } else { 
      console.log("InterviewPage: handleToggleListening - Starting listening.");
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        console.log("InterviewPage: Cancelling AI speech before starting user listening.");
        window.speechSynthesis.cancel(); 
        setIsAISpeaking(false);
        setHasSpokenCurrentQuestion(true); 
      }

      setUserAnswer(''); 
      setSpeechError(null);

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) { 
        console.log("InterviewPage: Initializing new SpeechRecognition instance.");
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
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setUserAnswer(finalTranscript.trim() + (interimTranscript ? (finalTranscript.trim() ? ' ' : '') + interimTranscript : ''));
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("InterviewPage: Speech recognition error", event.error);
          let errorMsg = "Speech recognition error: " + event.error;
          if (event.error === 'no-speech') errorMsg = "No speech detected. Please try again.";
          if (event.error === 'audio-capture') errorMsg = "Audio capture failed. Check microphone permissions.";
          if (event.error === 'not-allowed') errorMsg = "Microphone access denied. Please grant permission.";
          setSpeechError(errorMsg);
          setIsListening(false); 
        };

        recognitionRef.current.onend = () => {
          console.log("InterviewPage: Speech recognition ended.");
          setIsListening(false);
        };
      }
      
      recognitionRef.current.start();
    }
  }, [isListening, speechRecognitionSupported, toast]);


  const handleNextQuestion = async () => {
    if (!user || !session || !allQuestions.length || currentQuestionIndex >= allQuestions.length) {
        console.warn("InterviewPage: handleNextQuestion - Preconditions not met. User, session, or questions invalid.");
        return;
    }
    
    if (isListening) {
      console.log("InterviewPage: handleNextQuestion - Stopping speech recognition first.");
      stopSpeechRecognition();
    }
    if (isAISpeaking) {
       console.log("InterviewPage: handleNextQuestion - Cancelling AI speech first.");
       cancelSpeechSynthesis();
       setHasSpokenCurrentQuestion(true); 
    }

    setIsSubmittingAnswer(true);
    console.log("InterviewPage: handleNextQuestion - Submitting answer for question index:", currentQuestionIndex);

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
        console.log("InterviewPage: Intermediate progress saved to Firestore.");
    } catch (error) {
        console.error("InterviewPage: Error saving intermediate progress:", error);
        toast({title: "Save Error", description: "Could not save current answer. Please check connection.", variant: "destructive"})
    }

    setUserAnswer(""); 
    setSpeechError(null);
    setHasSpokenCurrentQuestion(false); 
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      console.log("InterviewPage: Moving to next question, index:", nextQuestionIndex);
    } else {
      console.log("InterviewPage: All questions answered. Ending interview.");
      await handleEndInterview(updatedQuestions, updatedTranscriptLogArray.join('\\n'));
    }
    setIsSubmittingAnswer(false);
  };

  const handleEndInterview = async (finalQuestionsData: AnsweredQuestion[], finalTranscriptString: string) => {
    if (!user || !interviewId || !session || !userProfile) {
      toast({ title: "Error", description: "User or session data missing.", variant: "destructive" });
      setIsEndingInterview(false); 
      console.error("InterviewPage: handleEndInterview - User, interviewId, session, or userProfile missing.");
      return;
    }
    console.log("InterviewPage: handleEndInterview - Starting process.");
    setIsEndingInterview(true);
    toast({ title: "Interview Complete", description: "Finalizing and analyzing your feedback..." });

    console.log("InterviewPage: handleEndInterview - Calling cancelSpeechSynthesis.");
    cancelSpeechSynthesis();
    console.log("InterviewPage: handleEndInterview - Calling stopSpeechRecognition.");
    stopSpeechRecognition();
    console.log("InterviewPage: handleEndInterview - Calling stopMediaTracks.");
    stopMediaTracks(); 

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
      console.log("InterviewPage: Interview session status updated to 'completed'.");

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      console.log("InterviewPage: User interviewsTaken count updated.");
      await refreshUserProfile(); 
      console.log("InterviewPage: User profile refreshed in context.");
      
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        questions: questionsToStore,
        jobDescription: userProfile.role || "General Role", 
        candidateProfile: `Field: ${userProfile.profileField}, Role: ${userProfile.role}, Education: ${userProfile.education}`,
        interviewTranscript: finalTranscriptString, 
      };
      console.log("InterviewPage: Generating feedback with input:", feedbackInput);
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      console.log("InterviewPage: Feedback generation complete.");
      
      await updateDoc(sessionDocRef, {
        feedback: feedbackResult,
      });
      console.log("InterviewPage: Feedback saved to Firestore.");

      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("InterviewPage: Error ending interview / getting feedback:", error);
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
                    {isListening ? "Speak now. Your transcribed answer will appear below." : (userAnswer ? "Review your transcribed answer or listen again." : "Click the mic to speak your answer.")}
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

    