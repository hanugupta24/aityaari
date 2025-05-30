
"use client";

import React, { useEffect, useState, useRef, useCallback }
from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, Video, Terminal, AlertTriangle, Volume2, MicOff, TimerIcon, EyeOff, Zap, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InterviewSession, GeneratedQuestion } from "@/types";
import { analyzeInterviewFeedback, type AnalyzeInterviewFeedbackInput } from "@/ai/flows/analyze-interview-feedback";
import { Progress } from "@/components/ui/progress";

interface AnsweredQuestion extends GeneratedQuestion {
  answer?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    speechSynthesis: SpeechSynthesis;
  }
}

// Proctoring Constants
const FACE_DETECTION_INTERVAL_MS = 5 * 1000; // Check face presence every ~5s for simple warning
const CONSECUTIVE_NO_FACE_CHECKS_TO_WARN_FACE_AWAY = 1; // How many consecutive checks must fail to trigger a warning

const PROLONGED_FACE_ABSENCE_TIMEOUT_MS = 60 * 1000; // 1 minute of continuous absence terminates
const INACTIVITY_TIMEOUT_ORAL_MS = 60 * 1000; // 1 minute
const INACTIVITY_TIMEOUT_WRITTEN_MS = 2 * 60 * 1000; // 2 minutes
const ON_SCREEN_WARNING_DURATION_MS = 7000; // How long simple warnings stay on screen

const DISTRACTION_CHECK_INTERVAL_MS = 20 * 1000; 
const DISTRACTION_PROBABILITY = 0.15; 


