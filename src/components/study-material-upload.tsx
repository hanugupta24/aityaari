"use client";

import React, { useState, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { roleDisplayNames } from "@/lib/rbac/roles";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Loader2,
  Upload,
  FileText,
  Video,
  BookOpen,
  Brain,
  Headphones,
  Code,
  Plus,
  X,
  Link,
  Clock,
  Star,
  Users,
  PlayCircle,
  FileVideo,
  FileAudio,
  Image,
  Zap,
} from "lucide-react";
import type { StudyMaterial } from "@/types";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl?: string;
  resources?: string[];
}

export function StudyMaterialUpload() {
  const { userProfile } = useAuth();
  const { canUploadStudyMaterials, canApproveStudyMaterials } =
    usePermissions();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] =
    useState<StudyMaterial["type"]>("article");

  // Common fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] =
    useState<StudyMaterial["difficulty"]>("beginner");
  const [duration, setDuration] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // Type-specific fields
  const [content, setContent] = useState(""); // For articles
  const [videoUrl, setVideoUrl] = useState(""); // For videos
  const [externalUrl, setExternalUrl] = useState(""); // For external content
  const [prerequisites, setPrerequisites] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [instructor, setInstructor] = useState("");
  const [price, setPrice] = useState("");
  const [isPremium, setIsPremium] = useState(false);

  // Course-specific
  const [courseModules, setCourseModules] = useState<CourseModule[]>([]);

  // Quiz-specific
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [passingScore, setPassingScore] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");

  // Podcast-specific
  const [podcastUrl, setPodcastUrl] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [hostName, setHostName] = useState("");

  // Code-specific
  const [programmingLanguage, setProgrammingLanguage] = useState("");
  const [codeContent, setCodeContent] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveDemo, setLiveDemo] = useState("");

  const materialTypes = [
    {
      value: "article",
      label: "Article",
      icon: FileText,
      description: "Written content, tutorials, guides",
    },
    {
      value: "video",
      label: "Video",
      icon: Video,
      description: "Video tutorials, lectures, demos",
    },
    {
      value: "course",
      label: "Course",
      icon: BookOpen,
      description: "Multi-module structured learning",
    },
    {
      value: "quiz",
      label: "Quiz",
      icon: Brain,
      description: "Interactive assessments and tests",
    },
    {
      value: "podcast",
      label: "Podcast",
      icon: Headphones,
      description: "Audio content and discussions",
    },
    {
      value: "code",
      label: "Code",
      icon: Code,
      description: "Code examples, projects, snippets",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setThumbnailFile(e.target.files[0]);
    }
  };

  const addCourseModule = () => {
    const newModule: CourseModule = {
      id: Date.now().toString(),
      title: "",
      description: "",
      duration: "",
      videoUrl: "",
      resources: [],
    };
    setCourseModules([...courseModules, newModule]);
  };

  const updateCourseModule = (
    id: string,
    field: keyof CourseModule,
    value: string
  ) => {
    setCourseModules((modules) =>
      modules.map((module) =>
        module.id === id ? { ...module, [field]: value } : module
      )
    );
  };

  const removeCourseModule = (id: string) => {
    setCourseModules((modules) => modules.filter((module) => module.id !== id));
  };

  const addQuizQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: "",
    };
    setQuizQuestions([...quizQuestions, newQuestion]);
  };

  const updateQuizQuestion = (
    id: string,
    field: keyof QuizQuestion,
    value: any
  ) => {
    setQuizQuestions((questions) =>
      questions.map((question) =>
        question.id === id ? { ...question, [field]: value } : question
      )
    );
  };

  const updateQuizOption = (
    questionId: string,
    optionIndex: number,
    value: string
  ) => {
    setQuizQuestions((questions) =>
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((opt, idx) =>
                idx === optionIndex ? value : opt
              ),
            }
          : question
      )
    );
  };

  const removeQuizQuestion = (id: string) => {
    setQuizQuestions((questions) =>
      questions.filter((question) => question.id !== id)
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!userProfile) {
      toast({
        title: "Error",
        description: "You must be logged in to upload materials",
        variant: "destructive",
      });
      return;
    }

    if (!title || !description || !category || !difficulty || !duration) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Type-specific validation
    if (selectedType === "quiz" && quizQuestions.length === 0) {
      toast({
        title: "Missing quiz questions",
        description: "Please add at least one quiz question",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "course" && courseModules.length === 0) {
      toast({
        title: "Missing course modules",
        description: "Please add at least one course module",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      let fileUrl = "";
      let thumbnailUrl = "";

      // Upload main file if selected
      if (selectedFile) {
        const fileRef = ref(
          storage,
          `study-materials/${Date.now()}-${selectedFile.name}`
        );
        await uploadBytes(fileRef, selectedFile);
        fileUrl = await getDownloadURL(fileRef);
      }

      // Upload thumbnail if selected
      if (thumbnailFile) {
        const thumbnailRef = ref(
          storage,
          `thumbnails/${Date.now()}-${thumbnailFile.name}`
        );
        await uploadBytes(thumbnailRef, thumbnailFile);
        thumbnailUrl = await getDownloadURL(thumbnailRef);
      }

      // Prepare type-specific content
      let typeSpecificData: any = {};

      switch (selectedType) {
        case "article":
          typeSpecificData = {
            content,
            readingTime: estimatedHours,
          };
          break;
        case "video":
          typeSpecificData = {
            videoUrl: videoUrl || fileUrl,
            transcript: content,
          };
          break;
        case "course":
          typeSpecificData = {
            modules: courseModules,
            instructor,
            prerequisites: prerequisites
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            learningOutcomes: learningOutcomes
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean),
            estimatedHours: parseFloat(estimatedHours) || 0,
            price: parseFloat(price) || 0,
          };
          break;
        case "quiz":
          typeSpecificData = {
            questions: quizQuestions,
            passingScore: parseInt(passingScore),
            timeLimit: timeLimit ? parseInt(timeLimit) : null,
            totalQuestions: quizQuestions.length,
          };
          break;
        case "podcast":
          typeSpecificData = {
            audioUrl: podcastUrl || fileUrl,
            episodeNumber: episodeNumber ? parseInt(episodeNumber) : null,
            hostName,
            transcript: content,
          };
          break;
        case "code":
          typeSpecificData = {
            programmingLanguage,
            codeContent,
            githubUrl,
            liveDemo,
            documentation: content,
          };
          break;
      }

      // Create study material document
      const studyMaterial: Partial<StudyMaterial> = {
        title,
        description,
        type: selectedType,
        category,
        difficulty,
        duration,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        author: userProfile.name || userProfile.email,
        authorUid: userProfile.uid,
        authorRole: userProfile.roles?.[0],
        views: 0,
        rating: 0,
        isBookmarked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileUrl,
        externalUrl,
        isPremium,
        approved: canApproveStudyMaterials,
        thumbnail:
          thumbnailUrl ||
          "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400",
        ...typeSpecificData,
      };

      await addDoc(collection(db, "study-materials"), studyMaterial);

      toast({
        title: "Success!",
        description: canApproveStudyMaterials
          ? "Your study material has been uploaded and approved"
          : "Your study material has been uploaded and is pending approval",
      });

      // Reset form
      resetForm();
    } catch (error: any) {
      console.error("Error uploading study material:", error);
      toast({
        title: "Upload failed",
        description:
          error.message || "There was an error uploading your material",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setDifficulty("beginner");
    setDuration("");
    setTags("");
    setSelectedFile(null);
    setThumbnailFile(null);
    setContent("");
    setVideoUrl("");
    setExternalUrl("");
    setPrerequisites("");
    setLearningOutcomes("");
    setEstimatedHours("");
    setInstructor("");
    setPrice("");
    setIsPremium(false);
    setCourseModules([]);
    setQuizQuestions([]);
    setPassingScore("70");
    setTimeLimit("");
    setPodcastUrl("");
    setEpisodeNumber("");
    setHostName("");
    setProgrammingLanguage("");
    setCodeContent("");
    setGithubUrl("");
    setLiveDemo("");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  if (!canUploadStudyMaterials) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permission Denied</CardTitle>
          <CardDescription>
            You don't have permission to upload study materials.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentType = materialTypes.find((type) => type.value === selectedType);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3">
            <Upload className="h-8 w-8 text-primary" />
            Upload Study Material
          </CardTitle>
          <CardDescription className="text-lg">
            Share knowledge with the community. Create comprehensive learning
            materials.
            {userProfile?.roles && userProfile.roles.length > 0 && (
              <span className="block mt-2 text-primary font-medium">
                Uploading as: {roleDisplayNames[userProfile.roles[0]]}
                {canApproveStudyMaterials && " (Auto-approved)"}
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Material Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Choose Material Type</CardTitle>
            <CardDescription>
              Select the type of content you want to upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materialTypes.map((type) => (
                <Card
                  key={type.value}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedType === type.value
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() =>
                    setSelectedType(type.value as StudyMaterial["type"])
                  }
                >
                  <CardContent className="p-4 text-center">
                    <type.icon
                      className={`h-8 w-8 mx-auto mb-2 ${
                        selectedType === type.value
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <h3 className="font-semibold">{type.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              2. Basic Information
              {currentType && (
                <currentType.icon className="h-5 w-5 text-primary" />
              )}
            </CardTitle>
            <CardDescription>
              Provide essential details about your {selectedType}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder={`Enter ${selectedType} title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  placeholder="e.g., Frontend Development"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder={`Provide a detailed description of your ${selectedType}`}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty *</Label>
                <Select
                  value={difficulty}
                  onValueChange={(value: any) => setDifficulty(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration *</Label>
                <Input
                  id="duration"
                  placeholder="e.g., 30m, 2h 15m"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  placeholder="e.g., 2.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., React, JavaScript, Frontend"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalUrl">External URL (optional)</Label>
                <Input
                  id="externalUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPremium"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="isPremium">Mark as Premium Content</Label>
            </div>
          </CardContent>
        </Card>

        {/* Type-Specific Content */}
        <Card>
          <CardHeader>
            <CardTitle>3. {currentType?.label} Specific Content</CardTitle>
            <CardDescription>
              Configure content specific to {selectedType} type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedType} className="w-full">
              {/* Article Content */}
              <TabsContent value="article" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Article Content *</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your article content here (supports Markdown)"
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Video Content */}
              <TabsContent value="video" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">Video URL</Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transcript">
                    Video Transcript (optional)
                  </Label>
                  <Textarea
                    id="transcript"
                    placeholder="Provide video transcript for accessibility"
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Course Content */}
              <TabsContent value="course" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instructor">Instructor Name</Label>
                    <Input
                      id="instructor"
                      placeholder="Course instructor"
                      value={instructor}
                      onChange={(e) => setInstructor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (optional)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prerequisites">
                    Prerequisites (comma separated)
                  </Label>
                  <Input
                    id="prerequisites"
                    placeholder="e.g., Basic JavaScript, HTML/CSS"
                    value={prerequisites}
                    onChange={(e) => setPrerequisites(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="learningOutcomes">
                    Learning Outcomes (comma separated)
                  </Label>
                  <Textarea
                    id="learningOutcomes"
                    placeholder="What will students learn? e.g., Build React apps, Understand state management"
                    rows={3}
                    value={learningOutcomes}
                    onChange={(e) => setLearningOutcomes(e.target.value)}
                  />
                </div>

                {/* Course Modules */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Course Modules</Label>
                    <Button type="button" onClick={addCourseModule} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Module
                    </Button>
                  </div>

                  {courseModules.map((module, index) => (
                    <Card key={module.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Module {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCourseModule(module.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Module title"
                          value={module.title}
                          onChange={(e) =>
                            updateCourseModule(
                              module.id,
                              "title",
                              e.target.value
                            )
                          }
                        />
                        <Input
                          placeholder="Duration (e.g., 45m)"
                          value={module.duration}
                          onChange={(e) =>
                            updateCourseModule(
                              module.id,
                              "duration",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <Textarea
                        placeholder="Module description"
                        className="mt-3"
                        rows={2}
                        value={module.description}
                        onChange={(e) =>
                          updateCourseModule(
                            module.id,
                            "description",
                            e.target.value
                          )
                        }
                      />
                      <Input
                        placeholder="Video URL (optional)"
                        className="mt-3"
                        value={module.videoUrl}
                        onChange={(e) =>
                          updateCourseModule(
                            module.id,
                            "videoUrl",
                            e.target.value
                          )
                        }
                      />
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Quiz Content */}
              <TabsContent value="quiz" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="passingScore">Passing Score (%)</Label>
                    <Input
                      id="passingScore"
                      type="number"
                      min="0"
                      max="100"
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">
                      Time Limit (minutes, optional)
                    </Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      placeholder="e.g., 30"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quiz Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Quiz Questions</Label>
                    <Button type="button" onClick={addQuizQuestion} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  {quizQuestions.map((question, index) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Question {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuizQuestion(question.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <Textarea
                        placeholder="Enter your question"
                        value={question.question}
                        onChange={(e) =>
                          updateQuizQuestion(
                            question.id,
                            "question",
                            e.target.value
                          )
                        }
                        className="mb-3"
                      />

                      <div className="space-y-2 mb-3">
                        <Label>Answer Options</Label>
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() =>
                                updateQuizQuestion(
                                  question.id,
                                  "correctAnswer",
                                  optionIndex
                                )
                              }
                            />
                            <Input
                              placeholder={`Option ${optionIndex + 1}`}
                              value={option}
                              onChange={(e) =>
                                updateQuizOption(
                                  question.id,
                                  optionIndex,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <Textarea
                        placeholder="Explanation (optional)"
                        rows={2}
                        value={question.explanation}
                        onChange={(e) =>
                          updateQuizQuestion(
                            question.id,
                            "explanation",
                            e.target.value
                          )
                        }
                      />
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Podcast Content */}
              <TabsContent value="podcast" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="podcastUrl">Podcast Audio URL</Label>
                    <Input
                      id="podcastUrl"
                      type="url"
                      placeholder="https://example.com/podcast.mp3"
                      value={podcastUrl}
                      onChange={(e) => setPodcastUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episodeNumber">Episode Number</Label>
                    <Input
                      id="episodeNumber"
                      type="number"
                      placeholder="e.g., 42"
                      value={episodeNumber}
                      onChange={(e) => setEpisodeNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hostName">Host Name</Label>
                  <Input
                    id="hostName"
                    placeholder="Podcast host name"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="podcastTranscript">
                    Transcript (optional)
                  </Label>
                  <Textarea
                    id="podcastTranscript"
                    placeholder="Podcast transcript for accessibility"
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Code Content */}
              <TabsContent value="code" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="programmingLanguage">
                      Programming Language
                    </Label>
                    <Select
                      value={programmingLanguage}
                      onValueChange={setProgrammingLanguage}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="csharp">C#</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                        <SelectItem value="go">Go</SelectItem>
                        <SelectItem value="rust">Rust</SelectItem>
                        <SelectItem value="php">PHP</SelectItem>
                        <SelectItem value="ruby">Ruby</SelectItem>
                        <SelectItem value="swift">Swift</SelectItem>
                        <SelectItem value="kotlin">Kotlin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="githubUrl">GitHub Repository</Label>
                    <Input
                      id="githubUrl"
                      type="url"
                      placeholder="https://github.com/username/repo"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="liveDemo">Live Demo URL</Label>
                  <Input
                    id="liveDemo"
                    type="url"
                    placeholder="https://your-demo.com"
                    value={liveDemo}
                    onChange={(e) => setLiveDemo(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codeContent">Code Content</Label>
                  <Textarea
                    id="codeContent"
                    placeholder="Paste your code here..."
                    rows={12}
                    value={codeContent}
                    onChange={(e) => setCodeContent(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codeDocumentation">Documentation</Label>
                  <Textarea
                    id="codeDocumentation"
                    placeholder="Explain your code, how to use it, installation instructions, etc."
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* File Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>4. File Attachments</CardTitle>
            <CardDescription>
              Upload files and media for your {selectedType}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="file">Main File (optional)</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept={
                    selectedType === "video"
                      ? "video/*"
                      : selectedType === "podcast"
                      ? "audio/*"
                      : selectedType === "article"
                      ? ".pdf,.doc,.docx"
                      : "*/*"
                  }
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    {selectedFile.name}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Custom Thumbnail</Label>
                <Input
                  id="thumbnail"
                  type="file"
                  ref={thumbnailInputRef}
                  onChange={handleThumbnailChange}
                  accept="image/*"
                />
                {thumbnailFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Image className="h-4 w-4" />
                    {thumbnailFile.name}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Card>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset Form
            </Button>
            <Button
              type="submit"
              disabled={isUploading}
              className="min-w-[150px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {currentType?.label}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
