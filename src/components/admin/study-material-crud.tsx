import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDate, truncateText } from "../../lib/utils";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  Upload,
  FileText,
  Video,
  Code,
  Headphones,
  GraduationCap,
  HelpCircle,
  ExternalLink,
  Calendar,
  User,
  Star,
  Clock,
  Tag,
  Globe,
  Github,
  Play,
  Download,
  MessageSquare,
  ThumbsUp,
  Bookmark,
  Share2,
} from "lucide-react";
import type { StudyMaterial, MaterialFilters } from "../../types";
import { RoleBadge } from "../role-badge";

interface StudyMaterialsCRUDProps {
  materials: StudyMaterial[];
  onCreateMaterial: (material: Omit<StudyMaterial, "id">) => Promise<void>;
  onUpdateMaterial: (
    id: string,
    updates: Partial<StudyMaterial>
  ) => Promise<void>;
  onDeleteMaterial: (id: string) => Promise<void>;
  onApproveMaterial: (id: string) => Promise<void>;
  loading?: boolean;
}

const materialTypes = [
  { value: "article", label: "Article", icon: FileText },
  { value: "video", label: "Video", icon: Video },
  { value: "course", label: "Course", icon: GraduationCap },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
  { value: "podcast", label: "Podcast", icon: Headphones },
  { value: "code", label: "Code", icon: Code },
];

const difficultyLevels = [
  {
    value: "beginner",
    label: "Beginner",
    color: "bg-green-100 text-green-800",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    color: "bg-yellow-100 text-yellow-800",
  },
  { value: "advanced", label: "Advanced", color: "bg-red-100 text-red-800" },
];

