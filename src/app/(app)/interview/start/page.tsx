
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Info, Video, Mic, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewQuestions, type GenerateInterviewQuestionsInput } from "@/ai/flows/generate-interview-questions";
import type { UserProfile, InterviewSession } from "@/types";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";


export default function StartInterviewPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [duration, setDuration] = useState<"15" | "30" | "45">("30");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [agreedToMonitoring, setAgreedToMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInterview = async () => {
    if (!user || !userProfile) {
      toast({ title: "Authentication Error", description: "Please log in to start an interview.", variant: "destructive" });
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

    setIsLoading(true);

    try {
      // Placeholder for generating interview ID and saving initial session state
      const newInterviewRef = doc(collection(db, "users", user.uid, "interviews"));
      const interviewId = newInterviewRef.id;

      const initialSessionData: Partial<InterviewSession> = {
        userId: user.uid,
        duration: parseInt(duration) as 15 | 30 | 45,
        status: "pending",
        createdAt: new Date().toISOString(), // Using client time for now, serverTimestamp for Firestore recommended
      };
      await setDoc(newInterviewRef, initialSessionData);
      
      // Note: generateInterviewQuestions is an AI flow.
      // For a real app, you might call this and then pass questions to the interview page.
      // Or the interview page itself could fetch/generate them.
      // For now, we just navigate to the interview page with the ID.
      // The actual question generation and conversational flow will happen on that page.
      
      // Example of calling the AI flow if needed here:
      /*
      const questionInput: GenerateInterviewQuestionsInput = {
        profile: `${userProfile.profileField}, ${userProfile.role}, ${userProfile.education}`,
        role: userProfile.role || "general",
        interviewDuration: duration,
      };
      const generated = await generateInterviewQuestions(questionInput);
      await updateDoc(newInterviewRef, { questions: generated.questions, status: "started" });
      */

      toast({ title: "Interview Starting", description: "Preparing your session..." });
      router.push(`/interview/${interviewId}`);

    } catch (error: any) {
      console.error("Error starting interview:", error);
      toast({ title: "Failed to Start Interview", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
    // setIsLoading(false) will be handled by navigation or error
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop tracks immediately as we only need to check permission
      stream.getTracks().forEach(track => track.stop());
      setPermissionsGranted(true);
      toast({ title: "Permissions Granted", description: "Camera and microphone access enabled." });
    } catch (err) {
      setPermissionsGranted(false);
      toast({ title: "Permissions Denied", description: "Camera and microphone access is required for the interview.", variant: "destructive" });
      console.error("Error accessing media devices.", err);
    }
  };


  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Start Your Interview</CardTitle>
          <CardDescription>Choose your preferred interview duration and prepare for a focused session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-lg font-semibold mb-2 block">Select Interview Duration</Label>
            <RadioGroup defaultValue="30" onValueChange={(value: "15" | "30" | "45") => setDuration(value)} className="flex space-x-4">
              {["15", "30", "45"].map((d) => (
                <div key={d} className="flex items-center space-x-2">
                  <RadioGroupItem value={d} id={`duration-${d}`} />
                  <Label htmlFor={`duration-${d}`} className="cursor-pointer">{d} minutes</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Interview Instructions</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Ensure you are in a quiet environment with a stable internet connection.</li>
                <li>The interview will be recorded for feedback purposes.</li>
                <li>Be prepared to answer behavioral, technical, and potentially coding questions.</li>
                <li>Some questions will be conversational; speak clearly into your microphone.</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Permissions & Agreements</h3>
            <div className="flex items-center space-x-3 p-3 border rounded-md">
              <div className="flex-shrink-0">
                {permissionsGranted ? <Video className="h-6 w-6 text-green-500" /> : <Video className="h-6 w-6 text-destructive" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Camera & Microphone Access</p>
                <p className="text-xs text-muted-foreground">Required for video and conversational questions.</p>
              </div>
              {!permissionsGranted && (
                <Button variant="outline" size="sm" onClick={requestPermissions}>Grant Access</Button>
              )}
            </div>

            <div className="items-top flex space-x-2">
              <Checkbox id="terms" checked={agreedToMonitoring} onCheckedChange={(checked) => setAgreedToMonitoring(!!checked)} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to the interview monitoring terms and conditions.
                </Label>
                <p className="text-sm text-muted-foreground">
                  This includes recording for quality and feedback.
                </p>
              </div>
            </div>
          </div>
           {userProfile && (userProfile.interviewsTaken || 0) >= 3 && !userProfile.isPlusSubscriber && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Free Interview Limit Reached</AlertTitle>
              <AlertDescription>
                You have used all your free interviews. Please <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/subscription')}>upgrade to Plus</Button> for unlimited interviews.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            size="lg" 
            className="w-full" 
            onClick={handleStartInterview} 
            disabled={isLoading || !permissionsGranted || !agreedToMonitoring || (userProfile && (userProfile.interviewsTaken || 0) >=3 && !userProfile.isPlusSubscriber)}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start {duration}-Minute Interview
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
