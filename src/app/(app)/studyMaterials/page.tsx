"use client";

import React, { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Search,
  Filter,
  Download,
  Play,
  Clock,
  Star,
  Users,
  TrendingUp,
  FileText,
  Video,
  Headphones,
  Code,
  Brain,
  Target,
  Award,
  ChevronRight,
  Bookmark,
  Share2,
  Eye,
  Calendar,
  Tag,
  Zap,
  Globe,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Library,
  PlusCircle,
  Heart,
  MessageSquare,
  BarChart3,
} from "lucide-react";

interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  type: "video" | "article" | "course" | "quiz" | "podcast" | "code";
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: string;
  rating: number;
  views: number;
  author: string;
  thumbnail: string;
  tags: string[];
  isBookmarked: boolean;
  progress?: number;
  isPremium?: boolean;
}

const studyMaterials: StudyMaterial[] = [
  {
    id: "1",
    title: "Complete React.js Fundamentals",
    description:
      "Master the fundamentals of React.js with hands-on projects and real-world examples. Learn components, hooks, state management, and more.",
    type: "course",
    category: "Frontend Development",
    difficulty: "beginner",
    duration: "8h 30m",
    rating: 4.8,
    views: 15420,
    author: "Sarah Chen",
    thumbnail:
      "https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["React", "JavaScript", "Frontend", "Components"],
    isBookmarked: true,
    progress: 65,
  },
  {
    id: "2",
    title: "Advanced Node.js Performance Optimization",
    description:
      "Deep dive into Node.js performance optimization techniques, memory management, and scalability patterns for production applications.",
    type: "video",
    category: "Backend Development",
    difficulty: "advanced",
    duration: "2h 15m",
    rating: 4.9,
    views: 8750,
    author: "Michael Rodriguez",
    thumbnail:
      "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["Node.js", "Performance", "Backend", "Optimization"],
    isBookmarked: false,
    isPremium: true,
  },
  {
    id: "3",
    title: "System Design Interview Preparation",
    description:
      "Comprehensive guide to system design interviews with real examples from FAANG companies. Learn scalability, databases, and architecture patterns.",
    type: "article",
    category: "System Design",
    difficulty: "intermediate",
    duration: "45m read",
    rating: 4.7,
    views: 23100,
    author: "Alex Thompson",
    thumbnail:
      "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["System Design", "Interview", "Architecture", "Scalability"],
    isBookmarked: true,
  },
  {
    id: "4",
    title: "Machine Learning Algorithms Quiz",
    description:
      "Test your knowledge of machine learning algorithms with this comprehensive quiz covering supervised, unsupervised, and reinforcement learning.",
    type: "quiz",
    category: "Machine Learning",
    difficulty: "intermediate",
    duration: "30m",
    rating: 4.6,
    views: 12300,
    author: "Dr. Emily Watson",
    thumbnail:
      "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["ML", "Algorithms", "Quiz", "AI"],
    isBookmarked: false,
  },
  {
    id: "5",
    title: "Tech Career Growth Podcast",
    description:
      "Weekly discussions with industry leaders about career growth, technical skills, and navigating the tech industry landscape.",
    type: "podcast",
    category: "Career Development",
    difficulty: "beginner",
    duration: "45m",
    rating: 4.5,
    views: 18900,
    author: "Tech Leaders Network",
    thumbnail:
      "https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["Career", "Podcast", "Leadership", "Growth"],
    isBookmarked: true,
  },
  {
    id: "6",
    title: "Python Data Structures Implementation",
    description:
      "Hands-on coding exercises for implementing common data structures in Python. Includes arrays, linked lists, trees, and graphs.",
    type: "code",
    category: "Data Structures",
    difficulty: "intermediate",
    duration: "3h 20m",
    rating: 4.8,
    views: 9800,
    author: "CodeMaster Pro",
    thumbnail:
      "https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg?auto=compress&cs=tinysrgb&w=400",
    tags: ["Python", "Data Structures", "Coding", "Algorithms"],
    isBookmarked: false,
  },
];