export function StudyMaterialsCRUD({
  materials,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onApproveMaterial,
  loading = false,
}: StudyMaterialsCRUDProps) {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("list");
  const [filters, setFilters] = useState<MaterialFilters>({
    title: "",
    type: "all",
    approved: "all",
  });
  const [editingMaterial, setEditingMaterial] = useState<StudyMaterial | null>(
    null
  );
  const [viewingMaterial, setViewingMaterial] = useState<StudyMaterial | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "article" as StudyMaterial["type"],
    category: "",
    difficulty: "beginner" as StudyMaterial["difficulty"],
    duration: "",
    tags: "",
    content: "",
    thumbnail: "",
  });

  const filteredMaterials = materials.filter((material) => {
    const matchesTitle = material.title
      .toLowerCase()
      .includes(filters.title?.toLowerCase() || "");
    const matchesType =
      filters.type === "all" || material.type === filters.type;
    const matchesApproval =
      filters.approved === "all" ||
      (filters.approved === "approved" && material.approved) ||
      (filters.approved === "pending" && !material.approved);

    return matchesTitle && matchesType && matchesApproval;
  });

  const handleCreateMaterial = async () => {
    if (!formData.title || !formData.description) return;

    setIsSubmitting(true);
    try {
      const newMaterial: Omit<StudyMaterial, "id"> = {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        author: "Current User", // In real app, get from auth context
        authorUid: "current-user-uid",
        views: 0,
        rating: 0,
        isBookmarked: false,
        approved: hasPermission("APPROVE_STUDY_MATERIALS"), // Auto-approve if user has permission
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnail:
          formData.thumbnail ||
          "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400",
      };

      await onCreateMaterial(newMaterial);

      // Reset form
      setFormData({
        title: "",
        description: "",
        type: "article",
        category: "",
        difficulty: "beginner",
        duration: "",
        tags: "",
        content: "",
        thumbnail: "",
      });

      setActiveTab("list");
    } catch (error) {
      console.error("Error creating material:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!editingMaterial) return;

    setIsSubmitting(true);
    try {
      const updates = {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        updatedAt: new Date().toISOString(),
      };

      await onUpdateMaterial(editingMaterial.id, updates);
      setEditingMaterial(null);
      setActiveTab("list");
    } catch (error) {
      console.error("Error updating material:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMaterial = (material: StudyMaterial) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      description: material.description,
      type: material.type,
      category: material.category,
      difficulty: material.difficulty,
      duration: material.duration,
      tags: material.tags.join(", "),
      content: material.content || "",
      thumbnail: material.thumbnail,
    });
    setActiveTab("edit");
  };

  const handleViewMaterial = (material: StudyMaterial) => {
    setViewingMaterial(material);
    setActiveTab("view");
  };

  const getTypeIcon = (type: StudyMaterial["type"]) => {
    const typeData = materialTypes.find((t) => t.value === type);
    return typeData ? typeData.icon : FileText;
  };

  const getDifficultyColor = (difficulty: StudyMaterial["difficulty"]) => {
    const difficultyData = difficultyLevels.find((d) => d.value === difficulty);
    return difficultyData ? difficultyData.color : "bg-gray-100 text-gray-800";
  };

  if (!hasPermission("UPLOAD_STUDY_MATERIALS")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            You don't have permission to manage study materials.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Study Materials Management
              </CardTitle>
              <CardDescription>
                Create, edit, and manage study materials with full CRUD
                operations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {materials.length} Total Materials
              </Badge>
              <Badge variant="outline">
                {materials.filter((m) => !m.approved).length} Pending Approval
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="list">Material List</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="edit" disabled={!editingMaterial}>
                {editingMaterial ? "Edit Material" : "Edit (Select Item)"}
              </TabsTrigger>
              <TabsTrigger value="view" disabled={!viewingMaterial}>
                {viewingMaterial ? "View Details" : "View (Select Item)"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search materials..."
                    value={filters.title}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filters.type || "all"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, type: value as any }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {materialTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.approved || "all"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, approved: value as any }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Materials Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => {
                      const TypeIcon = getTypeIcon(material.type);
                      return (
                        <TableRow key={material.id}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <img
                                src={material.thumbnail}
                                alt={material.title}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div>
                                <div className="font-medium">
                                  {material.title}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {truncateText(material.description, 100)}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={getDifficultyColor(
                                      material.difficulty
                                    )}
                                  >
                                    {
                                      difficultyLevels.find(
                                        (d) => d.value === material.difficulty
                                      )?.label
                                    }
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {material.duration}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="h-4 w-4" />
                              <span className="capitalize">
                                {material.type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{material.author}</div>
                              <div className="text-gray-500">
                                {material.category}
                              </div>
                              {material.authorRole && (
                                <RoleBadge
                                  role={material.authorRole}
                                  className="mt-1 text-xs"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                material.approved ? "default" : "outline"
                              }
                            >
                              {material.approved ? "Approved" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(material.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewMaterial(material)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission("EDIT_STUDY_MATERIALS") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditMaterial(material)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission("APPROVE_STUDY_MATERIALS") &&
                                !material.approved && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      onApproveMaterial(material.id)
                                    }
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                              {hasPermission("DELETE_STUDY_MATERIALS") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteMaterial(material.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {filteredMaterials.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No materials found matching your criteria.
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Enter material title"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe the material"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: any) =>
                          setFormData((prev) => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {materialTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="difficulty">Difficulty *</Label>
                      <Select
                        value={formData.difficulty}
                        onValueChange={(value: any) =>
                          setFormData((prev) => ({
                            ...prev,
                            difficulty: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {difficultyLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        placeholder="e.g., Frontend Development"
                      />
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration *</Label>
                      <Input
                        id="duration"
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            duration: e.target.value,
                          }))
                        }
                        placeholder="e.g., 30 minutes"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tags: e.target.value,
                        }))
                      }
                      placeholder="e.g., React, JavaScript, Tutorial"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="thumbnail">Thumbnail URL</Label>
                    <Input
                      id="thumbnail"
                      value={formData.thumbnail}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          thumbnail: e.target.value,
                        }))
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Rich content, markdown, or HTML"
                      rows={8}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setFormData({
                          title: "",
                          description: "",
                          type: "article",
                          category: "",
                          difficulty: "beginner",
                          duration: "",
                          tags: "",
                          content: "",
                          thumbnail: "",
                        })
                      }
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={handleCreateMaterial}
                      disabled={
                        isSubmitting || !formData.title || !formData.description
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Material
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="edit" className="space-y-4">
              {editingMaterial ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-title">Title *</Label>
                      <Input
                        id="edit-title"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Enter material title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-description">Description *</Label>
                      <Textarea
                        id="edit-description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Describe the material"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-type">Type *</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: any) =>
                            setFormData((prev) => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {materialTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-difficulty">Difficulty *</Label>
                        <Select
                          value={formData.difficulty}
                          onValueChange={(value: any) =>
                            setFormData((prev) => ({
                              ...prev,
                              difficulty: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {difficultyLevels.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-category">Category *</Label>
                        <Input
                          id="edit-category"
                          value={formData.category}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                          placeholder="e.g., Frontend Development"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-duration">Duration *</Label>
                        <Input
                          id="edit-duration"
                          value={formData.duration}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              duration: e.target.value,
                            }))
                          }
                          placeholder="e.g., 30 minutes"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                      <Input
                        id="edit-tags"
                        value={formData.tags}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            tags: e.target.value,
                          }))
                        }
                        placeholder="e.g., React, JavaScript, Tutorial"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-thumbnail">Thumbnail URL</Label>
                      <Input
                        id="edit-thumbnail"
                        value={formData.thumbnail}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            thumbnail: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-content">Content</Label>
                      <Textarea
                        id="edit-content"
                        value={formData.content}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            content: e.target.value,
                          }))
                        }
                        placeholder="Rich content, markdown, or HTML"
                        rows={8}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingMaterial(null);
                          setActiveTab("list");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateMaterial}
                        disabled={
                          isSubmitting ||
                          !formData.title ||
                          !formData.description
                        }
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Update Material
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a material from the list to edit it.
                </div>
              )}
            </TabsContent>

            <TabsContent value="view" className="space-y-6">
              {viewingMaterial ? (
                <div className="space-y-6">
                  {/* Header */}
                  <Card>
                    <div className="relative">
                      <img
                        src={viewingMaterial.thumbnail}
                        alt={viewingMaterial.title}
                        className="w-full h-64 object-cover rounded-t-lg"
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <Badge
                          variant={
                            viewingMaterial.approved ? "default" : "outline"
                          }
                        >
                          {viewingMaterial.approved ? "Approved" : "Pending"}
                        </Badge>
                        {viewingMaterial.isPremium && (
                          <Badge className="bg-accent/90 text-accent-foreground">
                            Premium
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {React.createElement(
                              getTypeIcon(viewingMaterial.type),
                              { className: "h-5 w-5 text-primary" }
                            )}
                            <Badge variant="secondary" className="capitalize">
                              {viewingMaterial.type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={getDifficultyColor(
                                viewingMaterial.difficulty
                              )}
                            >
                              {viewingMaterial.difficulty}
                            </Badge>
                          </div>
                          <CardTitle className="text-2xl">
                            {viewingMaterial.title}
                          </CardTitle>
                          <CardDescription className="text-base">
                            {viewingMaterial.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon">
                            <Bookmark className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {viewingMaterial.views?.toLocaleString() || 0} views
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {viewingMaterial.duration}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {viewingMaterial.rating?.toFixed(1) || "New"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(viewingMaterial.createdAt)}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {viewingMaterial.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Author Info */}
                  <Card className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {viewingMaterial.author}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Content Creator
                        </p>
                        {viewingMaterial.authorRole && (
                          <RoleBadge
                            role={viewingMaterial.authorRole}
                            className="mt-1"
                          />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Category: {viewingMaterial.category}</div>
                        <div>
                          Created: {formatDate(viewingMaterial.createdAt)}
                        </div>
                        {viewingMaterial.updatedAt !==
                          viewingMaterial.createdAt && (
                          <div>
                            Updated: {formatDate(viewingMaterial.updatedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Content Preview */}
                  {viewingMaterial.content && (
                    <Card className="p-6">
                      <h3 className="font-semibold mb-4">Content Preview</h3>
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap text-sm">
                          {truncateText(viewingMaterial.content, 500)}
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* External Links */}
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Resources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingMaterial.fileUrl && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Download className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <div className="font-medium">Download File</div>
                            <div className="text-sm text-muted-foreground">
                              Additional resources
                            </div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={viewingMaterial.fileUrl} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}

                      {viewingMaterial.externalUrl && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <ExternalLink className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <div className="font-medium">External Link</div>
                            <div className="text-sm text-muted-foreground">
                              Related content
                            </div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={viewingMaterial.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}

                      {viewingMaterial.githubUrl && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Github className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <div className="font-medium">GitHub Repository</div>
                            <div className="text-sm text-muted-foreground">
                              Source code
                            </div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={viewingMaterial.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Github className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}

                      {viewingMaterial.liveDemo && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Globe className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <div className="font-medium">Live Demo</div>
                            <div className="text-sm text-muted-foreground">
                              Working example
                            </div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={viewingMaterial.liveDemo}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Globe className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Actions */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Admin Actions</h3>
                      <div className="flex items-center gap-2">
                        {hasPermission("EDIT_STUDY_MATERIALS") && (
                          <Button
                            variant="outline"
                            onClick={() => handleEditMaterial(viewingMaterial)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Material
                          </Button>
                        )}
                        {hasPermission("APPROVE_STUDY_MATERIALS") &&
                          !viewingMaterial.approved && (
                            <Button
                              onClick={() =>
                                onApproveMaterial(viewingMaterial.id)
                              }
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                          )}
                        {hasPermission("DELETE_STUDY_MATERIALS") && (
                          <Button
                            variant="destructive"
                            onClick={() => onDeleteMaterial(viewingMaterial.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a material from the list to view its details.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
