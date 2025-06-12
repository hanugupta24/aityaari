"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Info,
  Video,
  AlertTriangle,
  UserX,
  FileText,
  Briefcase,
  Clock,
  Sparkles,
  CheckCircle,
  Play,
  Shield,
  Target,
  Zap,
  Camera,
  Users,
  Brain,
  Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  generateInterviewQuestions,
  type GenerateInterviewQuestionsInput,
} from "@/ai/flows/generate-interview-questions";
import type { InterviewSession, GeneratedQuestion } from "@/types";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const FREE_INTERVIEW_LIMIT = 3;

const styles = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes slideInFromBottom {
    0% { transform: translateY(30px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes slideInFromLeft {
    0% { transform: translateX(-30px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  @keyframes slideInFromRight {
    0% { transform: translateX(30px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes borderGlow {
    0% { box-shadow: 0 0 5px rgba(var(--primary), 0.5); }
    50% { box-shadow: 0 0 20px rgba(var(--primary), 0.8); }
    100% { box-shadow: 0 0 5px rgba(var(--primary), 0.5); }
  }

  @keyframes rotateGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes scaleIn {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes bounceIn {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  .animate-pulse-custom {
    animation: pulse 3s ease-in-out infinite;
  }

  .animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }

  .animate-slide-in {
    animation: slideInFromBottom 0.6s ease-out forwards;
  }

  .animate-slide-in-left {
    animation: slideInFromLeft 0.6s ease-out forwards;
  }

  .animate-slide-in-right {
    animation: slideInFromRight 0.6s ease-out forwards;
  }

  .animate-fade-in {
    animation: fadeIn 0.8s ease-out forwards;
  }

  .animate-border-glow {
    animation: borderGlow 3s infinite;
  }

  .animate-rotate-gradient {
    animation: rotateGradient 3s ease infinite;
  }

  .animate-scale-in {
    animation: scaleIn 0.5s ease-out forwards;
  }

  .animate-bounce-in {
    animation: bounceIn 0.8s ease-out forwards;
  }

  .stagger-1 { animation-delay: 0.1s; }
  .stagger-2 { animation-delay: 0.2s; }
  .stagger-3 { animation-delay: 0.3s; }
  .stagger-4 { animation-delay: 0.4s; }
  .stagger-5 { animation-delay: 0.5s; }
  .stagger-6 { animation-delay: 0.6s; }
  .stagger-7 { animation-delay: 0.7s; }
  .stagger-8 { animation-delay: 0.8s; }

  .glassmorphism {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-hover-effect {
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .card-hover-effect:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }

  .gradient-text {
    background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
  }

  .gradient-border {
    position: relative;
    border: none;
  }

  .gradient-border::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(45deg, hsl(var(--primary)), transparent, hsl(var(--accent)));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  .glow {
    box-shadow: 0 0 15px rgba(var(--primary), 0.5);
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(var(--primary), 0.7);
  }

  .card-3d-effect {
    transition: transform 0.5s ease;
    transform-style: preserve-3d;
    perspective: 1000px;
  }

  .card-3d-effect:hover {
    transform: rotateX(5deg) rotateY(5deg);
  }

  .interview-bg {
    background-image: 
      radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 80% 80%, hsl(var(--accent)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 40% 60%, hsl(var(--primary)/0.08) 0%, transparent 40%),
      linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--background)));
  }

  .duration-card {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .duration-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.5s;
  }

  .duration-card:hover::before {
    left: 100%;
  }

  .duration-card.selected {
    background: linear-gradient(
      135deg,
      rgba(var(--primary), 0.15),
      rgba(var(--accent), 0.15)
    );
    border: 2px solid hsl(var(--primary));
    transform: scale(1.05);
  }

  .permission-card {
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .permission-card.granted {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.1),
      rgba(34, 197, 94, 0.05)
    );
    border-color: rgb(34, 197, 94);
  }

  .permission-card.denied {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.1),
      rgba(239, 68, 68, 0.05)
    );
    border-color: rgb(239, 68, 68);
  }

  .feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(var(--primary), 0.2), rgba(var(--accent), 0.2));
    border: 1px solid rgba(var(--primary), 0.3);
    transition: all 0.3s ease;
  }

  .feature-icon:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(var(--primary), 0.3);
  }

  .start-button {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
    transition: all 0.3s ease;
  }

  .start-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transition: left 0.7s;
  }

  .start-button:hover::before {
    left: 100%;
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(var(--primary), 0.4);
  }

  .start-button:disabled {
    opacity: 0.6;
    transform: none;
    box-shadow: none;
  }

  .start-button:disabled::before {
    display: none;
  }

  .particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(var(--primary), 0.3);
    pointer-events: none;
    animation: float 8s ease-in-out infinite;
  }