const categories = [
  "All Categories",
  "Frontend Development",
  "Backend Development",
  "System Design",
  "Machine Learning",
  "Career Development",
  "Data Structures",
];

const difficulties = ["All Levels", "beginner", "intermediate", "advanced"];

const typeIcons = {
  video: Video,
  article: FileText,
  course: BookOpen,
  quiz: Brain,
  podcast: Headphones,
  code: Code,
};

const difficultyColors = {
  beginner: "bg-green-100 text-green-800 border-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  advanced: "bg-red-100 text-red-800 border-red-200",
};

export default function StudyMaterialsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All Levels");
  const [selectedType, setSelectedType] = useState("all");
  const [filteredMaterials, setFilteredMaterials] = useState(studyMaterials);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let filtered = studyMaterials;

    if (searchQuery) {
      filtered = filtered.filter(
        (material) =>
          material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          material.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          material.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    if (selectedCategory !== "All Categories") {
      filtered = filtered.filter(
        (material) => material.category === selectedCategory
      );
    }

    if (selectedDifficulty !== "All Levels") {
      filtered = filtered.filter(
        (material) => material.difficulty === selectedDifficulty
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((material) => material.type === selectedType);
    }

    setFilteredMaterials(filtered);
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedType]);

  const handleBookmark = (id: string) => {
    setFilteredMaterials((prev) =>
      prev.map((material) =>
        material.id === id
          ? { ...material, isBookmarked: !material.isBookmarked }
          : material
      )
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-primary/40 mx-auto"></div>
          </div>
          <p className="text-muted-foreground font-medium">
            Loading study materials...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse animation-delay-500"></div>

        {/* Floating particles */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-primary/20 rounded-full animate-bounce animation-delay-200"></div>
        <div className="absolute top-40 right-32 w-3 h-3 bg-accent/20 rounded-full animate-bounce animation-delay-400"></div>
        <div className="absolute bottom-32 left-1/4 w-2 h-2 bg-primary/30 rounded-full animate-bounce animation-delay-600"></div>
        <div className="absolute bottom-20 right-20 w-4 h-4 bg-accent/15 rounded-full animate-bounce animation-delay-800"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto py-8 px-4 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-6 animate-slideUpFadeIn">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <Library className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
              Study Materials
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Discover curated learning resources to accelerate your tech
              career. From beginner tutorials to advanced system design.
            </p>
          </div>

          {/* Stats Cards */}
          {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-8">
            {[
              { icon: BookOpen, label: "Courses", value: "150+" },
              { icon: Users, label: "Students", value: "50K+" },
              { icon: Award, label: "Certificates", value: "25+" },
              { icon: Star, label: "Rating", value: "4.8" },
            ].map((stat, index) => (
              <Card
                key={stat.label}
                className="bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/70 transition-all duration-300 animate-slideUpFadeIn"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-4 text-center">
                  <stat.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div> */}
        </div>

        <div className="text-3xl flex justify-center items-center h-screen text-justify">
          Coming soon...
        </div>

        {/* Search and Filters */}
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl animate-slideUpFadeIn animation-delay-200 hidden h-0">
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search courses, articles, tutorials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>

              {/* Filter Tabs */}
              <Tabs
                value={selectedType}
                onValueChange={setSelectedType}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-7 bg-muted/50">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="course"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    Courses
                  </TabsTrigger>
                  <TabsTrigger
                    value="video"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Video className="h-4 w-4 mr-1" />
                    Videos
                  </TabsTrigger>
                  <TabsTrigger
                    value="article"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Articles
                  </TabsTrigger>
                  <TabsTrigger
                    value="quiz"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Quizzes
                  </TabsTrigger>
                  <TabsTrigger
                    value="podcast"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Headphones className="h-4 w-4 mr-1" />
                    Podcasts
                  </TabsTrigger>
                  <TabsTrigger
                    value="code"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Code
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Category and Difficulty Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-12 px-4 bg-background border border-border rounded-md focus:border-primary/50 focus:ring-primary/20 text-foreground"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Difficulty
                  </label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full h-12 px-4 bg-background border border-border rounded-md focus:border-primary/50 focus:ring-primary/20 text-foreground"
                  >
                    {difficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty === "All Levels"
                          ? difficulty
                          : difficulty.charAt(0).toUpperCase() +
                            difficulty.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        {/* <div className="flex items-center justify-between animate-fadeIn animation-delay-400">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-5 w-5" />
            <span>Showing {filteredMaterials.length} results</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 hover:bg-primary/10"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Sort by Popular
            </Button>
          </div>
        </div> */}

        {/* Study Materials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 hidden">
          {filteredMaterials.map((material, index) => {
            const TypeIcon = typeIcons[material.type];
            return (
              <Card
                key={material.id}
                className="group bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card/90 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer animate-slideUpFadeIn"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={material.thumbnail}
                    alt={material.title}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Type Badge */}
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary/90 text-primary-foreground border-0">
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {material.type.charAt(0).toUpperCase() +
                        material.type.slice(1)}
                    </Badge>
                  </div>

                  {/* Premium Badge */}
                  {material.isPremium && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-accent/90 text-accent-foreground border-0">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    </div>
                  )}

                  {/* Bookmark Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-3 right-3 bg-black/20 hover:bg-black/40 text-white border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookmark(material.id);
                    }}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${
                        material.isBookmarked ? "fill-current" : ""
                      }`}
                    />
                  </Button>

                  {/* Duration */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 text-white text-sm">
                    <Clock className="h-3 w-3" />
                    {material.duration}
                  </div>
                </div>

                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={difficultyColors[material.difficulty]}
                      >
                        {material.difficulty.charAt(0).toUpperCase() +
                          material.difficulty.slice(1)}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {material.rating}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2">
                      {material.title}
                    </h3>

                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {material.description}
                    </p>
                  </div>

                  {/* Progress Bar (if exists) */}
                  {material.progress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-primary font-medium">
                          {material.progress}%
                        </span>
                      </div>
                      <Progress value={material.progress} className="h-2" />
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {material.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {material.tags.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-muted/50 text-muted-foreground"
                      >
                        +{material.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {material.author.charAt(0)}
                        </span>
                      </div>
                      <span>{material.author}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {material.views.toLocaleString()}
                      </div>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Start Learning
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {/* {filteredMaterials.length === 0 && (
          <div className="text-center py-16 animate-fadeIn">
            <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">
              No materials found
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Try adjusting your search criteria or browse our featured content
              below.
            </p>
            <Button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All Categories");
                setSelectedDifficulty("All Levels");
                setSelectedType("all");
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Zap className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        )} */}

        {/* Featured Section */}
        {/* <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20 animate-slideUpFadeIn animation-delay-600">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              Featured Learning Paths
            </CardTitle>
            <CardDescription className="text-base">
              Curated learning journeys designed by industry experts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Full-Stack Developer",
                  description: "Complete journey from frontend to backend",
                  courses: 12,
                  duration: "6 months",
                  icon: Code,
                },
                {
                  title: "System Design Master",
                  description: "Design scalable systems like a pro",
                  courses: 8,
                  duration: "3 months",
                  icon: BarChart3,
                },
                {
                  title: "Career Growth Track",
                  description: "Leadership and soft skills development",
                  courses: 6,
                  duration: "2 months",
                  icon: TrendingUp,
                },
              ].map((path, index) => (
                <Card
                  key={path.title}
                  className="bg-card/50 border-border/50 hover:bg-card/70 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors duration-300">
                      <path.icon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {path.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {path.description}
                      </p>
                      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                        <span>{path.courses} courses</span>
                        <span>•</span>
                        <span>{path.duration}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-primary/20 hover:bg-primary/10 hover:border-primary/40"
                    >
                      Start Path
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
