"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Calendar,
  Clock,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Eye,
  Download,
  Share2,
  Loader2,
  AlertTriangle,
  DatabaseZap,
  ExternalLink,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  HistoryIcon,
  FileText,
  Brain,
  Timer,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterviewSession } from "@/types";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

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

  @keyframes scaleIn {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
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

  .animate-slide-in-left {
    animation: slideInFromLeft 0.6s ease-out forwards;
  }

  .animate-slide-in-right {
    animation: slideInFromRight 0.6s ease-out forwards;
  }

  .animate-fade-in {
    animation: fadeIn 0.8s ease-out forwards;
  }

  .animate-scale-in {
    animation: scaleIn 0.5s ease-out forwards;
  }

  .animate-rotate-gradient {
    animation: rotateGradient 3s ease infinite;
  }

  .stagger-1 { animation-delay: 0.1s; }
  .stagger-2 { animation-delay: 0.2s; }
  .stagger-3 { animation-delay: 0.3s; }
  .stagger-4 { animation-delay: 0.4s; }
  .stagger-5 { animation-delay: 0.5s; }
  .stagger-6 { animation-delay: 0.6s; }

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

  .history-bg {
    background-image: 
      radial-gradient(circle at 15% 15%, hsl(var(--primary)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 85% 85%, hsl(var(--accent)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 50% 50%, hsl(var(--primary)/0.08) 0%, transparent 40%),
      linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--background)));
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .stat-card::before {
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

  .stat-card:hover::before {
    left: 100%;
  }

  .interview-card {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .interview-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.05),
      transparent
    );
    transition: left 0.5s;
  }

  .interview-card:hover::before {
    left: 100%;
  }

  .interview-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }

  .score-circle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .score-circle::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)));
    animation: rotateGradient 3s linear infinite;
    z-index: -1;
  }

  .filter-chip {
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .filter-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .filter-chip.active {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
    color: white;
    transform: scale(1.05);
  }
`;

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
        Error Loading Interview History
      </AlertTitle>
      <AlertDescription className="mt-2 text-sm leading-relaxed">
        Could not fetch your interview history. {error}
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

export default function HistoryPage() {
  const {
    user,
    userProfile,
    initialLoading: authInitialLoading,
    loading: authLoading,
  } = useAuth();
  const { toast } = useToast();
  const pageRef = useRef<HTMLDivElement>(null);

  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTimeRange, setSelectedTimeRange] = useState("all");

  // Fetch interviews
  useEffect(() => {
    const fetchInterviews = async () => {
      if (!user) {
        setInterviews([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const interviewsRef = collection(db, "users", user.uid, "interviews");
        const q = query(
          interviewsRef,
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const querySnapshot = await getDocs(q);
        const interviewsData: InterviewSession[] = [];
        querySnapshot.forEach((doc) => {
          interviewsData.push({
            id: doc.id,
            ...doc.data(),
          } as InterviewSession);
        });
        setInterviews(interviewsData);
      } catch (error: any) {
        console.error("Error fetching interviews:", error);
        const errorMessage =
          error.message ||
          "An unknown error occurred while fetching interviews.";
        setError(errorMessage);
        toast({
          title: "Error Loading History",
          description: errorMessage,
          variant: "destructive",
        });
        setInterviews([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authInitialLoading && user) {
      fetchInterviews();
    } else if (!authInitialLoading && !user) {
      setLoading(false);
      setInterviews([]);
      setError(null);
    }
  }, [user, authInitialLoading, toast]);

  // Filter and sort interviews
  const filteredAndSortedInterviews = useMemo(() => {
    let filtered = interviews;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (interview) =>
          interview.feedback?.overallFeedback
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          new Date(interview.createdAt)
            .toLocaleDateString()
            .includes(searchTerm) ||
          interview.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (interview) => interview.status === statusFilter
      );
    }

    // Apply time range filter
    if (selectedTimeRange !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (selectedTimeRange) {
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(
        (interview) => new Date(interview.createdAt) >= filterDate
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
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    interviews,
    searchTerm,
    statusFilter,
    selectedTimeRange,
    sortBy,
    sortOrder,
  ]);

  // Move this function before the stats useMemo
  const calculateImprovementTrend = (
    completedInterviews: InterviewSession[]
  ) => {
    if (completedInterviews.length < 2) return 0;

    const sorted = [...completedInterviews].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, i) => sum + (i.feedback?.overallScore || 0), 0) /
      firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, i) => sum + (i.feedback?.overallScore || 0), 0) /
      secondHalf.length;

    return secondAvg - firstAvg;
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const completedInterviews = interviews.filter(
      (i) => i.status === "completed"
    );
    const totalInterviews = interviews.length;
    const averageScore =
      completedInterviews.length > 0
        ? completedInterviews.reduce(
            (sum, i) => sum + (i.feedback?.overallScore || 0),
            0
          ) / completedInterviews.length
        : 0;
    const totalTime = interviews.reduce((sum, i) => sum + (i.duration || 0), 0);
    const improvementTrend =
      completedInterviews.length >= 2
        ? calculateImprovementTrend(completedInterviews)
        : 0;

    return {
      totalInterviews,
      completedInterviews: completedInterviews.length,
      averageScore: Math.round(averageScore),
      totalTime,
      improvementTrend,
    };
  }, [interviews]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in-progress":
        return <PlayCircle className="h-4 w-4 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "paused":
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const timeRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "week", label: "Last Week" },
    { value: "month", label: "Last Month" },
    { value: "quarter", label: "Last 3 Months" },
    { value: "year", label: "Last Year" },
  ];

  if (authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen history-bg">
        <style>{styles}</style>
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-3xl bg-primary/30 animate-pulse-custom"></div>
          <Loader2 className="relative h-20 w-20 animate-spin text-primary drop-shadow-lg" />
        </div>
        <div className="mt-10 text-center space-y-3 max-w-md">
          <h3 className="text-2xl font-bold gradient-text animate-pulse-custom">
            Loading your history
          </h3>
          <p className="text-muted-foreground">
            Fetching your interview records...
          </p>
        </div>
      </div>
    );
  }

  if (!user && !authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen history-bg p-4">
        <style>{styles}</style>
        <Alert variant="destructive" className="max-w-md animate-slide-in">
          <AlertTriangle className="h-6 w-6" />
          <AlertTitle className="text-xl font-bold">
            Authentication Required
          </AlertTitle>
          <AlertDescription className="mt-4">
            <p className="mb-4">
              You need to be logged in to view your interview history.
            </p>
            <Link href="/login">
              <Button className="w-full">Login to Continue</Button>
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className="min-h-screen history-bg relative overflow-x-hidden"
    >
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

      <div className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center space-y-6 animate-slide-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-2xl animate-pulse-custom"></div>
            <div className="relative bg-gradient-to-br from-primary/20 to-accent/20 p-4 rounded-full border border-primary/30 shadow-lg backdrop-blur-sm">
              <HistoryIcon className="h-12 w-12 text-primary animate-float" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold gradient-text">
              Interview History
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Track your progress and review your interview performance over
              time
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-slide-in stagger-1">
          <Card className="stat-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5"></div>
            <CardContent className="relative z-10 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Interviews
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold gradient-text">
                    {stats.totalInterviews}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 p-2 sm:p-3 rounded-full">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-500/5"></div>
            <CardContent className="relative z-10 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Completed
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold gradient-text">
                    {stats.completedInterviews}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 p-2 sm:p-3 rounded-full">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5"></div>
            <CardContent className="relative z-10 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Average Score
                  </p>
                  <p
                    className={`text-2xl sm:text-3xl font-bold ${getScoreColor(
                      stats.averageScore
                    )}`}
                  >
                    {stats.averageScore}%
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 p-2 sm:p-3 rounded-full">
                  <Award className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-500/5"></div>
            <CardContent className="relative z-10 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Time
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold gradient-text">
                    {Math.round(stats.totalTime / 60)}h
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/10 p-2 sm:p-3 rounded-full">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Improvement Trend */}
        {stats.completedInterviews >= 2 && (
          <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border animate-slide-in stagger-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
            <CardContent className="relative z-10 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  {stats.improvementTrend > 0 ? (
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                  )}
                  <span className="text-base sm:text-lg font-semibold">
                    {stats.improvementTrend > 0 ? "Improving" : "Declining"}{" "}
                    Performance
                  </span>
                </div>
                <Badge
                  variant={
                    stats.improvementTrend > 0 ? "default" : "destructive"
                  }
                  className="text-sm"
                >
                  {stats.improvementTrend > 0 ? "+" : ""}
                  {Math.round(stats.improvementTrend)}% trend
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Search */}
        <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border animate-slide-in stagger-3">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
          <CardHeader className="relative z-10 p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl gradient-text">
              Filter & Search
            </CardTitle>
            <CardDescription>
              Find specific interviews or filter by criteria
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>

              {/* Time Range */}
              <Select
                value={selectedTimeRange}
                onValueChange={setSelectedTimeRange}
              >
                <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                  <SelectItem value="status">Status</SelectItem>
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
          </CardContent>
        </Card>

        {/* Interview List */}
        <div className="space-y-4 sm:space-y-6">
          {loading && (
            <div className="flex flex-col justify-center items-center py-12 sm:py-16 animate-slide-in">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-custom"></div>
                <Loader2 className="relative h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />
              </div>
              <p className="text-base sm:text-lg text-muted-foreground animate-pulse-custom">
                Loading your interview history...
              </p>
            </div>
          )}

          {!loading && error && <InterviewsErrorAlert error={error} />}

          {!loading && !error && interviews.length === 0 && (
            <div className="text-center py-12 sm:py-16 space-y-4 sm:space-y-6 animate-slide-in">
              <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
                <div className="absolute inset-0 bg-muted/20 rounded-full blur-xl animate-pulse-custom"></div>
                <DatabaseZap className="relative mx-auto h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground/60 animate-float" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <p className="text-lg sm:text-xl font-medium text-muted-foreground">
                  No interviews yet
                </p>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Start your first interview to see your history here
                </p>
              </div>
              <Link href="/interview/start">
                <Button size="lg" className="animate-shimmer">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Your First Interview
                </Button>
              </Link>
            </div>
          )}

          {!loading &&
            !error &&
            filteredAndSortedInterviews.length === 0 &&
            interviews.length > 0 && (
              <div className="text-center py-12 sm:py-16 space-y-4 animate-slide-in">
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
                    setSelectedTimeRange("all");
                    setSortBy("date");
                    setSortOrder("desc");
                  }}
                  className="hover:scale-105 transition-transform"
                >
                  Clear All Filters
                </Button>
              </div>
            )}

          {!loading && !error && filteredAndSortedInterviews.length > 0 && (
            <div className="space-y-4">
              {filteredAndSortedInterviews.map((interview, index) => (
                <Card
                  key={interview.id}
                  className="interview-card relative overflow-hidden border border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background/50 to-primary/5 backdrop-blur-sm animate-slide-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>

                  <CardContent className="relative z-10 p-3 sm:p-4 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                      {/* Interview Info */}
                      <div className="flex items-start space-x-2 sm:space-x-4 flex-1">
                        <div className="relative hidden sm:block">
                          <div className="bg-primary/10 p-2 sm:p-3 rounded-full border border-primary/20">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h3 className="text-base sm:text-lg font-semibold">
                              Interview Session
                            </h3>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(interview.status)}
                              <Badge
                                variant="secondary"
                                className="text-xs capitalize"
                              >
                                {interview.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(interview.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {interview.duration} minutes
                            </span>
                            {interview.feedback?.overallFeedback && (
                              <span className="flex items-center">
                                <Brain className="h-3 w-3 mr-1" />
                                AI Feedback Available
                              </span>
                            )}
                          </div>
                          {interview.feedback?.overallFeedback && (
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                              {interview.feedback.overallFeedback.substring(
                                0,
                                150
                              )}
                              {interview.feedback.overallFeedback.length > 150
                                ? "..."
                                : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Score and Actions */}
                      <div className="flex items-center space-x-2 sm:space-x-4 mt-2 lg:mt-0">
                        {interview.feedback?.overallScore !== undefined &&
                          interview.feedback.overallScore !== null && (
                            <div className="text-center">
                              <div className="score-circle w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm border border-primary/30 shadow-md">
                                <div
                                  className={`text-base sm:text-lg font-bold ${getScoreColor(
                                    interview.feedback.overallScore
                                  )}`}
                                >
                                  {interview.feedback.overallScore}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Score
                              </p>
                            </div>
                          )}

                        <div className="flex flex-col space-y-2">
                          <Link href={`/feedback/${interview.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </Link>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border animate-slide-in stagger-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
          <CardContent className="relative z-10 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold gradient-text">
                  Ready for your next interview?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Continue improving your skills with AI-powered practice
                </p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                <Link href="/interview/start" className="w-full sm:w-auto">
                  <Button size="lg" className="animate-shimmer w-full">
                    <PlayCircle className="mr-2 h-5 w-5" />
                    Start New Interview
                  </Button>
                </Link>
                <Link href="/performance" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    View Performance
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