`;

export default function StartInterviewPage() {
  const {
    user,
    userProfile,
    loading: authLoading,
    initialLoading: authInitialLoading,
    refreshUserProfile,
  } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [duration, setDuration] = useState<"15" | "30" | "45">("30");
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [agreedToMonitoring, setAgreedToMonitoring] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);

  const handleStartInterview = async () => {
    if (!user || !userProfile) {
      toast({
        title: "Authentication Error",
        description:
          "Please ensure you are logged in and your profile is loaded.",
        variant: "destructive",
      });
      return;
    }
    if (!permissionsGranted) {
      toast({
        title: "Permissions Required",
        description: "Please grant camera and microphone access.",
        variant: "destructive",
      });
      return;
    }
    if (!agreedToMonitoring) {
      toast({
        title: "Agreement Required",
        description: "Please agree to the interview monitoring terms.",
        variant: "destructive",
      });
      return;
    }
    if (!userProfile.role || !userProfile.profileField) {
      toast({
        title: "Profile Incomplete",
        description:
          "Please complete your role and profile field in your profile before starting an interview.",
        variant: "destructive",
      });
      router.push("/profile");
      return;
    }

    setIsStartingSession(true);
    toast({
      title: "Preparing Interview",
      description: "Generating questions, please wait...",
    });

    try {
      const questionGenInput: GenerateInterviewQuestionsInput = {
        profileField: userProfile.profileField,
        role: userProfile.role,
        interviewDuration: duration,
        jobDescription: jobDescriptionInput.trim() || undefined,
        resumeRawText: userProfile.resumeRawText || undefined,
        candidateProfile: {
          name: userProfile.name || user.displayName || undefined,
          profileField: userProfile.profileField,
          role: userProfile.role,
          keySkills: userProfile.keySkills || [],
          workExperience: userProfile.experiences || [],
          projects: userProfile.projects || [],
          educationHistory: userProfile.educationHistory || [],
          accomplishments: userProfile.accomplishments || undefined,
        },
      };

      console.log(
        "DEBUG: questionGenInput for generateInterviewQuestions:",
        JSON.stringify(questionGenInput, null, 2)
      );

      const questionGenOutput = await generateInterviewQuestions(
        questionGenInput
      );

      if (
        !questionGenOutput.questions ||
        questionGenOutput.questions.length === 0
      ) {
        toast({
          title: "Question Generation Failed",
          description:
            "Could not generate interview questions. Please try again or check your profile details.",
          variant: "destructive",
        });
        setIsStartingSession(false);
        return;
      }

      const newInterviewRef = doc(
        collection(db, "users", user.uid, "interviews")
      );
      const interviewId = newInterviewRef.id;

      const initialSessionData: Partial<InterviewSession> = {
        id: interviewId,
        userId: user.uid,
        duration: Number.parseInt(duration) as 15 | 30 | 45,
        status: "questions_generated",
        createdAt: new Date().toISOString(),
        questions: questionGenOutput.questions as GeneratedQuestion[],
      };

      const trimmedJobDescription = jobDescriptionInput.trim();
      if (trimmedJobDescription) {
        initialSessionData.jobDescriptionUsed = trimmedJobDescription;
      }

      await setDoc(newInterviewRef, initialSessionData as InterviewSession);

      toast({
        title: "Interview Ready!",
        description: "Redirecting to your session...",
      });
      router.push(`/interview/${interviewId}`);
    } catch (error: any) {
      console.error("Error starting interview:", error);
      let toastTitle = "Failed to Start Interview";
      let description =
        error.message ||
        "An unexpected error occurred while starting the interview.";

      const errorMessageLower = error.message?.toLowerCase() || "";

      if (
        error.message?.includes("503") ||
        errorMessageLower.includes("overloaded") ||
        errorMessageLower.includes("service unavailable") ||
        errorMessageLower.includes("model is overloaded")
      ) {
        toastTitle = "AI Service Busy";
        description =
          "The AI model is currently overloaded or unavailable. Please try again in a few moments.";
      }

      toast({ title: toastTitle, description, variant: "destructive" });
      setIsStartingSession(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionsGranted(true);
      toast({
        title: "Permissions Granted",
        description: "Camera and microphone access enabled.",
      });
    } catch (err) {
      setPermissionsGranted(false);
      toast({
        title: "Permissions Denied",
        description:
          "Camera and microphone access is required for the interview.",
        variant: "destructive",
      });
      console.error("Error accessing media devices.", err);
    }
  };

  useEffect(() => {
    if (!authInitialLoading && user && !userProfile && !authLoading) {
      refreshUserProfile();
    }
  }, [authInitialLoading, user, userProfile, authLoading, refreshUserProfile]);

  const isProfileEssentialDataMissing =
    userProfile && (!userProfile.role || !userProfile.profileField);
  const isProfileNotLoadedAndAuthChecked =
    !authInitialLoading && user && !userProfile && !authLoading;

  const interviewLimitReached =
    userProfile &&
    !userProfile.isPlusSubscriber &&
    (userProfile.interviewsTaken || 0) >= FREE_INTERVIEW_LIMIT;

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

  const isLoadingState = authInitialLoading || (authLoading && !userProfile);

  const durationOptions = [
    {
      value: "15",
      label: "Quick Session",
      description: "Perfect for practice",
      icon: Zap,
      color: "from-yellow-500/20 to-orange-500/20",
    },
    {
      value: "30",
      label: "Standard Session",
      description: "Comprehensive interview",
      icon: Target,
      color: "from-blue-500/20 to-purple-500/20",
    },
    {
      value: "45",
      label: "Extended Session",
      description: "In-depth evaluation",
      icon: Award,
      color: "from-purple-500/20 to-pink-500/20",
    },
  ];

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Questions",
      description: "Personalized based on your profile",
    },
    {
      icon: Camera,
      title: "Video Recording",
      description: "Practice with real interview conditions",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is protected and encrypted",
    },
    {
      icon: Users,
      title: "Expert Feedback",
      description: "Detailed analysis and improvement tips",
    },
  ];

  return (
    <div className="min-h-screen interview-bg relative overflow-hidden">
      <style>{styles}</style>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/4 right-1/4 w-1/4 h-1/4 bg-primary/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6 animate-slide-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-2xl animate-pulse-custom"></div>
            <div className="relative bg-gradient-to-br from-primary/20 to-accent/20 p-4 rounded-full border border-primary/30 shadow-lg backdrop-blur-sm">
              <Play className="h-12 w-12 text-primary animate-float" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold gradient-text glow-text">
              Start Your Interview
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience AI-powered interview practice with personalized
              questions and expert feedback
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-in stagger-1">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border-0 shadow-lg card-hover-effect glassmorphism gradient-border"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-70"></div>
              <CardContent className="relative z-10 p-6 text-center space-y-4">
                <div
                  className="feature-icon mx-auto animate-float"
                  style={{ animationDelay: `${index * 0.5}s` }}
                >
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Interview Setup Card */}
        <Card className="relative overflow-hidden border-0 shadow-2xl card-3d-effect glassmorphism gradient-border animate-slide-in stagger-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-70 animate-rotate-gradient"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse-custom"></div>

          <CardHeader className="relative z-10 text-center space-y-4 p-8">
            <CardTitle className="text-3xl font-bold gradient-text">
              Configure Your Session
            </CardTitle>
            <CardDescription className="text-lg">
              Customize your interview experience for optimal preparation
            </CardDescription>
          </CardHeader>

          <CardContent className="relative z-10 space-y-8 p-8">
            {/* Loading State */}
            {isLoadingState && (
              <div className="flex items-center justify-center p-8 animate-bounce-in">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-custom"></div>
                  <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
                </div>
                <div className="ml-4 space-y-2">
                  <p className="text-lg font-medium">
                    Loading your information...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Preparing your personalized experience
                  </p>
                </div>
              </div>
            )}

            {/* Error States */}
            {!isLoadingState &&
              isProfileNotLoadedAndAuthChecked &&
              !userProfile && (
                <Alert
                  variant="destructive"
                  className="animate-slide-in border-red-300/50 bg-red-50/30 backdrop-blur-sm"
                >
                  <UserX className="h-5 w-5" />
                  <AlertTitle className="text-lg font-bold">
                    Profile Not Loaded
                  </AlertTitle>
                  <AlertDescription className="text-base">
                    We couldn't load your profile data. Please ensure you have
                    created or completed your profile.
                    <Link
                      href="/profile"
                      className="font-semibold underline hover:text-red-700 ml-1 inline-flex items-center gap-1"
                    >
                      Go to Profile <Target className="h-3 w-3" />
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

            {!isLoadingState &&
              userProfile &&
              isProfileEssentialDataMissing && (
                <Alert className="animate-slide-in border-yellow-500/50 bg-yellow-50/30 backdrop-blur-sm">
                  <Info className="h-5 w-5 text-yellow-500" />
                  <AlertTitle className="text-lg font-bold text-yellow-700">
                    Profile Incomplete
                  </AlertTitle>
                  <AlertDescription className="text-base text-yellow-600">
                    Your profile is missing key information like your 'Role' or
                    'Profile Field'. This is needed for tailored questions.
                    Please{" "}
                    <Link
                      href="/profile"
                      className="font-semibold underline hover:text-yellow-800 inline-flex items-center gap-1"
                    >
                      complete your profile <Target className="h-3 w-3" />
                    </Link>
                    .
                  </AlertDescription>
                </Alert>
              )}

            {!isLoadingState &&
              !userProfile &&
              !isProfileNotLoadedAndAuthChecked &&
              !authLoading && (
                <Alert
                  variant="destructive"
                  className="animate-slide-in border-red-300/50 bg-red-50/30 backdrop-blur-sm"
                >
                  <UserX className="h-5 w-5" />
                  <AlertTitle className="text-lg font-bold">
                    User Profile Not Found
                  </AlertTitle>
                  <AlertDescription className="text-base">
                    It seems you haven't created a profile yet, or we couldn't
                    load it. Please
                    <Link
                      href="/profile"
                      className="font-semibold underline hover:text-red-700 ml-1 inline-flex items-center gap-1"
                    >
                      go to your profile <Target className="h-3 w-3" />
                    </Link>
                    to create or complete it. Key details like your 'Role' and
                    'Profile Field' are needed for tailored interview questions.
                  </AlertDescription>
                </Alert>
              )}

            {/* Personalization Info */}
            <Alert className="animate-slide-in stagger-3 border-blue-300/50 bg-blue-50/30 backdrop-blur-sm">
              <FileText className="h-5 w-5 text-green-500" />
              <AlertTitle className="text-lg font-bold text-white-700">
                Personalized Questions
              </AlertTitle>
              <AlertDescription className="text-base text-green-600">
                Questions will be based on your profile (role, field, skills,
                experiences, projects), your uploaded resume raw text (if any),
                and the job description you can provide below.
              </AlertDescription>
            </Alert>

            {/* Duration Selection */}
            <div className="space-y-6 animate-slide-in stagger-4">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold gradient-text flex items-center justify-center gap-2">
                  <Clock className="h-6 w-6 text-primary" />
                  Select Interview Duration
                </h3>
                <p className="text-muted-foreground">
                  Choose the length that fits your preparation goals
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {durationOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={`duration-card p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                      duration === option.value
                        ? "selected"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setDuration(option.value as "15" | "30" | "45")
                    }
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="text-center space-y-4">
                      <div
                        className={`feature-icon mx-auto bg-gradient-to-br ${option.color}`}
                      >
                        <option.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{option.label}</h4>
                        <p className="text-2xl font-bold gradient-text">
                          {option.value} minutes
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                      <RadioGroup value={duration} className="hidden">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={option.value}
                            id={`duration-${option.value}`}
                            disabled={isStartingSession || isLoadingState}
                          />
                          <Label htmlFor={`duration-${option.value}`}>
                            {option.value} minutes
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Description Input */}
            <div className="space-y-4 animate-slide-in stagger-5">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold gradient-text flex items-center justify-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary" />
                  Targeted Job Description
                </h3>
                <p className="text-muted-foreground">
                  Optional: Paste a job description for more relevant questions
                </p>
              </div>

              <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-br from-background/50 to-primary/5 backdrop-blur-sm">
                <CardContent className="p-6">
                  <Textarea
                    id="jobDescriptionInput"
                    placeholder="Paste the job description here to get more aligned questions..."
                    value={jobDescriptionInput}
                    onChange={(e) => setJobDescriptionInput(e.target.value)}
                    rows={6}
                    className="text-sm bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40 transition-colors resize-none"
                    disabled={isStartingSession || isLoadingState}
                  />
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Providing a job description helps generate highly relevant
                    questions.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Interview Instructions */}
            <Alert className="animate-slide-in stagger-6 border-purple-300/50 bg-purple-50/30 backdrop-blur-sm">
              <Info className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-lg font-bold text-green-600">
                Interview Instructions
              </AlertTitle>
              <AlertDescription className="text-base text-green-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Ensure quiet environment with stable internet
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Interview will be recorded for feedback purposes
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Technical roles include oral + written sections
                    </li>
                  </ul>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Speak clearly for accurate transcription
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Keep face visible and stay engaged
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Avoid switching tabs during session
                    </li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Permissions & Agreements */}
            <div className="space-y-6 animate-slide-in stagger-7">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold gradient-text flex items-center justify-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  Permissions & Agreements
                </h3>
                <p className="text-muted-foreground">
                  Required for a secure and effective interview experience
                </p>
              </div>

              <div className="space-y-4">
                {/* Camera & Microphone Permissions */}
                <Card
                  className={`permission-card border-2 transition-all duration-300 ${
                    permissionsGranted ? "granted" : "denied"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`feature-icon ${
                            permissionsGranted
                              ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30"
                              : "bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-500/30"
                          }`}
                        >
                          {permissionsGranted ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : (
                            <Video className="h-6 w-6 text-red-500" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">
                            Camera & Microphone Access
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Required for video recording and oral answers
                          </p>
                        </div>
                      </div>
                      {!permissionsGranted && (
                        <Button
                          variant="outline"
                          onClick={requestPermissions}
                          disabled={isStartingSession || isLoadingState}
                          className="hover:scale-105 transition-transform"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Grant Access
                        </Button>
                      )}
                      {permissionsGranted && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Granted</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Monitoring Agreement */}
                <Card className="border-2 border-border hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <Checkbox
                        id="terms"
                        checked={agreedToMonitoring}
                        onCheckedChange={(checked) =>
                          setAgreedToMonitoring(!!checked)
                        }
                        disabled={isStartingSession || isLoadingState}
                        className="mt-1"
                      />
                      <div className="space-y-2">
                        <Label
                          htmlFor="terms"
                          className="text-lg font-semibold cursor-pointer"
                        >
                          I agree to the interview monitoring terms and
                          conditions
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          This includes recording for quality assurance,
                          feedback generation, and proctoring. Your data is
                          handled securely according to our privacy policy.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Interview Limit Warning */}
            {!isLoadingState && userProfile && interviewLimitReached && (
              <Alert
                variant="destructive"
                className="animate-slide-in stagger-8 border-red-300/50 bg-red-50/30 backdrop-blur-sm"
              >
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-lg font-bold">
                  Free Interview Limit Reached
                </AlertTitle>
                <AlertDescription className="text-base">
                  You have used all {userProfile.interviewsTaken || 0} of your{" "}
                  {FREE_INTERVIEW_LIMIT} free interviews. Please{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-red-600 underline hover:text-red-700 font-semibold"
                    onClick={() => router.push("/subscription")}
                  >
                    upgrade to Plus
                  </Button>{" "}
                  for unlimited interviews.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="relative z-10 p-8">
            <Button
              size="lg"
              className={`w-full h-14 text-lg font-semibold start-button ${
                isButtonDisabled ? "opacity-60" : ""
              } transition-all duration-300`}
              onClick={handleStartInterview}
              disabled={isButtonDisabled}
              aria-label={`Start ${duration}-Minute Interview ${
                isButtonDisabled ? "(Disabled)" : ""
              }`}
            >
              {(isStartingSession || isLoadingState) && (
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              )}
              {isLoadingState ? (
                <>
                  <Brain className="mr-3 h-5 w-5" />
                  Loading Profile...
                </>
              ) : isStartingSession ? (
                <>
                  <Sparkles className="mr-3 h-5 w-5" />
                  Starting Session...
                </>
              ) : (
                <>
                  <Play className="mr-3 h-5 w-5" />
                  Start {duration}-Minute Interview
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
