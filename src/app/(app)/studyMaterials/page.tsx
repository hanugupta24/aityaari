"use client";

import { useState, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Search,
  Filter,
  Clock,
  Star,
  Users,
  TrendingUp,
  FileText,
  Video,
  Headphones,
  Code,
  Brain,
  Award,
  ChevronRight,
  Bookmark,
  Eye,
  Tag,
  Zap,
  ArrowRight,
  Sparkles,
  Library,
  BarChart3,
  Upload,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import type { StudyMaterial } from "@/types";
import { RoleBadge } from "../../../components/role-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const difficultyColors = {
  beginner: "bg-green-100 text-green-800 border-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  advanced: "bg-red-100 text-red-800 border-red-200",
};

const typeIcons = {
  video: Video,
  article: FileText,
  course: BookOpen,
  quiz: Brain,
  podcast: Headphones,
  code: Code,
};

export default function StudyMaterialsPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { canUploadStudyMaterials } = usePermissions();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All Levels");
  const [selectedType, setSelectedType] = useState("all");
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<StudyMaterial[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categories, setCategories] = useState<string[]>(["All Categories"]);
  const [bookmarkedMaterials, setBookmarkedMaterials] = useState<
    Record<string, boolean>
  >({});

  // Real-time listener for study materials
  useEffect(() => {
    setIsLoading(true);

    const materialsRef = collection(db, "study-materials");

    // Create query to get approved materials
    const materialsQuery = query(
      materialsRef,
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      materialsQuery,
      (snapshot) => {
        const materials: StudyMaterial[] = [];
        const uniqueCategories = new Set<string>(["All Categories"]);

        snapshot.forEach((doc) => {
          const material = { id: doc.id, ...doc.data() } as StudyMaterial;
          materials.push(material);

          // Collect unique categories
          if (material.category) {
            uniqueCategories.add(material.category);
          }

          // Initialize bookmarks
          if (material.isBookmarked) {
            setBookmarkedMaterials((prev) => ({
              ...prev,
              [material.id]: true,
            }));
          }
        });

        setStudyMaterials(materials);
        setFilteredMaterials(materials);
        setCategories(Array.from(uniqueCategories));
        setIsLoading(false);
        setIsRefreshing(false);

        // Show toast when new materials are added (after initial load)
        if (!isLoading && materials.length > studyMaterials.length) {
          toast({
            title: "New materials available!",
            description: `${
              materials.length - studyMaterials.length
            } new study materials have been added.`,
          });
        }
      },
      (error) => {
        console.error("Error fetching study materials:", error);
        toast({
          title: "Error",
          description: "Failed to load study materials. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        setIsRefreshing(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [toast]);

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
  }, [
    searchQuery,
    selectedCategory,
    selectedDifficulty,
    selectedType,
    studyMaterials,
  ]);

  const handleBookmark = async (id: string) => {
    try {
      const newBookmarkState = !bookmarkedMaterials[id];

      // Update local state immediately for better UX
      setBookmarkedMaterials((prev) => ({
        ...prev,
        [id]: newBookmarkState,
      }));

      setFilteredMaterials((prev) =>
        prev.map((material) =>
          material.id === id
            ? { ...material, isBookmarked: newBookmarkState }
            : material
        )
      );

      // Update in Firebase
      await updateDoc(doc(db, "study-materials", id), {
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

      // Revert local state on error
      setBookmarkedMaterials((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));

      setFilteredMaterials((prev) =>
        prev.map((material) =>
          material.id === id
            ? { ...material, isBookmarked: !material.isBookmarked }
            : material
        )
      );

      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewMaterial = async (material: StudyMaterial) => {
    try {
      // Increment view count
      const materialRef = doc(db, "study-materials", material.id);
      const materialSnap = await getDoc(materialRef);

      if (!materialSnap.exists()) {
        throw new Error("Material does not exist");
      }

      const materialData = materialSnap.data() as StudyMaterial;
      const hasViewed = userProfile?.uid
        ? materialData.viewedBy?.includes(userProfile.uid)
        : false;

      if (!hasViewed && userProfile?.uid) {
        await updateDoc(materialRef, {
          views: (materialData.views || 0) + 1,
          viewedBy: arrayUnion(userProfile.uid),
          updatedAt: new Date().toISOString(),
        });
      }

      // Navigate to material detail page
      router.push(`/studyMaterials/${material.id}`);
    } catch (error) {
      console.error("Error updating view count:", error);
      // Still navigate even if view count update fails
      router.push(`/studyMaterials/${material.id}`);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // The real-time listener will automatically update the data
    toast({
      title: "Refreshing",
      description: "Loading latest study materials...",
    });
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
    <div className="min-h-screen bg-background relative overflow-hidden max-w-full overflow-x-hidden">
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

      <div className="relative z-10 max-w-7xl mx-auto py-8 px-0 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-0 animate-slideUpFadeIn">
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

            <div className="flex items-center justify-center gap-4">
              {canUploadStudyMaterials && (
                <Button
                  onClick={() => router.push("/studyMaterials/upload")}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Material
                </Button>
              )}

              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={isRefreshing}
                className="border-primary/20 hover:bg-primary/10"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mx-auto mt-8">
              {[
                {
                  icon: BookOpen,
                  label: "Total Materials",
                  value: `${studyMaterials.length}`,
                },
                {
                  icon: Video,
                  label: "Videos",
                  value: `${
                    studyMaterials.filter((m) => m.type === "video").length
                  }`,
                },
                {
                  icon: FileText,
                  label: "Articles",
                  value: `${
                    studyMaterials.filter((m) => m.type === "article").length
                  }`,
                },
                {
                  icon: Brain,
                  label: "Courses",
                  value: `${
                    studyMaterials.filter((m) => m.type === "course").length
                  }`,
                },
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
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl animate-slideUpFadeIn animation-delay-200">
          <CardContent className="p-6">
            <div className="space-y-0">
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
              <div className="overflow-x-auto">
                <Tabs
                  value={selectedType}
                  onValueChange={setSelectedType}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 w-full bg-muted/50 overflow-x-auto">
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
              </div>

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
                    {["All Levels", "beginner", "intermediate", "advanced"].map(
                      (difficulty) => (
                        <option key={difficulty} value={difficulty}>
                          {difficulty === "All Levels"
                            ? difficulty
                            : difficulty.charAt(0).toUpperCase() +
                              difficulty.slice(1)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fadeIn animation-delay-400">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-5 w-5" />
            <span>Showing {filteredMaterials.length} results</span>
            {isRefreshing && (
              <div className="flex items-center gap-2 text-primary">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Updating...</span>
              </div>
            )}
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
        </div>

        {/* Study Materials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((material, index) => {
            const TypeIcon = typeIcons[material.type];
            return (
              <Card
                key={material.id}
                className="group bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card/90 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer animate-slideUpFadeIn"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => handleViewMaterial(material)}
              >
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={material.thumbnail || "/placeholder.svg"}
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

                  {/* Author Role Badge */}
                  {material.authorRole && (
                    <div className="absolute top-12 left-3">
                      <RoleBadge
                        role={material.authorRole}
                        className="text-xs"
                      />
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
                        bookmarkedMaterials[material.id] ? "fill-current" : ""
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
                        {material.rating || "New"}
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
                        {material.views?.toLocaleString() || 0}
                      </div>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewMaterial(material);
                        }}
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
        {filteredMaterials.length === 0 && (
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
        )}

        {/* Featured Section */}
        <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20 animate-slideUpFadeIn animation-delay-600">
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
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
                {[
                  {
                    title: "Full-Stack Developer",
                    description: "Complete journey from frontend to backend",
                    courses: studyMaterials.filter((m) =>
                      m.tags.some((tag) =>
                        [
                          "fullstack",
                          "frontend",
                          "backend",
                          "react",
                          "node",
                        ].includes(tag.toLowerCase())
                      )
                    ).length,
                    duration: "6 months",
                    icon: Code,
                  },
                  {
                    title: "System Design Master",
                    description: "Design scalable systems like a pro",
                    courses: studyMaterials.filter((m) =>
                      m.tags.some((tag) =>
                        [
                          "system",
                          "design",
                          "architecture",
                          "scalability",
                        ].includes(tag.toLowerCase())
                      )
                    ).length,
                    duration: "3 months",
                    icon: BarChart3,
                  },
                  {
                    title: "Career Growth Track",
                    description: "Leadership and soft skills development",
                    courses: studyMaterials.filter((m) =>
                      m.tags.some((tag) =>
                        [
                          "leadership",
                          "career",
                          "management",
                          "soft skills",
                        ].includes(tag.toLowerCase())
                      )
                    ).length,
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
                          <span>{path.courses} materials</span>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
