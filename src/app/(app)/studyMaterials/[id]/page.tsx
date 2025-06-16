"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Clock,
  Star,
  Eye,
  Bookmark,
  Share2,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ArrowLeft,
  User,
  Calendar,
  Tag,
  ExternalLink,
  Github,
  Globe,
  CheckCircle,
  XCircle,
  Award,
  Target,
  BookmarkCheck,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  FileText,
  Video,
  Headphones,
  Code,
  Brain,
  Zap,
  Users,
  TrendingUp,
  PlayCircle,
  PauseCircle,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume1,
  Volume,
  RotateCcw,
  Send,
  Heart,
  Loader2,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import type { StudyMaterial } from "@/types";
import { RoleBadge } from "../../../../components/role-badge";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Comment {
  id: string;
  content: string;
  author: string;
  authorUid: string;
  createdAt: string;
  likes: number;
  replies?: Comment[];
}

interface QuizAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

export default function StudyMaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const materialId = params.id as string;

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Video/Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const fetchMaterial = async () => {
      if (!materialId) return;

      try {
        const materialDoc = await getDoc(
          doc(db, "study-materials", materialId)
        );

        if (materialDoc.exists()) {
          const materialData = {
            id: materialDoc.id,
            ...materialDoc.data(),
          } as StudyMaterial;
          setMaterial(materialData);
          setIsBookmarked(materialData.isBookmarked || false);

          // Increment view count
          await updateDoc(doc(db, "study-materials", materialId), {
            views: (materialData.views || 0) + 1,
            updatedAt: new Date().toISOString(),
          });

          // Fetch comments
          await fetchComments();
        } else {
          toast({
            title: "Material not found",
            description: "The requested study material could not be found.",
            variant: "destructive",
          });
          router.push("/studyMaterials");
        }
      } catch (error) {
        console.error("Error fetching material:", error);
        toast({
          title: "Error",
          description: "Failed to load study material.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaterial();
  }, [materialId, router, toast]);

  const fetchComments = async () => {
    try {
      const commentsQuery = query(
        collection(db, "comments"),
        where("materialId", "==", materialId),
        orderBy("createdAt", "desc")
      );

      const commentsSnapshot = await getDocs(commentsQuery);
      console.log("Fetched comments:", commentsSnapshot.docs.length);
      const commentsData: Comment[] = [];

      commentsSnapshot.forEach((doc) => {
        commentsData.push({ id: doc.id, ...doc.data() } as Comment);
      });

      setComments(commentsData);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleBookmark = async () => {
    if (!material || !userProfile) return;

    try {
      const newBookmarkState = !isBookmarked;
      setIsBookmarked(newBookmarkState);

      await updateDoc(doc(db, "study-materials", materialId), {
        isBookmarked: newBookmarkState,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: newBookmarkState ? "Bookmarked" : "Bookmark removed",
        description: newBookmarkState
          ? "Material added to your bookmarks"
          : "Material removed from your bookmarks",
      });
    } catch (error) {
      console.error("Error updating bookmark:", error);
      setIsBookmarked(!isBookmarked); // Revert on error
      toast({
        title: "Error",
        description: "Failed to update bookmark.",
        variant: "destructive",
      });
    }
  };

  const handleRating = async (rating: number) => {
    if (!material || !userProfile) return;

    try {
      setUserRating(rating);

      // In a real app, you'd store individual ratings and calculate average
      const newRating = ((material.rating || 0) + rating) / 2;

      await updateDoc(doc(db, "study-materials", materialId), {
        rating: newRating,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: "Rating submitted",
        description: `You rated this material ${rating} stars.`,
      });
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: "Failed to submit rating.",
        variant: "destructive",
      });
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !userProfile) return;

    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, "comments"), {
        materialId,
        content: newComment,
        author: userProfile.name || userProfile.email,
        authorUid: userProfile.uid,
        createdAt: new Date().toISOString(),
        likes: 0,
      });

      setNewComment("");
      await fetchComments();

      toast({
        title: "Comment added",
        description: "Your comment has been posted.",
      });
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleQuizAnswer = (questionId: string, selectedAnswer: number) => {
    setQuizAnswers((prev) => {
      const existing = prev.find((a) => a.questionId === questionId);
      if (existing) {
        return prev.map((a) =>
          a.questionId === questionId ? { ...a, selectedAnswer } : a
        );
      } else {
        return [...prev, { questionId, selectedAnswer, isCorrect: false }];
      }
    });
  };

  const submitQuiz = () => {
    if (!material?.questions) return;

    let correctAnswers = 0;
    const updatedAnswers = quizAnswers.map((answer) => {
      const question = material.questions?.find(
        (q) => q.id === answer.questionId
      );
      const isCorrect = question?.correctAnswer === answer.selectedAnswer;
      if (isCorrect) correctAnswers++;
      return { ...answer, isCorrect };
    });

    setQuizAnswers(updatedAnswers);
    setQuizScore((correctAnswers / material.questions.length) * 100);
    setQuizSubmitted(true);

    toast({
      title: "Quiz submitted",
      description: `You scored ${correctAnswers}/${
        material.questions.length
      } (${Math.round((correctAnswers / material.questions.length) * 100)}%)`,
    });
  };

  const getTypeIcon = (type: StudyMaterial["type"]) => {
    const icons = {
      video: Video,
      article: FileText,
      course: BookOpen,
      quiz: Brain,
      podcast: Headphones,
      code: Code,
    };
    return icons[type] || FileText;
  };

  const getDifficultyColor = (difficulty: StudyMaterial["difficulty"]) => {
    const colors = {
      beginner: "bg-green-100 text-green-800 border-green-200",
      intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
      advanced: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[difficulty];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin border-t-primary mx-auto"></div>
          <p className="text-muted-foreground font-medium">
            Loading study material...
          </p>
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Material Not Found</CardTitle>
            <CardDescription>
              The requested study material could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/studyMaterials")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Materials
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TypeIcon = getTypeIcon(material.type);

  function getYouTubeEmbedUrl(url: string): string {
    const videoIdMatch = url.match(
      /(?:v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const videoId = videoIdMatch ? videoIdMatch[1] : "";
    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-primary" />
            <Badge variant="secondary" className="capitalize">
              {material.type}
            </Badge>
            <Badge
              variant="outline"
              className={getDifficultyColor(material.difficulty)}
            >
              {material.difficulty}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Section */}
            <Card>
              <div className="relative">
                <img
                  src={material.thumbnail}
                  alt={material.title}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
                {material.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button size="lg" className="rounded-full w-16 h-16">
                      <Play className="h-8 w-8" />
                    </Button>
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  {material.isPremium && (
                    <Badge className="bg-accent/90 text-accent-foreground">
                      <Zap className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
              </div>

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{material.title}</CardTitle>
                    <CardDescription className="text-base">
                      {material.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleBookmark}
                      className={isBookmarked ? "text-primary" : ""}
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isBookmarked ? "fill-current" : ""
                        }`}
                      />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {material.views?.toLocaleString() || 0} views
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {material.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {material.rating?.toFixed(1) || "New"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(material.createdAt)}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {material.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
            </Card>

            {/* Content Tabs */}
            <Card>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="overview" className="space-y-6">
                    {/* Author Info */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{material.author}</h3>
                        <p className="text-sm text-muted-foreground">
                          Content Creator
                        </p>
                        {material.authorRole && (
                          <RoleBadge
                            role={material.authorRole}
                            className="mt-1"
                          />
                        )}
                      </div>
                      {/* <Button variant="outline" size="sm">
                        Follow
                      </Button> */}
                    </div>

                    {/* Course/Content specific overview */}
                    {material.type === "course" && material.modules && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Course Modules
                        </h3>
                        {material.modules.map((module, index) => (
                          <Card key={module.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-medium">
                                    {module.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {module.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {module.duration}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Prerequisites and Learning Outcomes */}
                    {material.prerequisites &&
                      material.prerequisites.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold">
                            Prerequisites
                          </h3>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {material.prerequisites.map((prereq, index) => (
                              <li key={index}>{prereq}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {material.learningOutcomes &&
                      material.learningOutcomes.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold">
                            What You'll Learn
                          </h3>
                          <ul className="space-y-2">
                            {material.learningOutcomes.map((outcome, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{outcome}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </TabsContent>

                  <TabsContent value="content" className="space-y-6">
                    {/* Article Content */}
                    {material.type === "article" && material.content && (
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap">
                          {material.content}
                        </div>
                      </div>
                    )}

                    {/* Video Content */}
                    {material.type === "video" && (
                      <div className="space-y-4">
                        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                          {material.videoUrl ? (
                            <iframe
                              src={getYouTubeEmbedUrl(material.videoUrl)}
                              className="w-full h-full rounded-lg"
                              allowFullScreen
                            />
                          ) : (
                            <div className="text-white text-center">
                              <Video className="h-12 w-12 mx-auto mb-2" />
                              <p>Video content will be displayed here</p>
                            </div>
                          )}
                        </div>
                        {material.transcript && (
                          <div className="space-y-2">
                            <h3 className="font-semibold">Transcript</h3>
                            <div className="p-4 bg-muted/30 rounded-lg text-sm">
                              {material.transcript}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quiz Content */}
                    {material.type === "quiz" && material.questions && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">
                            Quiz Questions
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            {material.questions.length} questions
                            {material.timeLimit &&
                              ` • ${material.timeLimit} minutes`}
                            {material.passingScore &&
                              ` • ${material.passingScore}% to pass`}
                          </div>
                        </div>

                        {material.questions.map((question, index) => (
                          <Card key={question.id} className="p-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">
                                {index + 1}. {question.question}
                              </h4>
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <label
                                    key={optionIndex}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                      quizAnswers.find(
                                        (a) => a.questionId === question.id
                                      )?.selectedAnswer === optionIndex
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:bg-muted/50"
                                    } ${
                                      quizSubmitted
                                        ? question.correctAnswer === optionIndex
                                          ? "border-green-500 bg-green-50"
                                          : quizAnswers.find(
                                              (a) =>
                                                a.questionId === question.id
                                            )?.selectedAnswer === optionIndex
                                          ? "border-red-500 bg-red-50"
                                          : ""
                                        : ""
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${question.id}`}
                                      value={optionIndex}
                                      onChange={() =>
                                        handleQuizAnswer(
                                          question.id,
                                          optionIndex
                                        )
                                      }
                                      disabled={quizSubmitted}
                                      className="text-primary"
                                    />
                                    <span>{option}</span>
                                    {quizSubmitted &&
                                      question.correctAnswer ===
                                        optionIndex && (
                                        <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                                      )}
                                    {quizSubmitted &&
                                      quizAnswers.find(
                                        (a) => a.questionId === question.id
                                      )?.selectedAnswer === optionIndex &&
                                      question.correctAnswer !==
                                        optionIndex && (
                                        <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                                      )}
                                  </label>
                                ))}
                              </div>
                              {quizSubmitted && question.explanation && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-sm text-blue-800">
                                    <strong>Explanation:</strong>{" "}
                                    {question.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}

                        {!quizSubmitted ? (
                          <Button
                            onClick={submitQuiz}
                            disabled={
                              quizAnswers.length !== material.questions.length
                            }
                            className="w-full"
                          >
                            Submit Quiz
                          </Button>
                        ) : (
                          <Card className="p-6 text-center">
                            <div className="space-y-4">
                              <div className="text-2xl font-bold">
                                Quiz Complete!
                              </div>
                              <div className="text-lg">
                                Your Score: {quizScore.toFixed(1)}%
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                {quizScore >= (material.passingScore || 70) ? (
                                  <>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <span className="text-green-600 font-medium">
                                      Passed!
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-5 w-5 text-red-500" />
                                    <span className="text-red-600 font-medium">
                                      Try Again
                                    </span>
                                  </>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setQuizAnswers([]);
                                  setQuizSubmitted(false);
                                  setQuizScore(0);
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Retake Quiz
                              </Button>
                            </div>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Podcast Content */}
                    {material.type === "podcast" && (
                      <div className="space-y-4">
                        <div className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                              <Headphones className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">
                                {material.title}
                              </h3>
                              {material.hostName && (
                                <p className="text-sm text-muted-foreground">
                                  Hosted by {material.hostName}
                                </p>
                              )}
                              {material.episodeNumber && (
                                <p className="text-sm text-muted-foreground">
                                  Episode {material.episodeNumber}
                                </p>
                              )}
                            </div>
                            <Button size="lg" className="rounded-full">
                              <Play className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>

                        {material.transcript && (
                          <div className="space-y-2">
                            <h3 className="font-semibold">Transcript</h3>
                            <div className="p-4 bg-muted/30 rounded-lg text-sm">
                              {material.transcript}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Code Content */}
                    {material.type === "code" && (
                      <div className="space-y-6">
                        {material.programmingLanguage && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              <Code className="h-3 w-3 mr-1" />
                              {material.programmingLanguage}
                            </Badge>
                            {material.githubUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={material.githubUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Github className="h-4 w-4 mr-2" />
                                  GitHub
                                </a>
                              </Button>
                            )}
                            {material.liveDemo && (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={material.liveDemo}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Globe className="h-4 w-4 mr-2" />
                                  Live Demo
                                </a>
                              </Button>
                            )}
                          </div>
                        )}

                        {material.codeContent && (
                          <div className="space-y-2">
                            <h3 className="font-semibold">Code</h3>
                            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm">
                              <code>{material.codeContent}</code>
                            </pre>
                          </div>
                        )}

                        {material.documentation && (
                          <div className="space-y-2">
                            <h3 className="font-semibold">Documentation</h3>
                            <div className="prose max-w-none">
                              <div className="whitespace-pre-wrap">
                                {material.documentation}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="comments" className="space-y-6">
                    {/* Add Comment */}
                    {userProfile && (
                      <Card className="p-4">
                        <div className="space-y-4">
                          <h3 className="font-semibold">Add a Comment</h3>
                          <Textarea
                            placeholder="Share your thoughts about this material..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            rows={3}
                          />
                          <Button
                            onClick={handleCommentSubmit}
                            disabled={!newComment.trim() || isSubmittingComment}
                          >
                            {isSubmittingComment ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Posting...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Post Comment
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    )}

                    {/* Comments List */}
                    <div className="space-y-4">
                      {comments.length > 0 ? (
                        comments.map((comment) => (
                          <Card key={comment.id} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-medium">
                                {comment.author.charAt(0)}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {comment.author}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {formatDate(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm">{comment.content}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <button className="flex items-center gap-1 hover:text-primary">
                                    <ThumbsUp className="h-3 w-3" />
                                    {comment.likes}
                                  </button>
                                  <button className="hover:text-primary">
                                    Reply
                                  </button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>
                            No comments yet. Be the first to share your
                            thoughts!
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="resources" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {material.fileUrl && (
                        <Card className="p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-primary" />
                            <div className="flex-1">
                              <h4 className="font-medium">Download Material</h4>
                              <p className="text-sm text-muted-foreground">
                                Additional resources and files
                              </p>
                            </div>
                            <Button size="sm" asChild>
                              <a href={material.fileUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </Card>
                      )}

                      {material.externalUrl && (
                        <Card className="p-4">
                          <div className="flex items-center gap-3">
                            <ExternalLink className="h-8 w-8 text-primary" />
                            <div className="flex-1">
                              <h4 className="font-medium">External Resource</h4>
                              <p className="text-sm text-muted-foreground">
                                Related external content
                              </p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={material.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <Card className="p-6">
              <div className="space-y-4">
                <Button className="w-full" size="lg">
                  <PlayCircle className="h-5 w-5 mr-2" />
                  Start Learning
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleBookmark}>
                    <Bookmark
                      className={`h-4 w-4 mr-2 ${
                        isBookmarked ? "fill-current" : ""
                      }`}
                    />
                    {isBookmarked ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Rate this material
                  </Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRating(star)}
                        className={`p-1 ${
                          star <= userRating
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                      >
                        <Star className="h-4 w-4 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Progress */}
            {progress > 0 && (
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Your Progress</h3>
                    <span className="text-sm text-muted-foreground">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <Button variant="outline" className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Continue Learning
                  </Button>
                </div>
              </Card>
            )}

            {/* Material Info */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Material Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{material.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{material.duration}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Views</span>
                    <span>{material.views?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(material.createdAt)}</span>
                  </div>
                  {material.estimatedHours && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Est. Hours</span>
                      <span>{material.estimatedHours}h</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Related Materials */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Related Materials</h3>
                <div className="space-y-3">
                  {/* This would be populated with related materials */}
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Related materials will appear here
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
