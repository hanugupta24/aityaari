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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Brain,
  Clock,
  Calendar,
  Star,
  Zap,
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
  LineChart,
  PieChart,
  Activity,
  Sparkles,
  Trophy,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterviewSession } from "@/types";
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
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
} from "recharts";

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

  @keyframes countUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
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

  .animate-count-up {
    animation: countUp 0.8s ease-out forwards;
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

  .performance-bg {
    background-image: 
      radial-gradient(circle at 25% 25%, hsl(var(--primary)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 75% 75%, hsl(var(--accent)/0.15) 0%, transparent 30%),
      radial-gradient(circle at 50% 50%, hsl(var(--primary)/0.08) 0%, transparent 40%),
      linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--background)));
  }

  .metric-card {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .metric-card::before {
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

  .metric-card:hover::before {
    left: 100%;
  }

  .chart-container {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring-circle {
    transition: stroke-dashoffset 0.5s ease-in-out;
  }

  .skill-bar {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
  }

  .skill-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)));
    border-radius: 8px;
    transition: width 1s ease-in-out;
    position: relative;
    overflow: hidden;
  }

  .skill-bar-fill::after {
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

  .trend-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .trend-up {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
  }

  .trend-down {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }

  .trend-neutral {
    background: rgba(156, 163, 175, 0.1);
    color: rgb(156, 163, 175);
  }
`;

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#8dd1e1",
  "#d084d0",
];

export default function PerformancePage() {
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
  const [selectedTimeRange, setSelectedTimeRange] = useState("all");
  const [selectedMetric, setSelectedMetric] = useState("score");

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
          where("status", "==", "completed"),
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
          "An unknown error occurred while fetching performance data.";
        setError(errorMessage);
        toast({
          title: "Error Loading Performance",
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

  // Filter interviews by time range
  const filteredInterviews = useMemo(() => {
    if (selectedTimeRange === "all") return interviews;

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

    return interviews.filter(
      (interview) => new Date(interview.createdAt) >= filterDate
    );
  }, [interviews, selectedTimeRange]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    const completedInterviews = filteredInterviews.filter(
      (i) => i.feedback?.overallScore !== undefined
    );

    if (completedInterviews.length === 0) {
      return {
        averageScore: 0,
        totalInterviews: 0,
        improvementTrend: 0,
        consistencyScore: 0,
        strongestSkills: [],
        weakestSkills: [],
        scoreDistribution: [],
        progressOverTime: [],
        skillBreakdown: [],
        statusDistribution: [],
      };
    }

    const scores = completedInterviews.map(
      (i) => i.feedback?.overallScore || 0
    );
    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Calculate improvement trend
    const sortedByDate = [...completedInterviews].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const firstHalf = sortedByDate.slice(
      0,
      Math.floor(sortedByDate.length / 2)
    );
    const secondHalf = sortedByDate.slice(Math.floor(sortedByDate.length / 2));

    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce(
            (sum, i) => sum + (i.feedback?.overallScore || 0),
            0
          ) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce(
            (sum, i) => sum + (i.feedback?.overallScore || 0),
            0
          ) / secondHalf.length
        : 0;
    const improvementTrend = secondAvg - firstAvg;

    // Calculate consistency (lower standard deviation = higher consistency)
    const variance =
      scores.reduce(
        (sum, score) => sum + Math.pow(score - averageScore, 2),
        0
      ) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - standardDeviation * 2);

    // Score distribution
    const scoreRanges = [
      { range: "90-100", count: 0, color: "#22c55e" },
      { range: "80-89", count: 0, color: "#84cc16" },
      { range: "70-79", count: 0, color: "#eab308" },
      { range: "60-69", count: 0, color: "#f97316" },
      { range: "0-59", count: 0, color: "#ef4444" },
    ];

    scores.forEach((score) => {
      if (score >= 90) scoreRanges[0].count++;
      else if (score >= 80) scoreRanges[1].count++;
      else if (score >= 70) scoreRanges[2].count++;
      else if (score >= 60) scoreRanges[3].count++;
      else scoreRanges[4].count++;
    });

    // Progress over time
    const progressOverTime = sortedByDate.map((interview, index) => ({
      date: new Date(interview.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: interview.feedback?.overallScore || 0,
      interview: index + 1,
    }));

    // Mock skill breakdown (in real app, this would come from detailed feedback)
    const skillBreakdown = [
      {
        skill: "Communication",
        score: Math.min(100, averageScore + Math.random() * 20 - 10),
      },
      {
        skill: "Technical Knowledge",
        score: Math.min(100, averageScore + Math.random() * 20 - 10),
      },
      {
        skill: "Problem Solving",
        score: Math.min(100, averageScore + Math.random() * 20 - 10),
      },
      {
        skill: "Leadership",
        score: Math.min(100, averageScore + Math.random() * 20 - 10),
      },
      {
        skill: "Adaptability",
        score: Math.min(100, averageScore + Math.random() * 20 - 10),
      },
    ].sort((a, b) => b.score - a.score);

    const strongestSkills = skillBreakdown.slice(0, 2);
    const weakestSkills = skillBreakdown.slice(-2).reverse();

    // Status distribution
    const statusCounts = interviews.reduce((acc, interview) => {
      acc[interview.status] = (acc[interview.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusDistribution = Object.entries(statusCounts).map(
      ([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percentage: (count / interviews.length) * 100,
      })
    );

    return {
      averageScore: Math.round(averageScore),
      totalInterviews: completedInterviews.length,
      improvementTrend: Math.round(improvementTrend * 10) / 10,
      consistencyScore: Math.round(consistencyScore),
      strongestSkills,
      weakestSkills,
      scoreDistribution: scoreRanges.filter((range) => range.count > 0),
      progressOverTime,
      skillBreakdown,
      statusDistribution,
    };
  }, [filteredInterviews, interviews]);

  const getTrendIcon = (trend: number) => {
    if (trend > 2) return <ArrowUp className="h-4 w-4" />;
    if (trend < -2) return <ArrowDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendClass = (trend: number) => {
    if (trend > 2) return "trend-up";
    if (trend < -2) return "trend-down";
    return "trend-neutral";
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
      <div className="flex flex-col items-center justify-center min-h-screen performance-bg">
        <style>{styles}</style>
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-3xl bg-primary/30 animate-pulse-custom"></div>
          <Loader2 className="relative h-20 w-20 animate-spin text-primary drop-shadow-lg" />
        </div>
        <div className="mt-10 text-center space-y-3 max-w-md">
          <h3 className="text-2xl font-bold gradient-text animate-pulse-custom">
            Loading your performance
          </h3>
          <p className="text-muted-foreground">
            Analyzing your interview data...
          </p>
        </div>
      </div>
    );
  }

  if (!user && !authInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen performance-bg p-4">
        <style>{styles}</style>
        <Alert variant="destructive" className="max-w-md animate-slide-in">
          <AlertTriangle className="h-6 w-6" />
          <AlertTitle className="text-xl font-bold">
            Authentication Required
          </AlertTitle>
          <AlertDescription className="mt-4">
            <p className="mb-4">
              You need to be logged in to view your performance analytics.
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
      className="min-h-screen performance-bg relative overflow-hidden"
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-6 animate-slide-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-2xl animate-pulse-custom"></div>
            <div className="relative bg-gradient-to-br from-primary/20 to-accent/20 p-4 rounded-full border border-primary/30 shadow-lg backdrop-blur-sm">
              <BarChart3 className="h-12 w-12 text-primary animate-float" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold gradient-text">
              Performance Analytics
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Deep insights into your interview performance and skill
              development
            </p>
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="flex justify-center animate-slide-in stagger-1">
          <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border w-full max-w-xs sm:max-w-md">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Calendar className="h-5 w-5 text-primary" />
                <Select
                  value={selectedTimeRange}
                  onValueChange={setSelectedTimeRange}
                >
                  <SelectTrigger className="w-full bg-background/50 backdrop-blur-sm border-primary/20">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="flex flex-col justify-center items-center py-16 animate-slide-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-custom"></div>
              <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
            </div>
            <p className="text-lg text-muted-foreground animate-pulse-custom">
              Analyzing your performance data...
            </p>
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive" className="animate-slide-in">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Error Loading Performance Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && interviews.length === 0 && (
          <div className="text-center py-16 space-y-6 animate-slide-in">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-muted/20 rounded-full blur-xl animate-pulse-custom"></div>
              <BarChart3 className="relative mx-auto h-20 w-20 text-muted-foreground/60 animate-float" />
            </div>
            <div className="space-y-3">
              <p className="text-xl font-medium text-muted-foreground">
                No performance data available
              </p>
              <p className="text-base text-muted-foreground">
                Complete some interviews to see your analytics
              </p>
            </div>
            <Link href="/interview/start">
              <Button size="lg" className="animate-shimmer">
                <Target className="mr-2 h-5 w-5" />
                Start Your First Interview
              </Button>
            </Link>
          </div>
        )}

        {!loading && !error && interviews.length > 0 && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-in stagger-2">
              <Card className="metric-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5"></div>
                <CardContent className="relative z-10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Average Score
                      </p>
                      <p className="text-3xl font-bold gradient-text animate-count-up">
                        {performanceMetrics.averageScore}%
                      </p>
                      <div
                        className={`trend-indicator ${getTrendClass(
                          performanceMetrics.improvementTrend
                        )}`}
                      >
                        {getTrendIcon(performanceMetrics.improvementTrend)}
                        {Math.abs(performanceMetrics.improvementTrend).toFixed(
                          1
                        )}
                        %
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 p-3 rounded-full">
                      <Award className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-500/5"></div>
                <CardContent className="relative z-10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Interviews Completed
                      </p>
                      <p className="text-3xl font-bold gradient-text animate-count-up">
                        {performanceMetrics.totalInterviews}
                      </p>
                      <div className="trend-indicator trend-up">
                        <TrendingUp className="h-4 w-4" />
                        Active
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 p-3 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5"></div>
                <CardContent className="relative z-10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Consistency Score
                      </p>
                      <p className="text-3xl font-bold gradient-text animate-count-up">
                        {performanceMetrics.consistencyScore}%
                      </p>
                      <div className="trend-indicator trend-neutral">
                        <Activity className="h-4 w-4" />
                        Stable
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 p-3 rounded-full">
                      <Target className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-500/5"></div>
                <CardContent className="relative z-10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Improvement Trend
                      </p>
                      <p className="text-3xl font-bold gradient-text animate-count-up">
                        {performanceMetrics.improvementTrend > 0 ? "+" : ""}
                        {performanceMetrics.improvementTrend.toFixed(1)}%
                      </p>
                      <div
                        className={`trend-indicator ${getTrendClass(
                          performanceMetrics.improvementTrend
                        )}`}
                      >
                        {performanceMetrics.improvementTrend > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {performanceMetrics.improvementTrend > 0
                          ? "Growing"
                          : "Declining"}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/10 p-3 rounded-full">
                      <LineChart className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <Tabs
              defaultValue="progress"
              className="animate-slide-in stagger-3"
            >
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-background/50 backdrop-blur-sm">
                <TabsTrigger
                  value="progress"
                  className="flex items-center gap-2"
                >
                  <LineChart className="h-4 w-4" />
                  Progress Over Time
                </TabsTrigger>
                <TabsTrigger
                  value="distribution"
                  className="flex items-center gap-2"
                >
                  <PieChart className="h-4 w-4" />
                  Score Distribution
                </TabsTrigger>
                <TabsTrigger value="skills" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Skill Breakdown
                </TabsTrigger>
                <TabsTrigger value="status" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Interview Status
                </TabsTrigger>
              </TabsList>

              <TabsContent value="progress" className="mt-6">
                <Card className="chart-container">
                  <CardHeader>
                    <CardTitle className="gradient-text">
                      Score Progress Over Time
                    </CardTitle>
                    <CardDescription>
                      Track your improvement across interviews
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart
                          data={performanceMetrics.progressOverTime}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.1)"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="rgba(255,255,255,0.7)"
                          />
                          <YAxis
                            stroke="rgba(255,255,255,0.7)"
                            domain={[0, 100]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(0,0,0,0.8)",
                              border: "1px solid rgba(255,255,255,0.2)",
                              borderRadius: "8px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="url(#gradient)"
                            strokeWidth={3}
                            dot={{ fill: "#8884d8", strokeWidth: 2, r: 6 }}
                            activeDot={{
                              r: 8,
                              stroke: "#8884d8",
                              strokeWidth: 2,
                            }}
                          />
                          <defs>
                            <linearGradient
                              id="gradient"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop offset="0%" stopColor="#8884d8" />
                              <stop offset="100%" stopColor="#82ca9d" />
                            </linearGradient>
                          </defs>
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="distribution" className="mt-6">
                <Card className="chart-container">
                  <CardHeader>
                    <CardTitle className="gradient-text">
                      Score Distribution
                    </CardTitle>
                    <CardDescription>
                      Breakdown of your performance ranges
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={performanceMetrics.scoreDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ range, count }) => `${range}: ${count}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {performanceMetrics.scoreDistribution.map(
                              (entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
                              )
                            )}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(0,0,0,0.8)",
                              border: "1px solid rgba(255,255,255,0.2)",
                              borderRadius: "8px",
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="skills" className="mt-6">
                <Card className="chart-container">
                  <CardHeader>
                    <CardTitle className="gradient-text">
                      Skill Assessment
                    </CardTitle>
                    <CardDescription>
                      Your performance across different skill areas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {performanceMetrics.skillBreakdown.map((skill, index) => (
                      <div
                        key={skill.skill}
                        className="space-y-2"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{skill.skill}</span>
                          <span className="text-sm font-bold">
                            {Math.round(skill.score)}%
                          </span>
                        </div>
                        <div className="skill-bar h-3">
                          <div
                            className="skill-bar-fill"
                            style={{ width: `${skill.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="status" className="mt-6">
                <Card className="chart-container">
                  <CardHeader>
                    <CardTitle className="gradient-text">
                      Interview Status Overview
                    </CardTitle>
                    <CardDescription>
                      Distribution of your interview completion status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={performanceMetrics.statusDistribution}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.1)"
                          />
                          <XAxis
                            dataKey="status"
                            stroke="rgba(255,255,255,0.7)"
                          />
                          <YAxis stroke="rgba(255,255,255,0.7)" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(0,0,0,0.8)",
                              border: "1px solid rgba(255,255,255,0.2)",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="url(#barGradient)"
                            radius={[4, 4, 0, 0]}
                          />
                          <defs>
                            <linearGradient
                              id="barGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop offset="0%" stopColor="#8884d8" />
                              <stop offset="100%" stopColor="#82ca9d" />
                            </linearGradient>
                          </defs>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-in stagger-4">
              {/* Strongest Skills */}
              <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2 gradient-text">
                    <Trophy className="h-5 w-5 text-green-500" />
                    Strongest Skills
                  </CardTitle>
                  <CardDescription>
                    Areas where you excel the most
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  {performanceMetrics.strongestSkills.map((skill, index) => (
                    <div
                      key={skill.skill}
                      className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 p-2 rounded-full">
                          <Star className="h-4 w-4 text-green-500" />
                        </div>
                        <span className="font-medium">{skill.skill}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/20 text-green-700"
                      >
                        {Math.round(skill.score)}%
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Areas for Improvement */}
              <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2 gradient-text">
                    <Target className="h-5 w-5 text-orange-500" />
                    Areas for Improvement
                  </CardTitle>
                  <CardDescription>Skills that need more focus</CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  {performanceMetrics.weakestSkills.map((skill, index) => (
                    <div
                      key={skill.skill}
                      className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-500/20 p-2 rounded-full">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        </div>
                        <span className="font-medium">{skill.skill}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-orange-500/20 text-orange-700"
                      >
                        {Math.round(skill.score)}%
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Action Items */}
            <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border animate-slide-in stagger-5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 gradient-text">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Recommended Actions
                </CardTitle>
                <CardDescription>
                  Personalized suggestions to improve your performance
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Study Materials</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Review technical concepts to boost your knowledge scores
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">Mock Interviews</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Practice more interviews to improve consistency
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Quick Practice</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Focus on your weakest skills with targeted sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="relative overflow-hidden border-0 shadow-lg glassmorphism gradient-border animate-slide-in stagger-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
              <CardContent className="relative z-10 p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold gradient-text">
                      Keep improving your skills
                    </h3>
                    <p className="text-muted-foreground">
                      Take another interview or explore your detailed history
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                    <Link href="/interview/start" className="w-full sm:w-auto">
                      <Button size="lg" className="animate-shimmer w-full">
                        <Target className="mr-2 h-5 w-5" />
                        Start New Interview
                      </Button>
                    </Link>
                    <Link href="/history" className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full">
                        <Clock className="mr-2 h-5 w-5" />
                        View History
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
