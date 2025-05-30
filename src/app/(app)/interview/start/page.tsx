
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea
import { Loader2, Info, Video, Mic, AlertTriangle, UserX, FileText, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewQuestions, type GenerateInterviewQuestionsInput } from "@/ai/flows/generate-interview-questions";
import type { UserProfile, InterviewSession, GeneratedQuestion } from "@/types";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const LOCAL_STORAGE_RESUME_TEXT_KEY = 'tyaariResumeProcessedText';
const FREE_INTERVIEW_LIMIT = 3;

export default function StartInterviewPage() {
  const { user, userProfile, loading: authLoading, initialLoading: authInitialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [duration, setDuration] = useState<"15" | "30" | "45">("30");
  const [jobDescriptionInput, setJobDescriptionInput] = useState(""); // New state for job description
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [agreedToMonitoring, setAgreedToMonitoring] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);

  const handleStartInterview = async () => {
    if (!user || !userProfile) { 
      toast({ title: "Authentication Error", description: "Please ensure you are logged in and your profile is loaded.", variant: "destructive" });
      return;
    }
    if (!permissionsGranted) {
      toast({ title: "Permissions Required", description: "Please grant camera and microphone access.", variant: "destructive" });
      return;
    }
    if (!agreedToMonitoring) {
      toast({ title: "Agreement Required", description: "Please agree to the interview monitoring terms.", variant: "destructive" });
      return;
    }
     if (!userProfile.role || !userProfile.profileField) {
      toast({ title: "Profile Incomplete", description: "Please complete your role and profile field in your profile before starting an interview.", variant: "destructive" });
      router.push("/profile");
      return;
    }

    setIsStartingSession(true);
    toast({ title: "Preparing Interview", description: "Generating questions, please wait..." });

    try {
      const resumeProcessedTextFromLocalStorage = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY) : null;

      const questionGenInput: GenerateInterviewQuestionsInput = {
        profileField: userProfile.profileField,
        role: userProfile.role,
        interviewDuration: duration,
        resumeProcessedText: resumeProcessedTextFromLocalStorage || undefined, 
        jobDescription: jobDescriptionInput.trim() || undefined, // Pass job description
      };
      const questionGenOutput = await generateInterviewQuestions(questionGenInput);

      if (!questionGenOutput.questions || questionGenOutput.questions.length === 0) {
        toast({ title: "Question Generation Failed", description: "Could not generate interview questions. Please try again or check your profile details.", variant: "destructive" });
        setIsStartingSession(false);
        return;
      }

      const newInterviewRef = doc(collection(db, "users", user.uid, "interviews"));
      const interviewId = newInterviewRef.id;

      const initialSessionData: InterviewSession = {
        id: interviewId,
        userId: user.uid,
        duration: parseInt(duration) as 15 | 30 | 45,
        status: "questions_generated", 
        createdAt: new Date().toISOString(),
        questions: questionGenOutput.questions as GeneratedQuestion[],
        // Optionally store the jobDescription used for this session for later review
        jobDescriptionUsed: jobDescriptionInput.trim() || undefined,
      };
      await setDoc(newInterviewRef, initialSessionData);
      
      toast({ title: "Interview Ready!", description: "Redirecting to your session..." });
      router.push(`/interview/${interviewId}`);

    } catch (error: any) {
      console.error("Error starting interview:", error);
      let description = error.message || "An unexpected error occurred while starting the interview.";
       if (error.message && (error.message.includes("503") || error.message.toLowerCase().includes("overloaded") || error.message.toLowerCase().includes("service unavailable") || error.message.toLowerCase().includes("model is overloaded"))) {
        description = "The AI service is currently busy or unavailable. Please try again in a few moments.";
      }
      toast({ title: "Failed to Start Interview", description, variant: "destructive" });
      setIsStartingSession(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop()); 
      setPermissionsGranted(true);
      toast({ title: "Permissions Granted", description: "Camera and microphone access enabled." });
    } catch (err) {
      setPermissionsGranted(false);
      toast({ title: "Permissions Denied", description: "Camera and microphone access is required for the interview.", variant: "destructive" });
      console.error("Error accessing media devices.", err);
    }
  };

  useEffect(() => {
    if (!authInitialLoading && user && !userProfile && !authLoading) { 
        console.log("StartInterviewPage: Auth checked, user exists, but no profile. Forcing refresh.");
        refreshUserProfile(); 
    }
  }, [authInitialLoading, user, userProfile, authLoading, refreshUserProfile]);


  const isProfileEssentialDataMissing = userProfile && (!userProfile.role || !userProfile.profileField);
  const isProfileNotLoadedAndAuthChecked = !authInitialLoading && user && !userProfile && !authLoading;
  
  const interviewLimitReached = userProfile && !userProfile.isPlusSubscriber && (userProfile.interviewsTaken || 0) >= FREE_INTERVIEW_LIMIT;

  const isButtonDisabled = 
    authLoading || 
    authInitialLoading || 
    isStartingSession || 
    !permissionsGranted || 
    !agreedToMonitoring ||
    !userProfile || 
    isProfileNotLoadedAndAuthChecked || 
    isProfileEssentialDataMissing || 
    interviewLimitReached;
  
  const isLoadingState = authInitialLoading || (authLoading && !userProfile && !initialLoading);


  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Start Your Interview</CardTitle>
          <CardDescription>Choose your preferred interview duration and prepare for a focused session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingState && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <p>Loading your information...</p>
            </div>
          )}
          
          {!isLoadingState && isProfileNotLoadedAndAuthChecked && !userProfile && (
             <Alert variant="destructive">
              <UserX className="h-4 w-4" />
              <AlertTitle>Profile Not Loaded</AlertTitle>
              <AlertDescription>
                We couldn't load your profile data. Please ensure you have created or completed your profile. 
                <Link href="/profile" className="font-semibold underline hover:text-destructive-foreground/80 ml-1">
                  Go to Profile
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {!isLoadingState && userProfile && isProfileEssentialDataMissing && (
            <Alert variant="default" className="border-yellow-500 text-yellow-700 dark:border-yellow-400 dark:text-yellow-300">
              <Info className="h-4 w-4 !text-yellow-500 dark:!text-yellow-400" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-300">Profile Incomplete</AlertTitle>
              <AlertDescription className="text-yellow-600 dark:text-yellow-200">
                Your profile is missing key information like your 'Role' or 'Profile Field'. This is needed for tailored questions. 
                Please <Link href="/profile" className="font-semibold underline hover:text-yellow-800 dark:hover:text-yellow-100">complete your profile</Link>.
              </AlertDescription>
            </Alert>
          )}

          {!isLoadingState && !userProfile && !isProfileNotLoadedAndAuthChecked && !authLoading && (
             <Alert variant="destructive">
                <UserX className="h-4 w-4" />
                <AlertTitle>User Profile Not Found</AlertTitle>
                <AlertDescription>
                It seems you haven't created a profile yet, or we couldn't load it. Please 
                <Link href="/profile" className="font-semibold underline hover:text-destructive-foreground/80 ml-1">
                    go to your profile
                </Link>
                to create or complete it. Key details like your 'Role' and 'Profile Field' are needed for tailored interview questions.
                </AlertDescription>
            </Alert>
          )}
          
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Personalized Questions</AlertTitle>
            <AlertDescription>
              Interview questions will be based on your targeted role and profile field.
              Uploading your resume in the <Link href="/profile" className="font-semibold underline hover:text-foreground/80">profile section</Link> (text from it will be stored in your browser)
              and providing a job description below can further tailor questions to your experience and target role.
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-lg font-semibold mb-2 block">Select Interview Duration</Label>
            <RadioGroup defaultValue="30" onValueChange={(value: "15" | "30" | "45") => setDuration(value)} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              {["15", "30", "45"].map((d) => (
                <div key={d} className="flex items-center space-x-2">
                  <RadioGroupItem value={d} id={`duration-${d}`} disabled={isStartingSession || isLoadingState}/>
                  <Label htmlFor={`duration-${d}`} className="cursor-pointer">{d} minutes</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* New Job Description Textarea */}
          <div>
            <Label htmlFor="jobDescriptionInput" className="text-lg font-semibold mb-2 block flex items-center">
                <Briefcase className="h-5 w-5 mr-2 text-primary" />
                Targeted Job Description (Optional)
            </Label>
            <Textarea
                id="jobDescriptionInput"
                placeholder="Paste the job description here to get more aligned questions..."
                value={jobDescriptionInput}
                onChange={(e) => setJobDescriptionInput(e.target.value)}
                rows={6}
                className="text-sm"
                disabled={isStartingSession || isLoadingState}
            />
            <p className="text-xs text-muted-foreground mt-1">Providing a job description helps us generate highly relevant questions.</p>
          </div>


          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Interview Instructions</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                <li>Ensure you are in a quiet environment with a stable internet connection.</li>
                <li>The interview will be recorded for feedback purposes (video & audio for oral part).</li>
                <li>For technical roles, be prepared for an initial oral section followed by written technical/coding questions.</li>
                <li>Speak clearly. Your answers will be transcribed.</li>
                 <li>Proctoring is active: Avoid switching tabs, ensure your face is visible, and stay engaged to prevent interview termination.</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Permissions & Agreements</h3>
            <div className={`flex items-center space-x-3 p-3 border rounded-md ${permissionsGranted ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'}`}>
              <div className="flex-shrink-0">
                {permissionsGranted ? <Video className="h-6 w-6 text-green-600" /> : <Video className="h-6 w-6 text-destructive" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Camera & Microphone Access</p>
                <p className="text-xs text-muted-foreground">Required for video and oral answers.</p>
              </div>
              {!permissionsGranted && (
                <Button variant="outline" size="sm" onClick={requestPermissions} disabled={isStartingSession || isLoadingState}>Grant Access</Button>
              )}
            </div>

            <div className="items-top flex space-x-2 p-3 border rounded-md">
              <Checkbox id="terms" checked={agreedToMonitoring} onCheckedChange={(checked) => setAgreedToMonitoring(!!checked)} disabled={isStartingSession || isLoadingState} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to the interview monitoring terms and conditions.
                </Label>
                <p className="text-sm text-muted-foreground">
                  This includes recording for quality, feedback, and proctoring. Your data is handled as per our privacy policy.
                </p>
              </div>
            </div>
          </div>
           {!isLoadingState && userProfile && interviewLimitReached && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Free Interview Limit Reached</AlertTitle>
              <AlertDescription>
                You have used all {userProfile.interviewsTaken || 0} of your {FREE_INTERVIEW_LIMIT} free interviews. Please <Button variant="link" className="p-0 h-auto text-destructive-foreground underline hover:text-destructive-foreground/80" onClick={() => router.push('/subscription')}>upgrade to Plus</Button> for unlimited interviews.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            size="lg" 
            className="w-full" 
            onClick={handleStartInterview} 
            disabled={isButtonDisabled}
            aria-label={`Start ${duration}-Minute Interview ${isButtonDisabled ? '(Disabled)' : ''}`}
          >
            {(isStartingSession || isLoadingState) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoadingState ? 'Loading Profile...' : (isStartingSession ? 'Starting Session...' : `Start ${duration}-Minute Interview`)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