type ProctoringIssueType = 'tabSwitch' | 'faceNotDetected_short' | 'task_inactivity' | 'distraction';
type OnScreenWarning = { type: ProctoringIssueType | 'none'; message: string | null };


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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [timeLeftInSeconds, setTimeLeftInSeconds] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Proctoring States
  const [proctoringIssues, setProctoringIssues] = useState<{
    tabSwitch: number;
    faceNotDetected: number; 
    task_inactivity: number; 
    distraction: number; 
  }>({ tabSwitch: 0, faceNotDetected: 0, task_inactivity: 0, distraction: 0 });
  
  const [isFaceCurrentlyVisible, setIsFaceCurrentlyVisible] = useState(true); 
  const [continuousFaceNotDetectedStartTime, setContinuousFaceNotDetectedStartTime] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  
  const [onScreenProctoringWarning, setOnScreenProctoringWarning] = useState<OnScreenWarning>({ type: 'none', message: null });
  const onScreenWarningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveNoFaceChecksRef = useRef(0);


  // Refs for state values used in callbacks to avoid stale closures
  const isEndingInterviewRef = useRef(isEndingInterview);
  useEffect(() => { isEndingInterviewRef.current = isEndingInterview; }, [isEndingInterview]);
  
  const allQuestionsRef = useRef(allQuestions);
  useEffect(() => { allQuestionsRef.current = allQuestions; }, [allQuestions]);
  
  const transcriptLogRef = useRef(transcriptLog);
  useEffect(() => { transcriptLogRef.current = transcriptLog; }, [transcriptLog]);


  const isInterviewEffectivelyActive = useCallback(() => {
    return session && session.status !== "completed" && session.status !== "cancelled" && !isEndingInterviewRef.current;
  }, [session]);

  const stopMediaTracks = useCallback(() => {
    console.log("InterviewPage: stopMediaTracks called.");
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log("InterviewPage: MediaStream tracks stopped.");
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const videoStream = videoRef.current.srcObject as MediaStream;
      videoStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log("InterviewPage: Video element srcObject tracks stopped and cleared.");
    }
  }, []);
  
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort(); 
      recognitionRef.current.stop();
      console.log("InterviewPage: Speech recognition stopped.");
    }
    setIsListening(false);
  }, []);

  const cancelSpeechSynthesis = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        console.log("InterviewPage: Speech synthesis cancelled.");
      }
    }
    setIsAISpeaking(false);
  }, []);

  const handleEndInterview = useCallback(async (
    reason: "completed_by_user" | "time_up" | "prolonged_face_absence" | "all_questions_answered" | "tab_switch_limit" | "face_not_detected_limit",
    questionsDataParam?: AnsweredQuestion[],
    transcriptStringParam?: string
  ) => {
    const currentQuestions = questionsDataParam || allQuestionsRef.current;
    const currentTranscript = transcriptStringParam || transcriptLogRef.current.join('\\n');

    if (!user || !interviewId || !session || !userProfile || isEndingInterviewRef.current) {
      if(!isEndingInterviewRef.current && (user && session)) { console.log("InterviewPage: handleEndInterview - User or session data missing or already ending. Skipping."); }
      else if (isEndingInterviewRef.current) console.log("InterviewPage: handleEndInterview - Already ending, skipping.");
      return;
    }
    
    console.log(`InterviewPage: handleEndInterview called with reason: ${reason}`);
    setIsEndingInterview(true); 
    isEndingInterviewRef.current = true; 

    let toastMessage = "Finalizing and analyzing your feedback...";
    let toastTitle = "Interview Ended";

    switch(reason) {
        case "time_up": toastTitle = "Time's Up!"; toastMessage = "The interview time has concluded."; break;
        case "prolonged_face_absence": toastTitle = "Proctoring Alert"; toastMessage = "Interview terminated due to prolonged absence from screen."; break;
        case "all_questions_answered": toastTitle = "Interview Complete"; break;
        case "completed_by_user": toastTitle = "Interview Submitted"; break;
        case "tab_switch_limit": toastTitle = "Proctoring Alert"; toastMessage = "Interview terminated due to excessive tab switching."; break;
        case "face_not_detected_limit": toastTitle = "Proctoring Alert"; toastMessage = "Interview terminated due to face not being consistently visible."; break;

    }
   
    toast({ title: toastTitle, description: toastMessage, variant: "destructive", duration: 7000 });

    cancelSpeechSynthesis();
    stopSpeechRecognition();
    stopMediaTracks(); 

    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }
    if (onScreenWarningTimerRef.current) {
      clearTimeout(onScreenWarningTimerRef.current);
      onScreenWarningTimerRef.current = null;
    }
    setOnScreenProctoringWarning({ type: 'none', message: null });


    try {
      const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
      const questionsToStore = currentQuestions.map(q => ({
        id: q.id, text: q.text, stage: q.stage, type: q.type, answer: q.answer || "",
      }));

      await updateDoc(sessionDocRef, {
        status: "completed", 
        questions: questionsToStore,
        transcript: currentTranscript,
        updatedAt: new Date().toISOString(),
        endedReason: reason, 
        proctoringIssues: proctoringIssues 
      });
      
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interviewsTaken: (userProfile.interviewsTaken || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      
      refreshUserProfile().catch(err => console.error("AuthContext: Error refreshing user profile after interview:", err));
      
      console.log("InterviewPage: Fetching AI feedback...");
      const feedbackInput: AnalyzeInterviewFeedbackInput = {
        questions: questionsToStore,
        jobDescription: userProfile.role || "General Role",
        candidateProfile: `Field: ${userProfile.profileField}, Role: ${userProfile.role}, Education: ${userProfile.education}, Skills: ${userProfile.skills || 'Not specified'}`,
        interviewTranscript: currentTranscript,
      };
      const feedbackResult = await analyzeInterviewFeedback(feedbackInput);
      await updateDoc(sessionDocRef, { feedback: feedbackResult });
      console.log("InterviewPage: AI feedback stored. Navigating to feedback page.");
      router.push(`/feedback/${interviewId}`);

    } catch (error: any) {
      console.error("InterviewPage: Error ending interview / getting feedback:", error);
      toast({ title: "Error Finalizing Interview", description: error.message || "Failed to finalize and get feedback. Please check your past interviews later.", variant: "destructive", duration: 10000 });
      router.push('/dashboard'); 
    }
  }, [user, interviewId, session, userProfile, router, toast, refreshUserProfile, cancelSpeechSynthesis, stopSpeechRecognition, stopMediaTracks, proctoringIssues]);


  // Main useEffect for Firestore listener, media setup, and cleanup
  useEffect(() => {
    if (!user || !interviewId) { setIsLoading(false); return; }
    setIsLoading(true);
    console.log(`InterviewPage: Main useEffect - Setting up for user ${user.uid}, interview ${interviewId}`);
    const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
    
    let unsubscribe: Unsubscribe | null = null;
    try {
      unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
        if (isEndingInterviewRef.current) { console.log("InterviewPage: Firestore listener - interview ending, skipping snapshot update."); return; }
        if (docSnap.exists()) {
          const data = docSnap.data() as InterviewSession;
          setSession(data);
          setTranscriptLog(data.transcript ? data.transcript.split('\\n') : []);

          if ((data.status === "completed" || data.status === "cancelled")) {
             if (!isEndingInterviewRef.current) {
                console.log("InterviewPage: Firestore listener - Session already completed/cancelled. Redirecting.");
                toast({ title: "Interview Ended", description: "This interview session is no longer active."});
                router.push("/dashboard"); 
             }
            return;
          }
          
          if (data.questions && data.questions.length > 0) {
            const sortedQuestions = data.questions.map(q => ({...q, answer: q.answer || ""}))
              .sort((a, b) => {
                  if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
                  if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
                  const idANum = parseInt((a.id || 'q0').substring(1)) || 0;
                  const idBNum = parseInt((b.id || 'q0').substring(1)) || 0;
                  return idANum - idBNum;
              });
            setAllQuestions(sortedQuestions);
            const firstUnansweredIndex = sortedQuestions.findIndex(q => !q.answer);
            setCurrentQuestionIndex(firstUnansweredIndex > -1 ? firstUnansweredIndex : (data.questions.length > 0 ? data.questions.length -1 : 0));
          } else {
            toast({ title: "Error", description: "No questions found for this session. Please start a new interview.", variant: "destructive" });
            if(!isEndingInterviewRef.current) router.push("/interview/start");
          }
        } else {
          toast({ title: "Error", description: "Interview session not found.", variant: "destructive" });
          if(!isEndingInterviewRef.current) router.push("/dashboard");
        }
        setIsLoading(false);
      }, (error) => {
        console.error("InterviewPage: Error in Firestore onSnapshot:", error);
        toast({ title: "Firestore Error", description: "Could not listen to interview updates.", variant: "destructive" });
        setIsLoading(false);
      });
    } catch (e) { console.error("InterviewPage: Exception setting up Firestore listener:", e); setIsLoading(false); }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => { 
          mediaStreamRef.current = stream; 
          if (videoRef.current) videoRef.current.srcObject = stream; 
          console.log("InterviewPage: Camera and microphone access granted.");
        })
      .catch(err => {
          console.error("InterviewPage: Media access error:", err);
          toast({ title: "Media Error", description: "Could not access camera/microphone. Proctoring features may be limited.", variant: "destructive" });
      });
    
    return () => {
      console.log("InterviewPage: Main useEffect cleanup running.");
      if (unsubscribe) unsubscribe();
      cancelSpeechSynthesis(); stopSpeechRecognition(); stopMediaTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (onScreenWarningTimerRef.current) clearTimeout(onScreenWarningTimerRef.current);
    };
  }, [user, interviewId, router, toast, cancelSpeechSynthesis, stopSpeechRecognition, stopMediaTracks, handleEndInterview]);


  // Speech Recognition Supported Check
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
        setSpeechRecognitionSupported(true);
        console.log("InterviewPage: Speech recognition API supported.");
    } else {
      setSpeechRecognitionSupported(false);
      console.warn("InterviewPage: Speech recognition API not supported by this browser.");
      toast({ title: "Speech Input Not Supported", description: "Your browser doesn't support speech-to-text. You may need to type answers for oral questions.", variant: "default", duration: 7000 });
    }
  }, [toast]);

  // Load Speech Synthesis Voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
          console.log("InterviewPage: Speech synthesis voices loaded:", voices.length);
          window.speechSynthesis.onvoiceschanged = null; 
        }
      }
    };
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      loadVoices(); 
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = loadVoices; 
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const currentQuestion = allQuestions[currentQuestionIndex];
  
  // AI Speech Synthesis (Question Dictation)
  useEffect(() => {
    if (currentQuestion && currentQuestion.stage === 'oral' && !currentQuestion.answer && isInterviewEffectivelyActive() && !hasSpokenCurrentQuestion && !isAISpeaking && availableVoices.length > 0) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if(window.speechSynthesis.speaking) {
            console.log("InterviewPage: AI was already speaking, cancelling before new utterance for question:", currentQuestion.id);
            window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
        utterance.lang = 'en-US'; utterance.rate = 0.9;
        
        let desiredVoice = availableVoices.find(voice => voice.lang.startsWith('en-IN') && voice.name.toLowerCase().includes('female'));
        if (!desiredVoice) desiredVoice = availableVoices.find(voice => voice.lang.startsWith('en-IN'));
        if (!desiredVoice) desiredVoice = availableVoices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('female'));
        if (!desiredVoice) desiredVoice = availableVoices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('google'));
        if (!desiredVoice) desiredVoice = availableVoices.find(voice => voice.lang === 'en-US');
        
        if (desiredVoice) {
          utterance.voice = desiredVoice;
          console.log("InterviewPage: Using voice for AI dictation:", desiredVoice.name, desiredVoice.lang);
        } else {
          console.log("InterviewPage: No specific Indian accent or 'en-US Female/Google' voice found, using browser default for AI dictation.");
        }

        utterance.onstart = () => { setIsAISpeaking(true); console.log("InterviewPage: AI speech started for question:", currentQuestion.id);};
        utterance.onend = () => { setIsAISpeaking(false); setHasSpokenCurrentQuestion(true); setLastActivityTime(Date.now()); console.log("InterviewPage: AI speech ended for question:", currentQuestion.id);};
        utterance.onerror = (event) => {
          console.error('InterviewPage: SpeechSynthesis Error. Utterance text was:', `"${utterance.text}"`, 'Error event:', event);
          setIsAISpeaking(false); 
          setHasSpokenCurrentQuestion(true); 
          toast({ title: "AI Voice Error", description: "Could not play AI voice. Please read the question.", variant: "destructive" });
        };
        window.speechSynthesis.speak(utterance);
      }
    } else if (isAISpeaking && (!isInterviewEffectivelyActive() || (currentQuestion && currentQuestion.stage !== 'oral') || (currentQuestion && currentQuestion.answer) || hasSpokenCurrentQuestion)) {
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
            console.log("InterviewPage: Conditions for AI speaking no longer met, cancelling speech.");
            window.speechSynthesis.cancel();
        }
        setIsAISpeaking(false);
    }
  }, [currentQuestion, isInterviewEffectivelyActive, toast, hasSpokenCurrentQuestion, isAISpeaking, availableVoices]);


  // Interview Timer Initialization
  useEffect(() => {
    if (session && session.duration && isInterviewEffectivelyActive() && timeLeftInSeconds === null) {
      setTimeLeftInSeconds(session.duration * 60);
      setLastActivityTime(Date.now()); 
      console.log(`InterviewPage: Interview timer initialized to ${session.duration * 60} seconds.`);
    }
  }, [session, isInterviewEffectivelyActive, timeLeftInSeconds]);

  // Interview Timer Countdown
  useEffect(() => {
    if (isInterviewEffectivelyActive() && timeLeftInSeconds !== null && timeLeftInSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeftInSeconds(prevTime => {
          if (prevTime === null) return null;
          if (prevTime <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (!isEndingInterviewRef.current) {
                handleEndInterview("time_up", allQuestionsRef.current, transcriptLogRef.current.join('\\n'));
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timeLeftInSeconds === 0 && timerIntervalRef.current) {
         clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [isInterviewEffectivelyActive, timeLeftInSeconds, handleEndInterview]); 


  const showOnScreenWarning = useCallback((type: ProctoringIssueType, message: string) => {
    if (isEndingInterviewRef.current) return;

    if (onScreenWarningTimerRef.current) {
      clearTimeout(onScreenWarningTimerRef.current);
      console.log("InterviewPage: Cleared existing on-screen warning timer.");
    }
    setOnScreenProctoringWarning({ type, message });
    console.log(`InterviewPage: Showing on-screen warning: ${type} - ${message}`);

    onScreenWarningTimerRef.current = setTimeout(() => {
      setOnScreenProctoringWarning({ type: 'none', message: null });
      console.log("InterviewPage: On-screen warning timer expired, clearing warning.");
      onScreenWarningTimerRef.current = null; 
    }, ON_SCREEN_WARNING_DURATION_MS);
  }, []); 

  const logProctoringEvent = useCallback((type: ProctoringIssueType) => {
    if (!isInterviewEffectivelyActive() || isEndingInterviewRef.current) return;
    console.log(`InterviewPage: Proctoring event logged - ${type}`);
    setProctoringIssues(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
  }, [isInterviewEffectivelyActive]);

  // Simple Warning: Tab Switch (No termination)
  const prevTabSwitchCountRef = useRef(proctoringIssues.tabSwitch);
  useEffect(() => {
    if (!isInterviewEffectivelyActive() || isEndingInterviewRef.current) return;
    const currentTabSwitches = proctoringIssues.tabSwitch;
    if (currentTabSwitches > prevTabSwitchCountRef.current) {
      console.log(`InterviewPage: Tab switch detected (simple warning). Count: ${currentTabSwitches}`);
      showOnScreenWarning('tabSwitch', "Warning: Please remain focused on the interview tab.");
    }
    prevTabSwitchCountRef.current = currentTabSwitches;
  }, [proctoringIssues.tabSwitch, isInterviewEffectivelyActive, showOnScreenWarning]);

  // Simple Warning: Face Not Detected (Short Absence ~5s - No termination)
  const prevFaceNotDetectedShortCountRef = useRef(proctoringIssues.faceNotDetected); // Now just 'faceNotDetected'
  useEffect(() => {
    if (!isInterviewEffectivelyActive() || isEndingInterviewRef.current) return;
    if (proctoringIssues.faceNotDetected > prevFaceNotDetectedShortCountRef.current) {
        console.log(`InterviewPage: Short face absence warning (simple warning). Count: ${proctoringIssues.faceNotDetected}`);
        showOnScreenWarning('faceNotDetected_short', "Reminder: Please ensure your face is visible to the camera.");
    }
    prevFaceNotDetectedShortCountRef.current = proctoringIssues.faceNotDetected;
  }, [proctoringIssues.faceNotDetected, isInterviewEffectivelyActive, showOnScreenWarning]);


  // Simple Warning: Task Inactivity (No termination)
  const prevTaskInactivityCountRef = useRef(proctoringIssues.task_inactivity);
  useEffect(() => {
    if (!isInterviewEffectivelyActive() || isEndingInterviewRef.current) return;
    if (proctoringIssues.task_inactivity > prevTaskInactivityCountRef.current) {
      console.log(`InterviewPage: Task inactivity warning (simple warning). Count: ${proctoringIssues.task_inactivity}`);
      showOnScreenWarning('task_inactivity', "Reminder: Please continue with your answer.");
    }
    prevTaskInactivityCountRef.current = proctoringIssues.task_inactivity;
  }, [proctoringIssues.task_inactivity, isInterviewEffectivelyActive, showOnScreenWarning]);
  
  // Simple Warning: Distraction (No termination)
  const prevDistractionCountRef = useRef(proctoringIssues.distraction);
  useEffect(() => {
    if (!isInterviewEffectivelyActive() || isEndingInterviewRef.current) return;
    if (proctoringIssues.distraction > prevDistractionCountRef.current) {
      console.log(`InterviewPage: Distraction warning (simple warning). Count: ${proctoringIssues.distraction}`);
      showOnScreenWarning('distraction', "Proctoring: Attention Reminder - Please try to maintain focus on the screen.");
    }
    prevDistractionCountRef.current = proctoringIssues.distraction;
  }, [proctoringIssues.distraction, isInterviewEffectivelyActive, showOnScreenWarning]);


  // Proctoring: Tab Switch Listener
  const handleFocusChange = useCallback(() => {
    if (!isEndingInterviewRef.current && isInterviewEffectivelyActive()) {
      console.log("InterviewPage: Window/tab focus lost or changed. Logging tabSwitch event.");
      logProctoringEvent('tabSwitch');
    }
  }, [isInterviewEffectivelyActive, logProctoringEvent]); 

  useEffect(() => {
    const handleVisibilityChange = () => { if (document.hidden && isInterviewEffectivelyActive() && !isEndingInterviewRef.current) handleFocusChange(); };
    const handleWindowBlur = () => { if (!document.hasFocus() && isInterviewEffectivelyActive() && !isEndingInterviewRef.current) handleFocusChange(); };

    if (isInterviewEffectivelyActive()) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("blur", handleWindowBlur);
    }
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isInterviewEffectivelyActive, handleFocusChange]);


  // Proctoring: Face Presence Detection (for short absence SIMPLE warning & prolonged absence TERMINATION)
  useEffect(() => {
    let faceDetectionInterval: NodeJS.Timeout | null = null;
    const mockCheckFacePresence = (): boolean => {
        const isPresent = Math.random() > 0.1; // Simulates face presence ~90% of the time
        setIsFaceCurrentlyVisible(isPresent);
        return isPresent;
    };

    if (isInterviewEffectivelyActive()) {
      faceDetectionInterval = setInterval(() => {
        if (isEndingInterviewRef.current) return;
        
        const facePresent = mockCheckFacePresence();
        
        if (!facePresent) {
            consecutiveNoFaceChecksRef.current += 1;
            if (consecutiveNoFaceChecksRef.current >= CONSECUTIVE_NO_FACE_CHECKS_TO_WARN_FACE_AWAY) {
                logProctoringEvent('faceNotDetected'); 
                consecutiveNoFaceChecksRef.current = 0; 
            }
            if (continuousFaceNotDetectedStartTime === null) {
                console.log("InterviewPage: Continuous face not detected timer started.");
                setContinuousFaceNotDetectedStartTime(Date.now());
            }
        } else {
            consecutiveNoFaceChecksRef.current = 0; 
            if (continuousFaceNotDetectedStartTime !== null) {
                 console.log("InterviewPage: Continuous face not detected timer reset (face now visible).");
            }
            setContinuousFaceNotDetectedStartTime(null); 
        }
      }, FACE_DETECTION_INTERVAL_MS);
    }
    return () => { if (faceDetectionInterval) clearInterval(faceDetectionInterval); };
  }, [isInterviewEffectivelyActive, logProctoringEvent, continuousFaceNotDetectedStartTime]);

  // Proctoring: Prolonged Face Absence Termination (Direct termination)
  useEffect(() => {
      if (isInterviewEffectivelyActive() && continuousFaceNotDetectedStartTime !== null) {
          const durationAway = Date.now() - continuousFaceNotDetectedStartTime;
          if (durationAway > PROLONGED_FACE_ABSENCE_TIMEOUT_MS) {
              if (!isEndingInterviewRef.current) {
                  console.log("InterviewPage: Terminating interview due to prolonged face absence (more than 1 min).");
                  handleEndInterview('prolonged_face_absence', allQuestionsRef.current, transcriptLogRef.current.join('\\n'));
              }
          }
      }
  }, [isFaceCurrentlyVisible, continuousFaceNotDetectedStartTime, isInterviewEffectivelyActive, handleEndInterview]); 


  // Proctoring: Task Inactivity (No Speech/Typing - simple warning)
  useEffect(() => {
    let inactivityInterval: NodeJS.Timeout | null = null;
    if (isInterviewEffectivelyActive() && currentQuestion) {
      const timeoutDuration = currentQuestion.stage === 'oral' ? INACTIVITY_TIMEOUT_ORAL_MS : INACTIVITY_TIMEOUT_WRITTEN_MS;
      inactivityInterval = setInterval(() => {
        if (isEndingInterviewRef.current) return;
        if (isListening || isAISpeaking) { 
            setLastActivityTime(Date.now()); 
            return;
        }
        if (Date.now() - lastActivityTime > timeoutDuration) {
          console.log("InterviewPage: Task inactivity detected, logging event for simple warning.");
          logProctoringEvent('task_inactivity');
          setLastActivityTime(Date.now()); 
        }
      }, 30000); 
    }
    return () => { if (inactivityInterval) clearInterval(inactivityInterval); };
  }, [isInterviewEffectivelyActive, currentQuestion, lastActivityTime, logProctoringEvent, isListening, isAISpeaking]);

  // Proctoring: Distraction Detection (Simulated - for simple warning)
  useEffect(() => {
    let distractionInterval: NodeJS.Timeout | null = null;
    if (isInterviewEffectivelyActive()) {
        distractionInterval = setInterval(() => {
            if (isEndingInterviewRef.current) return;
            if (Math.random() < DISTRACTION_PROBABILITY) {
                console.log("InterviewPage: Simulated distraction detected, logging event for simple warning.");
                logProctoringEvent('distraction');
            }
        }, DISTRACTION_CHECK_INTERVAL_MS);
    }
    return () => { if (distractionInterval) clearInterval(distractionInterval); };
  }, [isInterviewEffectivelyActive, logProctoringEvent]);


  const handleToggleListening = useCallback(() => {
    if (!speechRecognitionSupported) {
      toast({ title: "Speech Input Not Supported", description: "Cannot start voice input. Please type your answer if possible or contact support.", variant: "destructive"});
      return;
    }
    if (isListening) { 
      if (recognitionRef.current) {
          console.log("InterviewPage: Manually stopping listening via button.");
          recognitionRef.current.stop(); 
          setIsListening(false);
      }
    } else { 
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel(); 
        setIsAISpeaking(false); 
        setHasSpokenCurrentQuestion(true);
      }
      setUserAnswer(''); 
      setSpeechError(null); 
      setLastActivityTime(Date.now());

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = true; 
        recognitionRef.current.interimResults = true; 
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onstart = () => { 
            setIsListening(true); 
            setSpeechError(null); 
            console.log("InterviewPage: Speech recognition started.");
        };
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscriptAggregated = '';
          let interimTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscriptAggregated += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript = event.results[i][0].transcript;
            }
          }
          const currentAnswerDisplay = (finalTranscriptAggregated.trim() + (interimTranscript ? (finalTranscriptAggregated.trim() ? ' ' : '') + interimTranscript : '')).trim();
          setUserAnswer(currentAnswerDisplay);
          if (finalTranscriptAggregated.trim()) setLastActivityTime(Date.now()); 
        };

        recognitionRef.current.onerror = (event: any) => {
          let errorMsg = "Speech error: " + event.error;
          if (event.error === 'no-speech') errorMsg = "No speech detected. Please ensure your microphone is working and try again.";
          if (event.error === 'audio-capture') errorMsg = "Audio capture failed. Please check microphone permissions and hardware.";
          if (event.error === 'not-allowed') errorMsg = "Microphone access denied. Please enable microphone permissions in your browser settings.";
          setSpeechError(errorMsg); 
          setIsListening(false);
          console.error("InterviewPage: Speech recognition error:", event.error, errorMsg);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false); 
            console.log("InterviewPage: Speech recognition ended.");
        };
      }
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("InterviewPage: Error starting speech recognition:", e);
        setSpeechError("Failed to start voice input. Please ensure microphone access is granted.");
        setIsListening(false);
      }
    }
  }, [isListening, speechRecognitionSupported, toast]);

  const handleNextQuestion = useCallback(async () => {
    if (!user || !session || !allQuestionsRef.current.length || currentQuestionIndex >= allQuestionsRef.current.length || isEndingInterviewRef.current) {
        console.warn("InterviewPage: handleNextQuestion - Preconditions not met or interview ending.");
        return;
    }
    
    if (isListening) stopSpeechRecognition();
    if (isAISpeaking) { cancelSpeechSynthesis(); setHasSpokenCurrentQuestion(true); }

    setIsSubmittingAnswer(true);
    setLastActivityTime(Date.now());

    const updatedQuestions = [...allQuestionsRef.current];
    const currentQ = updatedQuestions[currentQuestionIndex];
    currentQ.answer = userAnswer.trim();
    setAllQuestions(updatedQuestions); 
     

    const newTranscriptLogEntries = [
        `AI (${currentQ.stage} - ${currentQ.type}): ${currentQ.text}`,
        `You: ${userAnswer.trim() || (currentQ.stage === 'oral' ? "[No verbal answer recorded]" : "[No answer provided]")}`
    ];
    const updatedTranscriptLogArray = [...transcriptLogRef.current, ...newTranscriptLogEntries];
    setTranscriptLog(updatedTranscriptLogArray); 
    
    try {
        const sessionDocRef = doc(db, "users", user.uid, "interviews", interviewId);
        await updateDoc(sessionDocRef, {
            questions: updatedQuestions.map(({answer, ...q}) => ({...q, answer: answer || ""})),
            transcript: updatedTranscriptLogArray.join('\\n'),
            updatedAt: new Date().toISOString(),
        });
        console.log("InterviewPage: Answer saved to Firestore.");
    } catch (error) { 
        console.error("InterviewPage: Error saving answer to Firestore:", error);
        toast({title: "Save Error", description: "Could not save your answer to the database.", variant: "destructive"});
    }

    setUserAnswer(""); setSpeechError(null); 
    setHasSpokenCurrentQuestion(false); 
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < allQuestionsRef.current.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      console.log(`InterviewPage: Moving to question ${nextQuestionIndex + 1}.`);
    } else {
      console.log("InterviewPage: All questions answered. Ending interview.");
      await handleEndInterview("all_questions_answered", updatedQuestions, updatedTranscriptLogArray.join('\\n'));
    }
    setIsSubmittingAnswer(false);
  }, [user, session, interviewId, currentQuestionIndex, userAnswer, isListening, stopSpeechRecognition, isAISpeaking, cancelSpeechSynthesis, toast, handleEndInterview]);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (currentQuestion?.stage === 'technical_written') {
        e.preventDefault();
        toast({ title: "Pasting Disabled", description: "Please type your answer directly for technical questions.", variant: "default", duration: 3000 });
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  if (!session || !allQuestions.length || (currentQuestionIndex >= allQuestions.length && !isEndingInterviewRef.current && session.status !== 'completed')) {
    if (isEndingInterviewRef.current) {
      return (<div className="flex flex-col justify-center items-center h-screen p-4"><Card className="max-w-lg text-center"><CardHeader><CardTitle>Processing Results...</CardTitle></CardHeader><CardContent><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></CardContent></Card></div >);
    }
    return (<div className="flex flex-col justify-center items-center h-screen p-4"><Alert variant="destructive" className="max-w-lg"><AlertTriangle className="h-4 w-4" /><AlertTitle>Interview Data Issue</AlertTitle><AlertDescription>Problem loading questions or session ended unexpectedly.</AlertDescription></Alert><Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button></div >);
  }
  
  const totalQuestions = allQuestions.length;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex +1) / totalQuestions) * 100 : 0;
  const currentStage = currentQuestion?.stage;
  const currentQuestionType = currentQuestion?.type;

  const isSubmitButtonDisabled = isSubmittingAnswer || isEndingInterviewRef.current || isAISpeaking || isListening || (currentStage === 'technical_written' && !userAnswer.trim());

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
            {/* Display on-screen warning if active */}
            {onScreenProctoringWarning.message && (
              <Alert variant="default" className="mt-2 border-yellow-500 text-yellow-700 dark:border-yellow-400 dark:text-yellow-300">
                <Info className="h-4 w-4 !text-yellow-500 dark:!text-yellow-400" />
                <AlertTitle className="text-yellow-700 dark:text-yellow-300">Proctoring Notice</AlertTitle>
                <AlertDescription className="text-yellow-600 dark:text-yellow-200">{onScreenProctoringWarning.message}</AlertDescription>
              </Alert>
            )}
            {/* Display constant "Face Not Visible?" alert only if no other on-screen warning is active */}
            {!isFaceCurrentlyVisible && isInterviewEffectivelyActive() && !onScreenProctoringWarning.message && (
                <Alert variant="default" className="mt-2 border-amber-500 text-amber-700 dark:text-amber-300">
                    <EyeOff className="h-4 w-4 !text-amber-500 dark:!text-amber-400" />
                    <AlertTitle className="text-amber-700 dark:text-amber-300">Face Not Visible?</AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-200">Please ensure your face is clearly visible in the camera.</AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Transcript Log</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto space-y-2 p-2 bg-muted/50 rounded-b-md">
            {transcriptLog.map((line, index) => (<p key={index} className={`text-sm p-2 rounded-md ${line.startsWith("AI") ? "bg-secondary text-secondary-foreground self-start mr-auto max-w-[90%]" : "bg-primary text-primary-foreground self-end ml-auto max-w-[90%]"}`}>{line}</p>))}
            {isSubmittingAnswer && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
          </CardContent>
        </Card>
      </div>

      <div className="lg:w-2/3 flex flex-col">
       {isInterviewEffectivelyActive() && currentQuestion ? (
        <Card className="flex-grow flex flex-col shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-2xl">Question {currentQuestionIndex + 1} of {totalQuestions}</CardTitle>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground"><TimerIcon className="h-5 w-5" /><span>Time Left: {formatTime(timeLeftInSeconds)}</span></div>
            </div>
            <Progress value={progress} className="w-full h-2" />
            {currentQuestion && (<CardDescription className="text-lg pt-4 whitespace-pre-wrap pb-0">{currentQuestion.text}</CardDescription>)}
             {isAISpeaking && currentStage === 'oral' && (
                <div className="flex items-center text-primary pt-1 pl-1">
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
                  <p className="text-sm text-muted-foreground mb-2">{isListening ? "Speak now. Your transcribed answer will appear below." : (userAnswer ? "Review your transcribed answer or listen again." : "Click the mic to speak your answer.")}</p>
                  <Textarea 
                    placeholder={isListening ? "Listening... Speak now." : (userAnswer ? userAnswer : "Your transcribed answer will appear here...")} 
                    value={userAnswer} 
                    readOnly 
                    className="text-base min-h-[100px] mb-4 bg-background/70 cursor-not-allowed" 
                    disabled={isSubmittingAnswer || isEndingInterviewRef.current || isAISpeaking} 
                  />
                  {speechError && <Alert variant="destructive" className="mb-2"><AlertTriangle className="h-4 w-4" /><AlertTitle>Speech Error</AlertTitle><AlertDescription>{speechError}</AlertDescription></Alert>}
                </div>
                 <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={handleToggleListening} disabled={isSubmittingAnswer || isEndingInterviewRef.current || isAISpeaking || !speechRecognitionSupported} className={isListening ? "border-red-500 text-red-500 hover:bg-red-500/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10" : ""}>
                      {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                      {isListening ? "Stop Listening" : (userAnswer ? "Listen Again (clears previous)" : "Start Listening")}
                    </Button>
                    {!speechRecognitionSupported && <p className="text-xs text-destructive">Voice input not supported by browser.</p>}
                 </div>
              </div>
            ) : ( 
               <div className="flex-grow flex flex-col">
                <div className="flex items-center text-sm text-muted-foreground mb-2 gap-1"><Terminal className="h-4 w-4" /><span>{currentQuestion?.type === 'coding' ? "Write your code below. Pasting is disabled." : "Provide your detailed answer below. Pasting is disabled."}</span></div>
                <Textarea placeholder={currentQuestion?.type === 'coding' ? "// Your code here..." : "Your detailed answer..."} className="flex-grow font-mono text-sm min-h-[200px] bg-background/70" value={userAnswer} onChange={(e) => { setUserAnswer(e.target.value); setLastActivityTime(Date.now()); }} onPaste={handlePaste} disabled={isSubmittingAnswer || isEndingInterviewRef.current || isAISpeaking} />
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-between items-center">
             <p className="text-sm text-muted-foreground">Interview Duration: {session.duration} mins</p>
            <div><Button onClick={handleNextQuestion} disabled={isSubmitButtonDisabled}>{isSubmittingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}{currentQuestionIndex < totalQuestions - 1 ? "Next Question" : "End Interview & Get Feedback"}</Button></div>
          </CardFooter>
        </Card>
         ) : ( 
          <Card className="flex-grow flex flex-col shadow-lg items-center justify-center"><CardHeader><CardTitle className="text-2xl">Interview Session {session?.status === 'completed' ? 'Completed' : (isEndingInterviewRef.current ? 'Ending...' : 'Ended')}</CardTitle></CardHeader><CardContent><p>Your responses are being processed or session has concluded.</p>{isEndingInterviewRef.current && <Loader2 className="h-8 w-8 animate-spin text-primary my-4" />}</CardContent><CardFooter><Button onClick={() => router.push('/dashboard')} variant="outline">Return to Dashboard</Button></CardFooter></Card>
         )}
      </div>
    </div>
  );
}

