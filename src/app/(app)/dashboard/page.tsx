"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  PlusCircle,
  Loader2,
  AlertTriangle,
  ListChecks,
  User,
  DatabaseZap,
  ExternalLink,
  TrendingUp,
  Sparkles,
  CheckCircle,
  Search,
  Filter,
  Calendar,
  Clock,
  BarChart3,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterviewSession } from "@/types";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

// Define keyframe animations
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

  .animate-fade-in {
    animation: fadeIn 0.8s ease-out forwards;
  }

  .animate-border-glow {
    animation: borderGlow 3s infinite;
  }

  .animate-rotate-gradient {
    animation: rotateGradient 3s ease infinite;
  }

  .stagger-1 { animation-delay: 0.1s; }
  .stagger-2 { animation-delay: 0.2s; }
  .stagger-3 { animation-delay: 0.3s; }

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
    transform: translateY(-8px) scale(1.005);
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

  .progress-bar-animated {
    position: relative;
    overflow: hidden;
  }

  .progress-bar-animated::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transform: translateX(-100%);
    animation: shimmer 2s infinite;
  }

  .dashboard-bg {
    background-image: 
      radial-gradient(circle at 10% 10%, hsl(var(--primary)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 90% 90%, hsl(var(--accent)/0.15) 0%, transparent 30%),
      linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--background)));
  }

  .particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(var(--primary), 0.3);
    pointer-events: none;
  }
