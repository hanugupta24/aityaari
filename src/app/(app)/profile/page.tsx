"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel as ShadcnFormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  XCircle,
  PlusCircle,
  Edit3,
  Trash2,
  Briefcase,
  Lightbulb,
  GraduationCap,
  Trophy,
  UserCircle2,
  UploadCloud,
  Save,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type {
  UserProfile,
  ExperienceItem,
  ProjectItem,
  EducationItem,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription as ShadcnDialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { v4 as uuidv4 } from "uuid";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

const LOCAL_STORAGE_RESUME_TEXT_KEY = "tyaariResumeProcessedText";
const LOCAL_STORAGE_RESUME_FILENAME_KEY = "tyaariResumeFileName";

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(50)
    .optional()
    .nullable(),
  email: z
    .string()
    .email({ message: "Please enter a valid email." })
    .optional()
    .nullable(),
  profileField: z
    .string()
    .min(1, { message: "Profile field is required." })
    .max(100),
  role: z.string().min(1, { message: "Target role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  accomplishments: z
    .string()
    .max(5000, {
      message: "Accomplishments should be less than 5000 characters.",
    })
    .optional()
    .nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf,.docx";
const MAX_FILE_SIZE_MB = 5;

export default function ProfilePage() {
  const {
    user,
    userProfile,
    loading: authLoading,
    initialLoading,
    refreshUserProfile,
  } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [clientSideResumeText, setClientSideResumeText] = useState<
    string | null
  >(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [keySkills, setKeySkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([]);

  const [modalType, setModalType] = useState<
    "experience" | "project" | "education" | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<
    ExperienceItem | ProjectItem | EducationItem | null
  >(null);
  const [currentItemData, setCurrentItemData] = useState<any>({});

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
  });

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof pdfjsLib.GlobalWorkerOptions !== "undefined"
    ) {
      try {
        const workerSrc = `${window.location.origin}/pdf.worker.mjs`;
        console.log(
          "ProfilePage: Attempting to set pdf.js workerSrc to:",
          workerSrc,
          ". CRITICAL: Ensure node_modules/pdfjs-dist/build/pdf.worker.mjs is copied to public/pdf.worker.mjs and server restarted."
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      } catch (e) {
        console.error(
          "ProfilePage: Error setting pdfjsLib.GlobalWorkerOptions.workerSrc. pdf.js might not be loaded or an unexpected error occurred.",
          e
        );
      }
    } else {
      console.warn(
        "ProfilePage: pdfjsLib or GlobalWorkerOptions not available on window, skipping workerSrc setup. This might happen during SSR or if pdf.js isn't loaded."
      );
    }
  }, []);

  useEffect(() => {
    if (!initialLoading && !authLoading) {
      const initialEmail = user?.email || "";
      const initialPhoneNumber =
        user?.phoneNumber || userProfile?.phoneNumber || "";

      if (user && userProfile) {
        form.reset({
          name: userProfile.name || user.displayName || "",
          email: initialEmail,
          profileField: userProfile.profileField || "",
          role: userProfile.role || "",
          company: userProfile.company || "",
          phoneNumber: initialPhoneNumber,
          accomplishments: userProfile.accomplishments || "",
        });
        setKeySkills(userProfile.keySkills || []);
        setExperiences(userProfile.experiences || []);
        setProjects(userProfile.projects || []);
        setEducationHistory(userProfile.educationHistory || []);

        if (userProfile.resumeRawText) {
          setClientSideResumeText(userProfile.resumeRawText);
          setSelectedFileName(
            userProfile.resumeFileName || "resume_from_db.txt"
          );
        } else {
          setClientSideResumeText(null);
          setSelectedFileName(null);
        }
      } else if (user && !userProfile) {
        form.reset({
          name: user.displayName || "",
          email: initialEmail,
          phoneNumber: initialPhoneNumber,
          profileField: "",
          role: "",
          company: "",
          accomplishments: "",
        });
        setKeySkills([]);
        setExperiences([]);
        setProjects([]);
        setEducationHistory([]);
        setClientSideResumeText(null);
        setSelectedFileName(null);
      } else if (!user) {
        form.reset();
        setKeySkills([]);
        setExperiences([]);
        setProjects([]);
        setEducationHistory([]);
        setClientSideResumeText(null);
        setSelectedFileName(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
          localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
        }
      }
      setIsFetchingProfile(false);
    }
  }, [
    user,
    userProfile,
    authLoading,
    initialLoading,
    form.reset,
    setKeySkills,
    setExperiences,
    setProjects,
    setEducationHistory,
    setClientSideResumeText,
    setSelectedFileName,
  ]);

  const handleAddSkill = () => {
    if (currentSkill.trim() && !keySkills.includes(currentSkill.trim())) {
      setKeySkills([...keySkills, currentSkill.trim()]);
      setCurrentSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setKeySkills(keySkills.filter((skill) => skill !== skillToRemove));
  };

  const openModal = (
    type: "experience" | "project" | "education",
    itemToEdit?: ExperienceItem | ProjectItem | EducationItem
  ) => {
    setModalType(type);
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setCurrentItemData(itemToEdit);
    } else {
      if (type === "experience")
        setCurrentItemData({
          id: uuidv4(),
          jobTitle: "",
          companyName: "",
          startDate: "",
          endDate: "",
          description: "",
        });
      else if (type === "project")
        setCurrentItemData({
          id: uuidv4(),
          title: "",
          description: "",
          technologiesUsed: [],
          projectUrl: "",
        });
      else if (type === "education")
        setCurrentItemData({
          id: uuidv4(),
          degree: "",
          institution: "",
          yearOfCompletion: "",
          details: "",
        });
    }
    setIsModalOpen(true);
  };

  const handleModalFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (
      (name === "startDate" || name === "endDate") &&
      e.target instanceof HTMLInputElement &&
      e.target.type === "month"
    ) {
      setCurrentItemData((prev: any) => ({
        ...prev,
        [name]: value ? value.substring(0, 7) : "",
      }));
    } else {
      setCurrentItemData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveItem = () => {
    if (!modalType) return;
    if (
      modalType === "experience" &&
      (!currentItemData.jobTitle ||
        !currentItemData.companyName ||
        !currentItemData.startDate)
    ) {
      toast({
        title: "Missing Fields",
        description: "Please fill in job title, company, and start date.",
        variant: "destructive",
      });
      return;
    }
    if (
      modalType === "project" &&
      (!currentItemData.title || !currentItemData.description)
    ) {
      toast({
        title: "Missing Fields",
        description: "Please fill in project title and description.",
        variant: "destructive",
      });
      return;
    }
    if (
      modalType === "education" &&
      (!currentItemData.degree ||
        !currentItemData.institution ||
        !currentItemData.yearOfCompletion)
    ) {
      toast({
        title: "Missing Fields",
        description:
          "Please fill in degree, institution, and year of completion.",
        variant: "destructive",
      });
      return;
    }

    if (editingItem) {
      if (modalType === "experience")
        setExperiences(
          experiences.map((exp) =>
            exp.id === editingItem.id
              ? ({ ...currentItemData, id: editingItem.id } as ExperienceItem)
              : exp
          )
        );
      else if (modalType === "project")
        setProjects(
          projects.map((proj) =>
            proj.id === editingItem.id
              ? ({ ...currentItemData, id: editingItem.id } as ProjectItem)
              : proj
          )
        );
      else if (modalType === "education")
        setEducationHistory(
          educationHistory.map((edu) =>
            edu.id === editingItem.id
              ? ({ ...currentItemData, id: editingItem.id } as EducationItem)
              : edu
          )
        );
      toast({
        title: "Item Updated",
        description:
          "Changes saved. Click 'Save All Profile Changes' at the bottom to make it permanent.",
      });
    } else {
      const newItemWithId = {
        ...currentItemData,
        id: currentItemData.id || uuidv4(),
      };
      if (modalType === "experience")
        setExperiences([...experiences, newItemWithId as ExperienceItem]);
      else if (modalType === "project")
        setProjects([...projects, newItemWithId as ProjectItem]);
      else if (modalType === "education")
        setEducationHistory([
          ...educationHistory,
          newItemWithId as EducationItem,
        ]);
      toast({
        title: "Item Added",
        description:
          "Item added. Click 'Save All Profile Changes' at the bottom to make it permanent.",
      });
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setCurrentItemData({});
  };

  const handleDeleteItem = (
    type: "experience" | "project" | "education",
    itemId: string
  ) => {
    if (type === "experience")
      setExperiences(experiences.filter((exp) => exp.id !== itemId));
    else if (type === "project")
      setProjects(projects.filter((proj) => proj.id !== itemId));
    else if (type === "education")
      setEducationHistory(educationHistory.filter((edu) => edu.id !== itemId));
    toast({
      title: "Item Removed",
      description:
        "Item removed locally. Save all profile changes to make it permanent.",
    });
  };

  const clearResumeDisplayAndStorage = (
    showToast = false,
    toastMessage?: string
  ) => {
    setSelectedFileName(null);
    setClientSideResumeText(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
      localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (showToast) {
      toast({
        title: "Resume Cleared",
        description:
          toastMessage || "Resume selection and extracted text removed.",
      });
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      setIsProcessingFile(false);
      return;
    }

    setSelectedFileName(file.name);
    setClientSideResumeText(null);
    setIsProcessingFile(true);
    toast({
      title: "Processing Resume",
      description: `Extracting text from ${file.name}...`,
    });

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Previous resume data (if any from DB) remains.`,
        variant: "destructive",
      });
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeRawText || null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsProcessingFile(false);
      return;
    }

    try {
      let rawText = "";
      const arrayBuffer = await file.arrayBuffer();

      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.mjs`;
          console.warn(
            "ProfilePage: pdf.js workerSrc was not set, attempting to set it now. Ensure public/pdf.worker.mjs exists."
          );
        }
        console.log(
          "ProfilePage: CLIENT_SIDE_PARSE - Attempting PDF processing. Worker path:",
          pdfjsLib.GlobalWorkerOptions.workerSrc
        );

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise.catch((pdfError) => {
          console.error(
            "ProfilePage: Error during pdfjsLib.getDocument().promise:",
            pdfError
          );
          const errorDetail =
            pdfError instanceof Error && pdfError.message
              ? pdfError.message
              : "Unknown PDF loading error.";
          if (
            errorDetail.includes("worker") ||
            errorDetail.includes("fetch dynamically imported module")
          ) {
            throw new Error(
              `PDF Worker Error: ${errorDetail}. Ensure 'public/pdf.worker.mjs' is copied from 'node_modules/pdfjs-dist/build/pdf.worker.mjs' and server restarted.`
            );
          }
          throw pdfError;
        });

        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          textContent += text.items.map((s: any) => s.str).join(" ") + "\\n";
        }
        rawText = textContent;
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value;
      } else if (
        file.name.toLowerCase().endsWith(".txt") ||
        file.name.toLowerCase().endsWith(".md")
      ) {
        rawText = new TextDecoder().decode(arrayBuffer);
      } else {
        toast({
          title: "Unsupported File Type",
          description: `Cannot extract text from ${file.name}. Supported: PDF, DOCX, TXT, MD. Previous resume data (if any from DB) remains.`,
          variant: "destructive",
        });
        setSelectedFileName(userProfile?.resumeFileName || null);
        setClientSideResumeText(userProfile?.resumeRawText || null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsProcessingFile(false);
        return;
      }

      setClientSideResumeText(rawText);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_RESUME_TEXT_KEY, rawText);
        localStorage.setItem(LOCAL_STORAGE_RESUME_FILENAME_KEY, file.name);
      }
      toast({
        title: "Resume Text Extracted",
        description: `Text from ${file.name} is ready to be saved with your profile.`,
      });
    } catch (error: any) {
      console.error("ProfilePage: Error processing file client-side:", error);
      const userMessage =
        error.message ||
        "Could not extract text from the resume. Previous resume data (if any from DB) remains.";
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeRawText || null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast({
        title: "Resume Processing Error",
        description: userMessage,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile.",
        variant: "destructive",
      });
      return;
    }
    if (!values.profileField || !values.role) {
      toast({
        title: "Missing Required Fields",
        description: "Profile Field and Target Role are mandatory.",
        variant: "destructive",
      });
      form.setError("profileField", {
        type: "manual",
        message: !values.profileField ? "Profile field is required." : "",
      });
      form.setError("role", {
        type: "manual",
        message: !values.role ? "Target role is required." : "",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: values.email || user.email || null,
        name: values.name || null,
        profileField: values.profileField,
        role: values.role,
        company: values.company || null,
        phoneNumber: values.phoneNumber || user.phoneNumber || null,
        keySkills: keySkills || [],
        experiences: experiences || [],
        projects: projects || [],
        educationHistory: educationHistory || [],
        accomplishments: values.accomplishments || null,

        resumeRawText: clientSideResumeText,
        resumeRawTextProvidedAndNotEmpty: !!clientSideResumeText,
        resumeFileName: selectedFileName,

        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
      };
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });

      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
        localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      refreshUserProfile();
    } catch (error: any) {
      const description = error.code
        ? `${error.message} (Code: ${error.code})`
        : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !isSubmitting && !authLoading && !isProcessingFile && !isFetchingProfile;
  const isEmailFromAuthProvider = !!user?.email;

  if (
    isFetchingProfile ||
    initialLoading ||
    (authLoading && !userProfile && !initialLoading)
  ) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse animation-delay-400"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse animation-delay-200"></div>
        </div>

        <div className="text-center space-y-6 z-10">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent rounded-full animate-ping border-t-primary/40 mx-auto"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Loading Profile
            </h2>
            <p className="text-muted-foreground">
              Setting up your personalized experience...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderModalContent = () => {
    if (!modalType) return null;
    switch (modalType) {
      case "experience":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="jobTitle"
                className="text-sm font-medium text-foreground"
              >
                Job Title*
              </Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                value={currentItemData.jobTitle || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="companyName"
                className="text-sm font-medium text-foreground"
              >
                Company Name*
              </Label>
              <Input
                id="companyName"
                name="companyName"
                value={currentItemData.companyName || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="startDate"
                  className="text-sm font-medium text-foreground"
                >
                  Start Date* (YYYY-MM)
                </Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="month"
                  value={currentItemData.startDate || ""}
                  onChange={handleModalFormChange}
                  className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="endDate"
                  className="text-sm font-medium text-foreground"
                >
                  End Date (YYYY-MM)
                </Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="month"
                  value={currentItemData.endDate || ""}
                  onChange={handleModalFormChange}
                  className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  placeholder="Leave blank if current"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-foreground"
              >
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={currentItemData.description || ""}
                onChange={handleModalFormChange}
                rows={4}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Responsibilities, achievements, key projects..."
              />
            </div>
          </div>
        );
      case "project":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="title"
                className="text-sm font-medium text-foreground"
              >
                Project Title*
              </Label>
              <Input
                id="title"
                name="title"
                value={currentItemData.title || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-foreground"
              >
                Description*
              </Label>
              <Textarea
                id="description"
                name="description"
                value={currentItemData.description || ""}
                onChange={handleModalFormChange}
                rows={4}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="What did you build? What problem did it solve?"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="technologiesUsed"
                className="text-sm font-medium text-foreground"
              >
                Technologies Used
              </Label>
              <Input
                id="technologiesUsed"
                name="technologiesUsed"
                value={
                  Array.isArray(currentItemData.technologiesUsed)
                    ? currentItemData.technologiesUsed.join(", ")
                    : currentItemData.technologiesUsed || ""
                }
                onChange={(e) =>
                  setCurrentItemData((prev: any) => ({
                    ...prev,
                    technologiesUsed: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                placeholder="React, Node.js, Python, etc. (comma-separated)"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="projectUrl"
                className="text-sm font-medium text-foreground"
              >
                Project URL (optional)
              </Label>
              <Input
                id="projectUrl"
                name="projectUrl"
                type="url"
                value={currentItemData.projectUrl || ""}
                onChange={handleModalFormChange}
                placeholder="https://example.com"
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        );
      case "education":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="degree"
                className="text-sm font-medium text-foreground"
              >
                Degree/Certificate*
              </Label>
              <Input
                id="degree"
                name="degree"
                value={currentItemData.degree || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                placeholder="Bachelor of Science, Master of Arts, etc."
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="institution"
                className="text-sm font-medium text-foreground"
              >
                Institution*
              </Label>
              <Input
                id="institution"
                name="institution"
                value={currentItemData.institution || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                placeholder="University name, college, etc."
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="yearOfCompletion"
                className="text-sm font-medium text-foreground"
              >
                Year of Completion (YYYY)*
              </Label>
              <Input
                id="yearOfCompletion"
                name="yearOfCompletion"
                type="text"
                maxLength={4}
                pattern="\d{4}"
                placeholder="2023"
                value={currentItemData.yearOfCompletion || ""}
                onChange={handleModalFormChange}
                className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="details"
                className="text-sm font-medium text-foreground"
              >
                Additional Details (optional)
              </Label>
              <Textarea
                id="details"
                name="details"
                value={currentItemData.details || ""}
                onChange={handleModalFormChange}
                rows={3}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="CGPA, honors, relevant coursework, etc."
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse animation-delay-600"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-primary/3 rounded-full blur-3xl animate-pulse animation-delay-400"></div>

        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-primary/20 rounded-full animate-pulse animation-delay-200"></div>
        <div className="absolute top-3/4 right-1/3 w-3 h-3 bg-accent/20 rounded-full animate-pulse animation-delay-400"></div>
        <div className="absolute bottom-1/4 left-1/4 w-1 h-1 bg-primary/30 rounded-full animate-pulse animation-delay-600"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto py-8 px-4 space-y-8 pb-32">
        {/* Header */}
        <div className="text-center space-y-6 animate-slideUpFadeIn">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-2xl border border-primary/20">
              <UserCircle2 className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-foreground tracking-tight">
              Profile Settings
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Customize your profile to get personalized interview experiences
              tailored to your career goals
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Details */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn animation-delay-200">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <UserCircle2 className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Personal Details
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Basic information about you. Profile Field and Target Role are
                  mandatory fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground">
                          Full Name
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Ada Lovelace"
                            {...field}
                            value={field.value ?? ""}
                            className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground">
                          {isEmailFromAuthProvider
                            ? "Email (Primary Login ID)"
                            : "Email"}
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              isEmailFromAuthProvider
                                ? "your-login-email@example.com"
                                : "you@example.com"
                            }
                            {...field}
                            value={field.value ?? ""}
                            readOnly={isEmailFromAuthProvider}
                            className={`h-12 transition-all duration-200 ${
                              isEmailFromAuthProvider
                                ? "bg-muted/50 cursor-not-allowed"
                                : "focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground">
                          Phone Number{" "}
                          {user?.phoneNumber
                            ? "(Primary Login ID)"
                            : "(Optional)"}
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., +15551234567"
                            {...field}
                            value={field.value ?? ""}
                            type="tel"
                            readOnly={!!user?.phoneNumber}
                            className={`h-12 transition-all duration-200 ${
                              !!user?.phoneNumber
                                ? "bg-muted/50 cursor-not-allowed"
                                : "focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground">
                          Current or Target Company (Optional)
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Google, Acme Corp"
                            {...field}
                            value={field.value ?? ""}
                            className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="profileField"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                          Profile Field / Industry
                          <span className="text-destructive text-lg">*</span>
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Software Engineering, Data Science"
                            {...field}
                            value={field.value ?? ""}
                            className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <ShadcnFormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                          Target Role
                          <span className="text-destructive text-lg">*</span>
                        </ShadcnFormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Senior Frontend Developer, Product Manager"
                            {...field}
                            value={field.value ?? ""}
                            className="h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Resume Upload */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn animation-delay-400">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-xl flex items-center justify-center shadow-lg">
                    <UploadCloud className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Upload Resume Text
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Upload a resume (PDF, DOCX, TXT, MD). Text will be extracted
                  client-side and saved to your profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Input
                      type="file"
                      ref={fileInputRef}
                      accept={ACCEPT_FILE_EXTENSIONS}
                      onChange={handleFileChange}
                      className="block w-full h-auto text-sm file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:transition-colors file:duration-200 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                      disabled={isProcessingFile || isSubmitting}
                    />
                  </FormControl>
                  {isProcessingFile && (
                    <div className="flex items-center gap-3 text-primary animate-fadeIn">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Processing...</span>
                    </div>
                  )}
                </div>

                {selectedFileName && (
                  <div className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-primary/20 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                          <FileText className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="overflow-hidden">
                          <p
                            className="font-semibold text-foreground truncate text-lg"
                            title={selectedFileName}
                          >
                            {selectedFileName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {clientSideResumeText
                              ? `${Math.round(
                                  clientSideResumeText.length / 1024
                                )} KB text extracted`
                              : isProcessingFile
                              ? "Processing..."
                              : "Text ready"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          clearResumeDisplayAndStorage(
                            true,
                            "Resume selection and extracted text cleared. Save profile to update in database."
                          )
                        }
                        title="Clear resume selection"
                        aria-label="Clear resume"
                        disabled={isSubmitting || isProcessingFile}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-10 w-10 transition-all duration-200"
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {clientSideResumeText && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-foreground">
                      Extracted Text Preview
                    </Label>
                    <Textarea
                      value={clientSideResumeText}
                      readOnly
                      rows={6}
                      className="text-xs bg-muted/30 font-mono transition-all duration-200 resize-none"
                      placeholder="Extracted resume text will appear here..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Skills */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn animation-delay-600">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <Lightbulb className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Key Skills
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Highlight your top professional skills and competencies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex gap-3 items-center">
                  <Input
                    placeholder="e.g., React, Python, Project Management"
                    value={currentSkill}
                    onChange={(e) => setCurrentSkill(e.target.value)}
                    className="flex-grow h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddSkill}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    aria-label="Add Skill"
                  >
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Add
                  </Button>
                </div>

                {keySkills.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-foreground">
                      Your Skills
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {keySkills.map((skill, index) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-sm py-2 px-4 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-300 animate-fadeIn hover:scale-105 cursor-default"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="ml-2 text-primary hover:text-destructive transition-colors duration-200"
                            aria-label={`Remove skill ${skill}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {keySkills.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lightbulb className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No skills added yet</p>
                    <p className="text-sm">
                      Add your first skill above to get started!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <Briefcase className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Work Experience
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Detail your professional journey and career milestones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {experiences.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Briefcase className="h-20 w-20 mx-auto mb-6 opacity-50" />
                    <p className="text-xl mb-3 font-semibold">
                      No work experience added yet
                    </p>
                    <p className="text-sm max-w-md mx-auto leading-relaxed">
                      Add your professional experience to showcase your career
                      journey and achievements
                    </p>
                  </div>
                )}

                {experiences.map((exp, index) => (
                  <Card
                    key={exp.id}
                    className="bg-gradient-to-r from-card to-primary/5 border border-primary/20 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fadeIn hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <CardTitle className="text-xl font-bold text-card-foreground">
                            {exp.jobTitle}
                          </CardTitle>
                          <CardDescription className="text-lg font-semibold text-primary">
                            {exp.companyName}
                          </CardDescription>
                          <CardDescription className="text-sm text-muted-foreground">
                            {exp.startDate || "N/A"} -{" "}
                            {exp.endDate || "Present"}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openModal("experience", exp)}
                            aria-label={`Edit experience ${exp.jobTitle}`}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteItem("experience", exp.id)
                            }
                            aria-label={`Delete experience ${exp.jobTitle}`}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {exp.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {exp.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-16 border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 group"
                  onClick={() => openModal("experience")}
                >
                  <PlusCircle className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-lg font-medium">
                    Add Work Experience
                  </span>
                </Button>
              </CardContent>
            </Card>

            {/* Projects */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Projects
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Showcase your personal and professional projects that
                  demonstrate your skills.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {projects.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Sparkles className="h-20 w-20 mx-auto mb-6 opacity-50" />
                    <p className="text-xl mb-3 font-semibold">
                      No projects added yet
                    </p>
                    <p className="text-sm max-w-md mx-auto leading-relaxed">
                      Showcase your creative work and technical projects to
                      highlight your capabilities
                    </p>
                  </div>
                )}

                {projects.map((proj, index) => (
                  <Card
                    key={proj.id}
                    className="bg-gradient-to-r from-card to-accent/5 border border-accent/20 hover:shadow-lg hover:border-accent/30 transition-all duration-300 animate-fadeIn hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-3">
                          <CardTitle className="text-xl font-bold text-card-foreground">
                            {proj.title}
                          </CardTitle>
                          {proj.projectUrl && (
                            <a
                              href={proj.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 hover:underline transition-colors duration-200 font-medium"
                            >
                              <span>View Project</span>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openModal("project", proj)}
                            aria-label={`Edit project ${proj.title}`}
                            className="text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all duration-200"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem("project", proj.id)}
                            aria-label={`Delete project ${proj.title}`}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {proj.description}
                      </p>
                      {proj.technologiesUsed &&
                        proj.technologiesUsed.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {proj.technologiesUsed.map((tech, techIndex) => (
                              <Badge
                                key={techIndex}
                                variant="outline"
                                className="text-xs bg-accent/10 text-accent border-accent/30 hover:bg-accent/20 transition-colors duration-200"
                              >
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                    </CardContent>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-16 border-2 border-dashed border-accent/30 hover:border-accent hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all duration-300 group"
                  onClick={() => openModal("project")}
                >
                  <PlusCircle className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-lg font-medium">Add Project</span>
                </Button>
              </CardContent>
            </Card>

            {/* Education */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <GraduationCap className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Education History
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  List your educational qualifications and academic
                  achievements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {educationHistory.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <GraduationCap className="h-20 w-20 mx-auto mb-6 opacity-50" />
                    <p className="text-xl mb-3 font-semibold">
                      No education history added yet
                    </p>
                    <p className="text-sm max-w-md mx-auto leading-relaxed">
                      Add your academic background and qualifications to
                      complete your profile
                    </p>
                  </div>
                )}

                {educationHistory.map((edu, index) => (
                  <Card
                    key={edu.id}
                    className="bg-gradient-to-r from-card to-primary/5 border border-primary/20 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fadeIn hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <CardTitle className="text-xl font-bold text-card-foreground">
                            {edu.degree}
                          </CardTitle>
                          <CardDescription className="text-lg font-semibold text-primary">
                            {edu.institution}
                          </CardDescription>
                          <CardDescription className="text-sm text-muted-foreground">
                            Completed: {edu.yearOfCompletion}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openModal("education", edu)}
                            aria-label={`Edit education ${edu.degree}`}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteItem("education", edu.id)
                            }
                            aria-label={`Delete education ${edu.degree}`}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {edu.details && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {edu.details}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-16 border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 group"
                  onClick={() => openModal("education")}
                >
                  <PlusCircle className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-lg font-medium">Add Education</span>
                </Button>
              </CardContent>
            </Card>

            {/* Accomplishments */}
            <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 animate-slideUpFadeIn">
              <CardHeader className="pb-6 border-b border-border/30">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-card-foreground">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                    <Trophy className="h-6 w-6 text-primary-foreground" />
                  </div>
                  Accomplishments
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Share your significant achievements, awards, or recognitions
                  that set you apart.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="accomplishments"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <ShadcnFormLabel className="text-sm font-semibold text-foreground">
                        Accomplishments
                      </ShadcnFormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 'Led a team to successfully launch Product X, resulting in 40% increase in user engagement...' or 'Published research paper on AI in top-tier conference...'"
                          {...field}
                          value={field.value ?? ""}
                          rows={8}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none hover:border-primary/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </form>
        </Form>

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-0 right-0 md:relative bg-background/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none p-6 border-t border-border/50 md:border-none md:p-0 z-50 shadow-2xl md:shadow-none">
          <div className="max-w-5xl mx-auto">
            <Button
              type="submit"
              disabled={!canSubmit}
              onClick={form.handleSubmit(onSubmit)}
              className="w-full md:w-auto bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground text-lg py-6 px-12 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                  Saving Profile...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Save className="h-6 w-6" />
                  Save All Profile Changes
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingItem(null);
            setCurrentItemData({});
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl">
          <DialogHeader className="space-y-4 pb-6 border-b border-border/30">
            <DialogTitle className="text-3xl font-bold text-card-foreground">
              {editingItem ? "Edit " : "Add New "}{" "}
              {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || "")}
            </DialogTitle>
            <ShadcnDialogDescription className="text-muted-foreground text-base leading-relaxed">
              Please fill in the details for your {modalType}. Click save when
              you're done. Fields marked with * are required.
            </ShadcnDialogDescription>
          </DialogHeader>
          <div className="py-6">{renderModalContent()}</div>
          <DialogFooter className="gap-4 pt-6 border-t border-border/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingItem(null);
                setCurrentItemData({});
              }}
              className="px-6 py-3 transition-all duration-200 hover:bg-muted/50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveItem}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Save{" "}
              {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || "")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