`;

const FREE_INTERVIEW_LIMIT = 3;

function InterviewsErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;

  const isIndexError =
    error.includes("query requires an index") ||
    error.includes("needs an index");
  const indexCreationLinkMatch = error.match(
    /https:\/\/console\.firebase\.google\.com\/[^)]+/
  );
  const indexCreationLink = indexCreationLinkMatch
    ? indexCreationLinkMatch[0]
    : null;

  return (
    <Alert
      variant="destructive"
      className="my-6 animate-slide-in border-red-300/50 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/20 backdrop-blur-sm shadow-xl"
    >
      <div className="absolute inset-0 bg-red-500/5 rounded-lg animate-pulse-custom"></div>
      <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse-custom" />
      <AlertTitle className="text-lg font-bold text-red-600 dark:text-red-400">
        Error Loading Past Interviews
      </AlertTitle>
      <AlertDescription className="mt-2 text-sm leading-relaxed">
        Could not fetch your past interview data. {error}
        {isIndexError && indexCreationLink && (
          <div className="mt-3 p-4 bg-red-100/50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800/50">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>
                This typically means a required database index is missing.
                Please
              </span>
            </p>
            <a
              href={indexCreationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 font-semibold underline hover:text-red-700 dark:hover:text-red-300 inline-flex items-center gap-1 transition-colors"
            >
              Click here to create the index{" "}
              <ExternalLink className="inline-block h-3 w-3" />
            </a>
            <p className="mt-2 text-xs opacity-80">
              It might take a few minutes for the index to build.
            </p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default function DashboardPage() {
  const {
    user,
    userProfile,
    initialLoading: authInitialLoading,
    loading: authLoading,
  } = useAuth();
  const { toast } = useToast();

  const [fetchedPastInterviews, setFetchedPastInterviews] = useState<
    InterviewSession[]
  >([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);
  const [animateParticles, setAnimateParticles] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Create animated particles
  useEffect(() => {
    if (!dashboardRef.current) return;

    const createParticle = () => {
      if (!dashboardRef.current) return;

      const particle = document.createElement("div");
      particle.classList.add("particle");

      // Random size between 3px and 8px
      const size = Math.random() * 5 + 3;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;

      // Random position within the dashboard
      const containerRect = dashboardRef.current.getBoundingClientRect();
      const x = Math.random() * containerRect.width;
      const y = Math.random() * containerRect.height;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      // Random opacity
      particle.style.opacity = (Math.random() * 0.5 + 0.2).toString();

      // Animation
      const duration = Math.random() * 10 + 10; // 10-20s
      particle.style.animation = `float ${duration}s ease-in-out infinite`;

      dashboardRef.current.appendChild(particle);

      // Remove after some time
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, duration * 1000);
    };

    // Create initial particles
    for (let i = 0; i < 15; i++) {
      createParticle();
    }

    // Create new particles periodically
    const interval = setInterval(createParticle, 2000);

    return () => clearInterval(interval);
  }, [animateParticles]);

  // Start particle animation after initial load
  useEffect(() => {
    if (!authInitialLoading && user) {
      setTimeout(() => setAnimateParticles(true), 500);
    }
  }, [authInitialLoading, user]);

  const fetchInterviews = useCallback(async () => {
    if (!user) {
      console.log(
        "DashboardPage: No user, clearing past interviews and stopping loader."
      );
      setFetchedPastInterviews([]);
      setInterviewsLoading(false);
      setInterviewsError(null);
      return;
    }

    console.log(
      "DashboardPage: User available, attempting to fetch past interviews."
    );
    setInterviewsLoading(true);
    setInterviewsError(null);

    try {
      const interviewsRef = collection(db, "users", user.uid, "interviews");
      const q = query(
        interviewsRef,
        where("status", "==", "completed"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const interviewsData: InterviewSession[] = [];
      querySnapshot.forEach((doc) => {
        interviewsData.push({ id: doc.id, ...doc.data() } as InterviewSession);
      });
      setFetchedPastInterviews(interviewsData);
      console.log(
        "DashboardPage: Successfully fetched interviews:",
        interviewsData.length
      );
    } catch (error: any) {
      console.error("DashboardPage: Error fetching past interviews:", error);
      const errorMessage =
        error.message || "An unknown error occurred while fetching interviews.";
      setInterviewsError(errorMessage);
      toast({
        title: "Error Loading Interviews",
        description: errorMessage,
        variant: "destructive",
      });
      setFetchedPastInterviews([]);
    } finally {
      console.log(
        "DashboardPage: Finished fetching interviews, setting interviewsLoading to false."
      );
      setInterviewsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authInitialLoading && user) {
      fetchInterviews();
    } else if (!authInitialLoading && !user) {
      setInterviewsLoading(false);
      setFetchedPastInterviews([]);
      setInterviewsError(null);
    }
  }, [user, authInitialLoading, fetchInterviews]);

  // Filter and sort interviews
  const filteredAndSortedInterviews = useMemo(() => {
    let filtered = fetchedPastInterviews;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (interview) =>
          interview.feedback?.overallFeedback
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          new Date(interview.createdAt)
            .toLocaleDateString()
            .includes(searchTerm)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (interview) => interview.status === statusFilter
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "score":
          const scoreA = a.feedback?.overallScore || 0;
          const scoreB = b.feedback?.overallScore || 0;
          comparison = scoreA - scoreB;
          break;
        case "duration":
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [fetchedPastInterviews, searchTerm, statusFilter, sortBy, sortOrder]);

  if (authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
        <style>{styles}</style>
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-3xl bg-primary/30 animate-pulse-custom"></div>
          <div
            className="absolute inset-0 rounded-full blur-xl bg-accent/20 animate-pulse-custom"
            style={{ animationDelay: "1s" }}
          ></div>
          <Loader2 className="relative h-20 w-20 animate-spin text-primary drop-shadow-lg" />
        </div>
        <div className="mt-10 text-center space-y-3 max-w-md">
          <h3 className="text-2xl font-bold gradient-text animate-pulse-custom">
            Loading your dashboard
          </h3>
          <p className="text-muted-foreground">
            Preparing your interview insights...
          </p>
        </div>
        <div className="mt-8 flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce"></div>
          <div
            className="w-3 h-3 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <div
            className="w-3 h-3 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: "0.4s" }}
          ></div>
        </div>
      </div>
    );
  }

  if (!user && !authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-destructive/10 p-4 sm:p-6">
        <style>{styles}</style>
        <div className="max-w-md w-full animate-slide-in">
          <Alert
            variant="destructive"
            className="border-red-300/50 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/20 backdrop-blur-sm shadow-2xl"
          >
            <div className="absolute inset-0 bg-red-500/5 rounded-lg animate-pulse-custom"></div>
            <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse-custom" />
            <AlertTitle className="text-xl font-bold text-red-600 dark:text-red-400 mt-2">
              Authentication Required
            </AlertTitle>
            <AlertDescription className="mt-4 text-base">
              <p className="mb-4">
                You need to be logged in to view the dashboard.
              </p>
              <Link href="/login" passHref>
                <Button className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 animate-shimmer overflow-hidden">
                  <span className="relative z-10">Login to Continue</span>
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (
    user &&
    (authLoading || (!userProfile && !authInitialLoading && !authLoading))
  ) {
    const message = authLoading
      ? "Loading user profile..."
      : "Could not load your user profile. Please try refreshing or check your profile settings.";
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4 sm:p-6">
        <style>{styles}</style>
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full blur-3xl bg-primary/30 animate-pulse-custom"></div>
          <div
            className="absolute inset-0 rounded-full blur-xl bg-accent/20 animate-pulse-custom"
            style={{ animationDelay: "1s" }}
          ></div>
          <Loader2 className="relative h-20 w-20 animate-spin text-primary drop-shadow-lg" />
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h3 className="text-2xl font-bold gradient-text animate-pulse-custom">
            {message}
          </h3>
          {!authLoading && !userProfile && (
            <Link href="/profile" className="mt-6 block">
              <Button
                variant="outline"
                className="w-full hover:scale-105 transition-transform shadow-lg hover:shadow-xl border-primary/30 animate-border-glow"
              >
                <User className="mr-2 h-5 w-5" />
                Go to Profile
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const interviewsTaken = userProfile?.interviewsTaken || 0;
  const remainingFreeInterviews = FREE_INTERVIEW_LIMIT - interviewsTaken;

  return (
    <div
      ref={dashboardRef}
      className="min-h-screen dashboard-bg relative overflow-hidden"
    >
      <style>{styles}</style>

      {/* Custom animated background */}
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

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Welcome Hero Section */}
        <div className="animate-slide-in mb-8">
          <Card className="relative overflow-hidden border-0 shadow-2xl glassmorphism gradient-border">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-accent/20 opacity-70 animate-rotate-gradient"></div>
            <div className="absolute top-0 right-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-custom"></div>
            <div
              className="absolute bottom-0 left-0 w-24 sm:w-36 lg:w-48 h-24 sm:h-36 lg:h-48 bg-accent/20 rounded-full blur-2xl animate-pulse-custom"
              style={{ animationDelay: "2s" }}
            ></div>

            <CardHeader className="relative z-10 pb-4 p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                  <div className="relative animate-float self-start sm:self-center">
                    <div className="absolute inset-0 bg-primary/30 rounded-full blur-lg animate-pulse-custom"></div>
                    <div className="relative bg-gradient-to-br from-primary/30 to-accent/30 p-3 sm:p-4 rounded-full border border-primary/30 shadow-lg glow">
                      <User className="h-6 w-6 sm:h-8 lg:h-10 sm:w-8 lg:w-10 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold gradient-text glow-text mb-2">
                      Welcome to aiTyaari
                    </CardTitle>
                    <CardDescription className="text-base sm:text-lg lg:text-xl mt-2 text-foreground/80">
                      {userProfile
                        ? `Hello, ${userProfile.name || user.email || "User"}!`
                        : "Loading your details..."}
                      <span className="block mt-1 text-sm sm:text-base text-muted-foreground">
                        Master your interview skills with AI-powered practice
                        sessions.
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 pt-0 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                <div className="space-y-2 flex-1">
                  <p className="text-lg sm:text-xl text-foreground/90 font-medium">
                    Ready to ace your next interview?
                  </p>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Start a new practice session and get personalized feedback.
                  </p>
                </div>
                <Link
                  href="/interview/start"
                  passHref
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    className="w-full sm:w-auto group relative overflow-hidden bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 animate-border-glow"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                    <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-90 transition-transform duration-500" />
                    <span className="relative z-10 text-sm sm:text-base">
                      Start New Interview
                    </span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="xl:col-span-2 space-y-8">
            {/* Free User Credits Section */}
            {userProfile && !userProfile.isPlusSubscriber && interviewsTaken <= FREE_INTERVIEW_LIMIT && (
              <div className="animate-slide-in stagger-1">
                <Card className="relative overflow-hidden border-0 shadow-xl glassmorphism gradient-border">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 opacity-70 animate-rotate-gradient"></div>
                  <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-primary/20 rounded-full blur-2xl animate-pulse-custom"></div>

                  <CardHeader className="relative z-10 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="relative animate-float">
                          <div className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-pulse-custom"></div>
                          <div className="relative bg-gradient-to-br from-primary/30 to-accent/30 p-2 sm:p-3 rounded-full border border-primary/30 shadow-lg">
                            <TrendingUp className="h-5 w-5 sm:h-6 lg:h-7 sm:w-6 lg:w-7 text-primary-foreground" />
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold gradient-text">
                            Interview Credits
                          </CardTitle>
                          <CardDescription className="text-sm sm:text-base">
                            Track your free interview usage
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right sm:text-center">
                        <div className="text-2xl sm:text-3xl font-bold gradient-text glow-text animate-pulse-custom">
                          {remainingFreeInterviews}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          remaining
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">
                        {interviewsTaken} / {FREE_INTERVIEW_LIMIT}
                      </span>
                    </div>

                    <div className="relative h-3 sm:h-4 rounded-full overflow-hidden progress-bar-animated">
                      <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm"></div>
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${
                            (interviewsTaken / FREE_INTERVIEW_LIMIT) * 100
                          }%`,
                        }}
                      ></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 pt-2">
                      {remainingFreeInterviews > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-green-500 dark:text-green-400">
                            {remainingFreeInterviews}
                          </span>{" "}
                          free{" "}
                          {remainingFreeInterviews === 1
                            ? "interview"
                            : "interviews"}{" "}
                          left
                        </p>
                      ) : (
                        <p className="text-sm text-amber-500 dark:text-amber-400 font-medium flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          All free interviews used
                        </p>
                      )}

                      {remainingFreeInterviews <= 1 && (
                        <Link href="/subscription" className="w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto relative overflow-hidden group border-primary/30 hover:border-primary/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                            <Sparkles className="mr-1 h-3 w-3 sm:h-4 sm:w-4 group-hover:text-primary transition-colors duration-300" />
                            <span className="relative z-10 text-xs sm:text-sm">
                              Upgrade
                            </span>
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Plus Subscription Status */}
            {userProfile?.isPlusSubscriber && (
              <div className="animate-slide-in stagger-1">
                <Card className="relative overflow-hidden border-0 shadow-xl glassmorphism gradient-border">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 opacity-70 animate-rotate-gradient"></div>
                  <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-green-500/20 rounded-full blur-3xl animate-pulse-custom"></div>

                  <CardHeader className="relative z-10 p-4 sm:p-6">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="relative animate-float">
                        <div className="absolute inset-0 bg-green-500/30 rounded-full blur-md animate-pulse-custom"></div>
                        <div className="relative bg-gradient-to-br from-green-500/30 to-emerald-500/30 p-2 sm:p-3 rounded-full border border-green-500/30 shadow-lg">
                          <CheckCircle className="h-6 w-6 sm:h-7 lg:h-8 sm:w-7 lg:w-8 text-green-500" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
                          <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                            aiTyaari Plus Member
                          </span>
                          <div
                            className="relative animate-float"
                            style={{ animationDelay: "1s" }}
                          >
                            <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-sm animate-pulse-custom"></div>
                            <div className="relative text-yellow-500 text-lg sm:text-xl lg:text-2xl">
                              ✦
                            </div>
                          </div>
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                          Unlimited access • Current Plan:{" "}
                          {userProfile.subscriptionPlan
                            ? userProfile.subscriptionPlan
                                .charAt(0)
                                .toUpperCase() +
                              userProfile.subscriptionPlan.slice(1)
                            : "Plus"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 p-4 sm:p-6 pt-0">
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                      Thank you for being a Plus subscriber. Enjoy unlimited
                      interview sessions and access to all premium features.
                    </p>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      <div className="flex items-center text-xs sm:text-sm bg-gradient-to-r from-green-500/20 to-green-500/10 backdrop-blur-sm text-green-600 dark:text-green-400 px-2 sm:px-3 py-1 sm:py-2 rounded-full border border-green-500/30 animate-pulse-custom">
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Unlimited Interviews
                      </div>
                      <div
                        className="flex items-center text-xs sm:text-sm bg-gradient-to-r from-blue-500/20 to-blue-500/10 backdrop-blur-sm text-blue-600 dark:text-blue-400 px-2 sm:px-3 py-1 sm:py-2 rounded-full border border-blue-500/30 animate-pulse-custom"
                        style={{ animationDelay: "0.5s" }}
                      >
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Advanced Analytics
                      </div>
                      <div
                        className="flex items-center text-xs sm:text-sm bg-gradient-to-r from-purple-500/20 to-purple-500/10 backdrop-blur-sm text-purple-600 dark:text-purple-400 px-2 sm:px-3 py-1 sm:py-2 rounded-full border border-purple-500/30 animate-pulse-custom"
                        style={{ animationDelay: "1s" }}
                      >
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Priority Support
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="relative z-10 pt-4 p-4 sm:p-6">
                    <Link href="/subscription" className="w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto relative overflow-hidden group border-green-500/30 hover:border-green-500/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                        <span className="relative z-10 text-sm">
                          Manage Subscription
                        </span>
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Past Interviews Section with Filters */}
            <div className="animate-slide-in stagger-2">
              <Card className="relative overflow-hidden border-0 shadow-xl glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/10 opacity-70 animate-rotate-gradient"></div>
                <div className="absolute top-0 right-0 w-24 sm:w-40 h-24 sm:h-40 bg-accent/20 rounded-full blur-2xl animate-pulse-custom"></div>

                <CardHeader className="relative z-10 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="relative animate-float">
                        <div className="absolute inset-0 bg-accent/30 rounded-full blur-md animate-pulse-custom"></div>
                        <div className="relative bg-gradient-to-br from-accent/30 to-primary/30 p-2 sm:p-3 rounded-full border border-accent/30 shadow-lg">
                          <ListChecks className="h-5 w-5 sm:h-6 lg:h-7 sm:w-6 lg:w-7 text-accent-foreground" />
                        </div>
                      </div>
                      <div>
                        <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold gradient-text">
                          Past Interviews
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                          Review your performance and track progress
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      {filteredAndSortedInterviews.length} interviews
                    </Badge>
                  </div>

                  {/* Filters Section */}
                  {fetchedPastInterviews.length > 0 && (
                    <div className="mt-4 sm:mt-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search interviews..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40 transition-colors"
                          />
                        </div>

                        {/* Status Filter */}
                        <Select
                          value={statusFilter}
                          onValueChange={setStatusFilter}
                        >
                          <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="in-progress">
                              In Progress
                            </SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Sort By */}
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="score">Score</SelectItem>
                            <SelectItem value="duration">Duration</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Sort Order */}
                        <Button
                          variant="outline"
                          onClick={() =>
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                          }
                          className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors"
                        >
                          {sortOrder === "asc" ? (
                            <SortAsc className="h-4 w-4 mr-2" />
                          ) : (
                            <SortDesc className="h-4 w-4 mr-2" />
                          )}
                          <span className="hidden sm:inline">
                            {sortOrder === "asc" ? "Ascending" : "Descending"}
                          </span>
                          <span className="sm:hidden">
                            {sortOrder === "asc" ? "Asc" : "Desc"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="relative z-10 p-4 sm:p-6 pt-0">
                  {interviewsLoading && (
                    <div className="flex flex-col justify-center items-center py-12 sm:py-16">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-custom"></div>
                        <Loader2 className="relative h-8 w-8 sm:h-10 lg:h-12 sm:w-10 lg:w-12 animate-spin text-primary" />
                      </div>
                      <p className="text-base sm:text-lg text-muted-foreground animate-pulse-custom">
                        Loading your interview history...
                      </p>
                    </div>
                  )}

                  {!interviewsLoading && interviewsError && (
                    <InterviewsErrorAlert error={interviewsError} />
                  )}

                  {!interviewsLoading &&
                    !interviewsError &&
                    fetchedPastInterviews.length === 0 && (
                      <div className="text-center py-12 sm:py-16 space-y-4 sm:space-y-6">
                        <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
                          <div className="absolute inset-0 bg-muted/20 rounded-full blur-xl animate-pulse-custom"></div>
                          <DatabaseZap className="relative mx-auto h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground/60 animate-float" />
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <p className="text-lg sm:text-xl font-medium text-muted-foreground">
                            No interviews yet
                          </p>
                          <p className="text-sm sm:text-base text-muted-foreground">
                            Start your first interview to see your progress here
                          </p>
                        </div>
                        <Link href="/interview/start" className="inline-block">
                          <Button className="relative overflow-hidden group bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                            <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-90 transition-transform duration-500" />
                            <span className="relative z-10 text-sm sm:text-base">
                              Start Your First Interview
                            </span>
                          </Button>
                        </Link>
                      </div>
                    )}

                  {!interviewsLoading &&
                    !interviewsError &&
                    filteredAndSortedInterviews.length === 0 &&
                    fetchedPastInterviews.length > 0 && (
                      <div className="text-center py-12 sm:py-16 space-y-4">
                        <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
                          <div className="absolute inset-0 bg-muted/20 rounded-full blur-xl animate-pulse-custom"></div>
                          <Search className="relative mx-auto h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground/60 animate-float" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg sm:text-xl font-medium text-muted-foreground">
                            No interviews match your filters
                          </p>
                          <p className="text-sm sm:text-base text-muted-foreground">
                            Try adjusting your search criteria or filters
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("all");
                            setSortBy("date");
                            setSortOrder("desc");
                          }}
                          className="hover:scale-105 transition-transform"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}

                  {!interviewsLoading &&
                    !interviewsError &&
                    filteredAndSortedInterviews.length > 0 && (
                      <div className="space-y-4 sm:space-y-6">
                        {filteredAndSortedInterviews.map((session, index) => (
                          <Card
                            key={session.id}
                            className="group relative overflow-hidden border border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background/50 to-primary/5 backdrop-blur-sm hover:shadow-lg transition-all duration-500 hover:scale-[1.02] animate-slide-in"
                            style={{ animationDelay: `${index * 150}ms` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <CardHeader className="relative z-10 pb-3 p-4 sm:p-6">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div
                                    className="relative animate-float"
                                    style={{
                                      animationDelay: `${index * 0.5}s`,
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className="relative bg-primary/10 p-2 rounded-full border border-primary/20">
                                      <ListChecks className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base sm:text-lg font-semibold">
                                      Interview Session
                                    </CardTitle>
                                    <CardDescription className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                                      <span className="flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(
                                          session.createdAt
                                        ).toLocaleDateString()}
                                      </span>
                                      <span className="hidden sm:inline">
                                        •
                                      </span>
                                      <span className="flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {session.duration} min
                                      </span>
                                      <span className="hidden sm:inline">
                                        •
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs capitalize"
                                      >
                                        {session.status}
                                      </Badge>
                                    </CardDescription>
                                  </div>
                                </div>

                                {session.feedback?.overallScore !== undefined &&
                                  session.feedback.overallScore !== null && (
                                    <div className="relative self-start">
                                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                      <div className="relative bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm p-3 sm:p-4 rounded-full border border-primary/30 shadow-md group-hover:shadow-lg transition-all duration-300">
                                        <div className="text-lg sm:text-xl font-bold text-center gradient-text">
                                          {session.feedback.overallScore}
                                        </div>
                                        <div className="text-xs text-muted-foreground text-center">
                                          / 100
                                        </div>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </CardHeader>

                            <CardContent className="relative z-10 pt-0 p-4 sm:p-6">
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {(session.feedback?.overallFeedback?.substring(
                                  0,
                                  120
                                ) || "Feedback pending...") +
                                  (session.feedback?.overallFeedback &&
                                  session.feedback.overallFeedback.length > 120
                                    ? "..."
                                    : "")}
                              </p>
                            </CardContent>

                            <CardFooter className="relative z-10 pt-0 p-4 sm:p-6">
                              <Link
                                href={`/feedback/${session.id}`}
                                className="w-full"
                              >
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start text-primary hover:text-primary/80 hover:bg-primary/10 group-hover:translate-x-2 transition-all duration-300"
                                >
                                  <div className="relative mr-2">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <BarChart3 className="relative h-4 w-4" />
                                  </div>
                                  <span className="text-sm sm:text-base">
                                    View Detailed Feedback
                                  </span>
                                  <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Button>
                              </Link>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Upgrade Promotion */}
          {userProfile && !userProfile.isPlusSubscriber && (
            <div className="animate-slide-in stagger-3">
              <Card className="sticky top-4 sm:top-8 relative overflow-hidden border-0 shadow-2xl glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-70 animate-rotate-gradient"></div>
                <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-primary/20 rounded-full blur-3xl animate-pulse-custom"></div>
                <div
                  className="absolute bottom-0 left-0 w-20 sm:w-32 h-20 sm:h-32 bg-accent/20 rounded-full blur-2xl animate-pulse-custom"
                  style={{ animationDelay: "2s" }}
                ></div>

                <CardHeader className="relative z-10 p-4 sm:p-6">
                  <div className="flex items-center space-x-3 sm:space-x-4 mb-2">
                    <div className="relative animate-float">
                      <div className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-pulse-custom"></div>
                      <div className="relative bg-gradient-to-br from-primary/30 to-accent/30 p-2 sm:p-3 rounded-full border border-primary/30 shadow-lg glow">
                        <Sparkles className="h-5 w-5 sm:h-6 lg:h-7 sm:w-6 lg:w-7 text-primary-foreground" />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold gradient-text glow-text">
                        Unlock Your Potential
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-base">
                        Upgrade to aiTyaari Plus
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Go unlimited and access exclusive features to supercharge
                    your preparation.
                  </p>

                  <div className="space-y-3 sm:space-y-4">
                    {[
                      {
                        icon: "✨",
                        text: "Unlimited interview sessions",
                        color: "from-yellow-500/20 to-yellow-500/10",
                        textColor: "text-yellow-600 dark:text-yellow-400",
                        delay: 0,
                      },
                      {
                        icon: "📊",
                        text: "Advanced performance analytics",
                        color: "from-blue-500/20 to-blue-500/10",
                        textColor: "text-blue-600 dark:text-blue-400",
                        delay: 0.5,
                      },
                      {
                        icon: "🏆",
                        text: "All question types & difficulties",
                        color: "from-purple-500/20 to-purple-500/10",
                        textColor: "text-purple-600 dark:text-purple-400",
                        delay: 1,
                      },
                      {
                        icon: "🔒",
                        text: "Priority AI model access",
                        color: "from-green-500/20 to-green-500/10",
                        textColor: "text-green-600 dark:text-green-400",
                        delay: 1.5,
                      },
                    ].map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 sm:space-x-4 p-2 sm:p-3 rounded-lg bg-gradient-to-r backdrop-blur-sm border border-primary/20 hover:border-primary/40 hover:shadow-lg transition-all duration-300 animate-fade-in"
                        style={{ animationDelay: `${feature.delay}s` }}
                      >
                        <div
                          className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${feature.color} backdrop-blur-sm border border-primary/20 shadow-md animate-float`}
                          style={{ animationDelay: `${index * 0.7}s` }}
                        >
                          <span className="text-base sm:text-xl">
                            {feature.icon}
                          </span>
                        </div>
                        <span
                          className={`text-sm sm:text-base font-medium ${feature.textColor}`}
                        >
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-custom"></div>
                      <Link href="/subscription" className="relative block">
                        <Button
                          size="lg"
                          className="w-full relative overflow-hidden bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                          <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-pulse-custom" />
                          <span className="relative z-10 text-sm sm:text-base lg:text-lg font-medium">
                            Upgrade to Plus
                          </span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
