
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  // FormLabel, // This is for the main form
  FormMessage,
} from "@/components/ui/form";
import { Label as ShadcnLabel } from "@/components/ui/label"; // Use this basic Label for modals
import { FormLabel as ShadcnFormLabel } from "@/components/ui/form"; // Use this for main form labels

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, UploadCloud, XCircle, DownloadCloud, PlusCircle, Edit3, Trash2, Briefcase, Lightbulb, GraduationCap, Trophy, UserCircle2 } from "lucide-react";
import type { UserProfile, ExperienceItem, ProjectItem, EducationItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';

// Zod schema for the main form fields
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50).optional().nullable(),
  email: z.string().email({ message: "Please enter a valid email." }).optional().nullable(),
  profileField: z.string().min(1, { message: "Profile field is required." }).max(100), // Mandatory
  role: z.string().min(1, { message: "Target role is required." }).max(100), // Mandatory
  company: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  accomplishments: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ACCEPTED_MIME_TYPES = ['text/plain', 'text/markdown', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf,.doc,.docx";
const MAX_FILE_SIZE_MB = 5;

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  // State for resume handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null); 
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for array-based profile sections
  const [keySkills, setKeySkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([]);
  
  // State for managing modals and editing items
  const [modalType, setModalType] = useState<"experience" | "project" | "education" | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExperienceItem | ProjectItem | EducationItem | null>(null);
  const [currentItemData, setCurrentItemData] = useState<any>({}); 


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "", email: "", profileField: "", role: "", company: "", phoneNumber: "", accomplishments: ""
    },
  });

  useEffect(() => {
    if (!initialLoading && !authLoading && user) {
      const initialEmail = user.email || "";
      const initialPhoneNumber = user.phoneNumber || userProfile?.phoneNumber || "";

      if (userProfile) {
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
        
        setSelectedFileName(userProfile.resumeFileName || null);
        setClientSideResumeText(userProfile.resumeProcessedText || null);
      } else {
        form.reset({ 
            name: user.displayName || "", 
            email: initialEmail, 
            phoneNumber: initialPhoneNumber, 
            profileField: "", 
            role: "", 
            company: "", 
            accomplishments:"" 
        });
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleAddSkill = () => {
    if (currentSkill.trim() && !keySkills.includes(currentSkill.trim())) {
      setKeySkills([...keySkills, currentSkill.trim()]);
      setCurrentSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setKeySkills(keySkills.filter(skill => skill !== skillToRemove));
  };

  const openModal = (type: "experience" | "project" | "education", itemToEdit?: ExperienceItem | ProjectItem | EducationItem) => {
    setModalType(type);
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setCurrentItemData(itemToEdit);
    } else {
      setEditingItem(null);
      if (type === "experience") setCurrentItemData({ id: uuidv4(), jobTitle: '', companyName: '', startDate: '', endDate: '', description: '' });
      else if (type === "project") setCurrentItemData({ id: uuidv4(), title: '', description: '', technologiesUsed: [], projectUrl: '' });
      else if (type === "education") setCurrentItemData({ id: uuidv4(), degree: '', institution: '', yearOfCompletion: '', details: '' });
    }
    setIsModalOpen(true);
  };
  
  const handleModalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if ((name === "startDate" || name === "endDate") && e.target instanceof HTMLInputElement && e.target.type === "date") {
      // For date inputs, store only YYYY-MM
      setCurrentItemData((prev: any) => ({ ...prev, [name]: value ? value.substring(0, 7) : '' }));
    } else {
      setCurrentItemData((prev: any) => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSaveItem = () => {
    if (!modalType) return;

    // Basic validation
    if (modalType === 'experience' && (!currentItemData.jobTitle || !currentItemData.companyName || !currentItemData.startDate)) {
      toast({ title: "Missing Fields", description: "Please fill in job title, company, and start date.", variant: "destructive" });
      return;
    }
    if (modalType === 'project' && (!currentItemData.title || !currentItemData.description)) {
      toast({ title: "Missing Fields", description: "Please fill in project title and description.", variant: "destructive" });
      return;
    }
    if (modalType === 'education' && (!currentItemData.degree || !currentItemData.institution || !currentItemData.yearOfCompletion)) {
      toast({ title: "Missing Fields", description: "Please fill in degree, institution, and year of completion.", variant: "destructive" });
      return;
    }

    if (editingItem) { 
      if (modalType === "experience") setExperiences(experiences.map(exp => exp.id === editingItem.id ? { ...currentItemData, id: editingItem.id } as ExperienceItem : exp));
      else if (modalType === "project") setProjects(projects.map(proj => proj.id === editingItem.id ? { ...currentItemData, id: editingItem.id } as ProjectItem : proj));
      else if (modalType === "education") setEducationHistory(educationHistory.map(edu => edu.id === editingItem.id ? { ...currentItemData, id: editingItem.id } as EducationItem : edu));
      toast({title: "Item Updated", description: "Changes saved. Click 'Save All Profile Changes' at the bottom to make it permanent."});
    } else { 
      const newItemWithId = { ...currentItemData, id: currentItemData.id || uuidv4() };
      if (modalType === "experience") setExperiences([...experiences, newItemWithId as ExperienceItem]);
      else if (modalType === "project") setProjects([...projects, newItemWithId as ProjectItem]);
      else if (modalType === "education") setEducationHistory([...educationHistory, newItemWithId as EducationItem]);
      toast({title: "Item Added", description: "Item added. Click 'Save All Profile Changes' at the bottom to make it permanent."});
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setCurrentItemData({});
  };

  const handleDeleteItem = (type: "experience" | "project" | "education", itemId: string) => {
    if (type === "experience") setExperiences(experiences.filter(exp => exp.id !== itemId));
    else if (type === "project") setProjects(projects.filter(proj => proj.id !== itemId));
    else if (type === "education") setEducationHistory(educationHistory.filter(edu => edu.id !== itemId));
    toast({ title: "Item Removed", description: "Item removed locally. Save all profile changes to make it permanent." });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("ProfilePage: handleFileChange initiated.");
    const file = event.target.files?.[0];
    
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file) {
      console.log("ProfilePage: File selection cancelled by user.");
      return;
    }

    console.log("ProfilePage: New file selected:", file.name);
    setIsReadingFile(true);
    setSelectedFile(file);
    setSelectedFileName(file.name); 
    setClientSideResumeText(null); 

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File Too Large", description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null); 
      setClientSideResumeText(userProfile?.resumeProcessedText || null);
      setIsReadingFile(false);
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({ title: "Unsupported File Type", description: `Please upload one of: ${ACCEPT_FILE_EXTENSIONS}. Plain text (.txt, .md) recommended.`, variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeProcessedText || null);
      setIsReadingFile(false);
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({ title: "File Type Notice", description: `Attempting to extract text from ${file.name}. For PDF/Word, extraction might be incomplete. Plain text (.txt, .md) is best.`, duration: 7000, variant: "default" });
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text);
      console.log("ProfilePage: File read successfully, clientSideResumeText set.");
      toast({ title: "Resume Content Loaded", description: `Text extracted from ${file.name}. Save profile to update for AI use.` });
      setIsReadingFile(false);
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read resume content. Please try a different file or format.", variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeProcessedText || null);
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  const clearResume = async () => {
    console.log("ProfilePage: clearResume initiated.");
    setIsSubmitting(true);
    try {
      if (user && userProfile?.resumeStoragePath) {
        const fileToDeleteRef = storageRef(storage, userProfile.resumeStoragePath);
        await deleteObject(fileToDeleteRef);
        console.log("ProfilePage: Resume deleted from Firebase Storage:", userProfile.resumeStoragePath);
      }
      
      setSelectedFile(null);
      setSelectedFileName(null);
      setClientSideResumeText(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          resumeFileName: null,
          resumeFileUrl: null,
          resumeStoragePath: null,
          resumeProcessedText: null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        toast({ title: "Resume Cleared", description: "Resume removed from profile and storage." });
        await refreshUserProfile(); 
      } else {
         toast({ title: "Resume Cleared Locally", description: "Local resume selection cleared." });
      }
    } catch (error: any) {
      console.error("ProfilePage: Error clearing resume:", error);
      toast({ title: "Clear Resume Failed", description: error.message || "Could not remove resume. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    if (!values.profileField || !values.role) {
        toast({ title: "Missing Required Fields", description: "Profile Field and Target Role are mandatory.", variant: "destructive" });
        form.setError("profileField", { type: "manual", message: !values.profileField ? "Profile field is required." : "" });
        form.setError("role", { type: "manual", message: !values.role ? "Target role is required." : "" });
        return;
    }

    console.log("ProfilePage: onSubmit triggered.");
    setIsSubmitting(true);
    setIsUploading(false); 
    setUploadProgress(null);

    let newResumeData: {
      resumeFileName: string | null;
      resumeFileUrl: string | null;
      resumeStoragePath: string | null;
      resumeProcessedText: string | null;
    } = {
      resumeFileName: userProfile?.resumeFileName || null,
      resumeFileUrl: userProfile?.resumeFileUrl || null,
      resumeStoragePath: userProfile?.resumeStoragePath || null,
      resumeProcessedText: clientSideResumeText || userProfile?.resumeProcessedText || null,
    };

    try {
      if (selectedFile) { 
        console.log("ProfilePage: New resume file selected, starting upload:", selectedFile.name);
        setIsUploading(true);

        if (userProfile?.resumeStoragePath) {
          try {
            const oldFileRef = storageRef(storage, userProfile.resumeStoragePath);
            await deleteObject(oldFileRef);
            console.log("ProfilePage: Old resume deleted from Firebase Storage:", userProfile.resumeStoragePath);
          } catch (deleteError: any) {
            console.warn("ProfilePage: Failed to delete old resume, continuing with new upload:", deleteError.message);
          }
        }
        
        const filePath = `users/${user.uid}/resumes/${uuidv4()}-${selectedFile.name}`;
        const fileToUploadRef = storageRef(storage, filePath);
        const uploadTask = uploadBytesResumable(fileToUploadRef, selectedFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              console.log('ProfilePage: Upload progress:', progress);
            },
            (error) => {
              console.error("ProfilePage: File upload error:", error);
              toast({ title: "Resume Upload Failed", description: error.message, variant: "destructive" });
              setIsUploading(false); 
              reject(error);
            },
            async () => {
              console.log("ProfilePage: Upload complete. Getting download URL.");
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                newResumeData = {
                  resumeFileName: selectedFile.name,
                  resumeFileUrl: downloadURL,
                  resumeStoragePath: filePath,
                  resumeProcessedText: clientSideResumeText, 
                };
                console.log("ProfilePage: New resume data prepared after upload:", newResumeData);
                setIsUploading(false);
                resolve();
              } catch (urlError: any) {
                console.error("ProfilePage: Error getting download URL:", urlError);
                toast({ title: "Upload Post-Processing Failed", description: "Could not get resume URL.", variant: "destructive" });
                setIsUploading(false);
                reject(urlError);
              }
            }
          );
        });
      } else if (selectedFileName === null && userProfile?.resumeFileName !== null) {
        newResumeData = {
          resumeFileName: null,
          resumeFileUrl: null,
          resumeStoragePath: null,
          resumeProcessedText: null,
        };
        console.log("ProfilePage: Resume was cleared. newResumeData reflects null values.");
      } else if (clientSideResumeText !== (userProfile?.resumeProcessedText || null) && !selectedFile) {
          newResumeData.resumeProcessedText = clientSideResumeText;
          console.log("ProfilePage: clientSideResumeText changed, and no new file was uploaded. Updating resumeProcessedText.");
      }


      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: values.email || user.email || null,
        name: values.name || null,
        profileField: values.profileField, 
        role: values.role, 
        company: values.company || null,
        phoneNumber: values.phoneNumber || user.phoneNumber || null,
        accomplishments: values.accomplishments || null,
        keySkills: keySkills || [],
        experiences: experiences || [],
        projects: projects || [],
        educationHistory: educationHistory || [],
        ...newResumeData,
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
      };

      console.log("ProfilePage: FINAL data to save to Firestore:", JSON.stringify(profileDataToSave, null, 2));
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      console.log("ProfilePage: Profile data successfully saved to Firestore.");
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      
      refreshUserProfile().then(() => {
         console.log("ProfilePage: User profile refreshed in context after save.");
      }).catch(err => {
         console.error("ProfilePage: Error refreshing user profile in context after save:", err);
      });
      
      setSelectedFile(null); 

    } catch (error: any) {
      console.error("ProfilePage: onSubmit - Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description, variant: "destructive" });
    } finally {
      console.log("ProfilePage: onSubmit - Reached finally block.");
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };
  
  const canSubmit = !isSubmitting && !authLoading && !isReadingFile && !isFetchingProfile && !isUploading;
  const isEmailFromAuthProvider = !!user?.email; 

  if (isFetchingProfile || initialLoading || (authLoading && !userProfile && !initialLoading)) {
    return <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,4rem)-2rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3">Loading profile...</p></div>;
  }
  
  const renderModalContent = () => {
    if (!modalType) return null;
    switch (modalType) {
      case "experience":
        return (
          <div className="space-y-3">
            <div><ShadcnLabel htmlFor="jobTitle">Job Title*</ShadcnLabel><Input id="jobTitle" name="jobTitle" value={currentItemData.jobTitle || ''} onChange={handleModalFormChange} /></div>
            <div><ShadcnLabel htmlFor="companyName">Company Name*</ShadcnLabel><Input id="companyName" name="companyName" value={currentItemData.companyName || ''} onChange={handleModalFormChange} /></div>
            <div>
              <ShadcnLabel htmlFor="startDate">Start Date*</ShadcnLabel>
              <Input id="startDate" name="startDate" type="date" value={currentItemData.startDate ? `${currentItemData.startDate}-01` : ''} onChange={handleModalFormChange} />
              <FormDescription className="text-xs mt-1">Select the month and year. You can click on the year in the picker to change it.</FormDescription>
            </div>
            <div>
              <ShadcnLabel htmlFor="endDate">End Date (or select month for 'Present')</ShadcnLabel>
              <Input id="endDate" name="endDate" type="date" value={currentItemData.endDate ? `${currentItemData.endDate}-01` : ''} onChange={handleModalFormChange} />
              <FormDescription className="text-xs mt-1">Select the month and year. You can click on the year in the picker to change it.</FormDescription>
            </div>
            <div><ShadcnLabel htmlFor="description">Description (Responsibilities, Achievements)</ShadcnLabel><Textarea id="description" name="description" value={currentItemData.description || ''} onChange={handleModalFormChange} rows={4}/></div>
          </div>
        );
      case "project":
        return (
          <div className="space-y-3">
            <div><ShadcnLabel htmlFor="title">Project Title*</ShadcnLabel><Input id="title" name="title" value={currentItemData.title || ''} onChange={handleModalFormChange} /></div>
            <div><ShadcnLabel htmlFor="description">Description*</ShadcnLabel><Textarea id="description" name="description" value={currentItemData.description || ''} onChange={handleModalFormChange} rows={4}/></div>
            <div><ShadcnLabel htmlFor="technologiesUsed">Technologies Used (comma-separated)</ShadcnLabel><Input id="technologiesUsed" name="technologiesUsed" value={Array.isArray(currentItemData.technologiesUsed) ? currentItemData.technologiesUsed.join(', ') : (currentItemData.technologiesUsed || '')} onChange={(e) => setCurrentItemData((prev: any) => ({ ...prev, technologiesUsed: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} /></div>
            <div><ShadcnLabel htmlFor="projectUrl">Project URL (optional)</ShadcnLabel><Input id="projectUrl" name="projectUrl" type="url" value={currentItemData.projectUrl || ''} onChange={handleModalFormChange} placeholder="https://example.com"/></div>
          </div>
        );
      case "education":
        return (
          <div className="space-y-3">
            <div><ShadcnLabel htmlFor="degree">Degree/Certificate*</ShadcnLabel><Input id="degree" name="degree" value={currentItemData.degree || ''} onChange={handleModalFormChange} /></div>
            <div><ShadcnLabel htmlFor="institution">Institution*</ShadcnLabel><Input id="institution" name="institution" value={currentItemData.institution || ''} onChange={handleModalFormChange} /></div>
            <div><ShadcnLabel htmlFor="yearOfCompletion">Year of Completion (YYYY)*</ShadcnLabel><Input id="yearOfCompletion" name="yearOfCompletion" type="text" maxLength={4} pattern="\d{4}" placeholder="YYYY" value={currentItemData.yearOfCompletion || ''} onChange={handleModalFormChange} /></div>
            <div><ShadcnLabel htmlFor="details">Additional Details (e.g., CGPA, Honors - optional)</ShadcnLabel><Textarea id="details" name="details" value={currentItemData.details || ''} onChange={handleModalFormChange} rows={3}/></div>
          </div>
        );
      default: return null;
    }
  };


  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><UserCircle2 className="h-6 w-6 text-primary" /> Personal Details</CardTitle>
              <CardDescription>Basic information about you. Profile Field and Target Role are mandatory.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><ShadcnFormLabel>Full Name</ShadcnFormLabel><FormControl><Input placeholder="e.g., Ada Lovelace" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><ShadcnFormLabel>{isEmailFromAuthProvider ? "Email (Primary Login ID)" : "Email"}</ShadcnFormLabel><FormControl><Input placeholder={isEmailFromAuthProvider ? "your-login-email@example.com" : "you@example.com"} {...field} value={field.value ?? ""} readOnly={isEmailFromAuthProvider} className={isEmailFromAuthProvider ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><ShadcnFormLabel>Phone Number {user?.phoneNumber ? "(Primary Login ID)" : "(Optional)"}</ShadcnFormLabel><FormControl><Input placeholder="e.g., +15551234567" {...field} value={field.value ?? ""} type="tel" readOnly={!!user?.phoneNumber} className={!!user?.phoneNumber ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="profileField" render={({ field }) => (<FormItem><ShadcnFormLabel>Profile Field / Industry*</ShadcnFormLabel><FormControl><Input placeholder="e.g., Software Engineering, Data Science" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="role" render={({ field }) => (<FormItem><ShadcnFormLabel>Target Role*</ShadcnFormLabel><FormControl><Input placeholder="e.g., Senior Frontend Developer, Product Manager" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="company" render={({ field }) => (<FormItem><ShadcnFormLabel>Current or Target Company (Optional)</ShadcnFormLabel><FormControl><Input placeholder="e.g., Google, Acme Corp" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-6 w-6 text-primary" /> Key Skills</CardTitle>
              <CardDescription>Highlight your top professional skills. Changes here are saved when you click 'Save All Profile Changes'.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input placeholder="e.g., React, Python, Project Management" value={currentSkill} onChange={(e) => setCurrentSkill(e.target.value)} className="flex-grow" onKeyDown={(e) => {if(e.key === 'Enter'){ e.preventDefault(); handleAddSkill();}}} />
                <Button type="button" onClick={handleAddSkill} variant="outline" size="icon" aria-label="Add Skill"><PlusCircle className="h-5 w-5" /></Button>
              </div>
              {keySkills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {keySkills.map(skill => (
                    <Badge key={skill} variant="secondary" className="text-sm py-1 px-3 rounded-md shadow-sm">
                      {skill}
                      <button type="button" onClick={() => handleRemoveSkill(skill)} className="ml-2 text-muted-foreground hover:text-destructive" aria-label={`Remove skill ${skill}`}>
                        <XCircle className="h-4 w-4" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
               {keySkills.length === 0 && <p className="text-sm text-muted-foreground">No skills added yet.</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Briefcase className="h-6 w-6 text-primary" /> Work Experience</CardTitle>
              <CardDescription>Detail your professional journey. Add, edit, or remove entries. Changes are saved when you click 'Save All Profile Changes'.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {experiences.length === 0 && <p className="text-sm text-muted-foreground">No work experience added yet.</p>}
              {experiences.map((exp) => (
                <Card key={exp.id} className="bg-muted/30 p-4 shadow-sm rounded-md">
                  <CardHeader className="p-0 pb-2 flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-md font-semibold">{exp.jobTitle} at {exp.companyName}</CardTitle>
                        <CardDescription className="text-xs">{exp.startDate} - {exp.endDate || 'Present'}</CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="icon" onClick={() => openModal('experience', exp)} aria-label={`Edit experience ${exp.jobTitle}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('experience', exp.id)} aria-label={`Delete experience ${exp.jobTitle}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    <p className="whitespace-pre-wrap">{exp.description || "No description provided."}</p>
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('experience')}><PlusCircle className="mr-2 h-4 w-4" /> Add Experience</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-6 w-6 text-primary" /> Projects</CardTitle>
              <CardDescription>Showcase your personal or professional projects. Changes are saved when you click 'Save All Profile Changes'.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects added yet.</p>}
              {projects.map((proj) => (
                <Card key={proj.id} className="bg-muted/30 p-4 shadow-sm rounded-md">
                  <CardHeader className="p-0 pb-2 flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-md font-semibold">{proj.title}</CardTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="icon" onClick={() => openModal('project', proj)} aria-label={`Edit project ${proj.title}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('project', proj.id)} aria-label={`Delete project ${proj.title}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    <p className="whitespace-pre-wrap">{proj.description}</p>
                    {proj.technologiesUsed && proj.technologiesUsed.length > 0 && <p className="mt-1 text-xs">Tech: {proj.technologiesUsed.join(', ')}</p>}
                    {proj.projectUrl && <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs block mt-1 break-all">View Project</a>}
                  </CardContent>
                </Card>
              ))}
               <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('project')}><PlusCircle className="mr-2 h-4 w-4" /> Add Project</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><GraduationCap className="h-6 w-6 text-primary" /> Education History</CardTitle>
              <CardDescription>List your educational qualifications. Changes are saved when you click 'Save All Profile Changes'.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {educationHistory.length === 0 && <p className="text-sm text-muted-foreground">No education history added yet.</p>}
              {educationHistory.map((edu) => (
                <Card key={edu.id} className="bg-muted/30 p-4 shadow-sm rounded-md">
                    <CardHeader className="p-0 pb-2 flex flex-row justify-between items-start">
                        <div>
                            <CardTitle className="text-md font-semibold">{edu.degree} from {edu.institution}</CardTitle>
                            <CardDescription className="text-xs">Completed: {edu.yearOfCompletion}</CardDescription>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openModal('education', edu)} aria-label={`Edit education ${edu.degree}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('education', edu.id)} aria-label={`Delete education ${edu.degree}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button>
                        </div>
                    </CardHeader>
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    <p className="whitespace-pre-wrap">{edu.details || "No additional details."}</p>
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('education')}><PlusCircle className="mr-2 h-4 w-4" /> Add Education</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Trophy className="h-6 w-6 text-primary" /> Accomplishments</CardTitle>
                <CardDescription>Share your significant achievements, awards, or recognitions (optional).</CardDescription>
            </CardHeader>
            <CardContent>
                <FormField control={form.control} name="accomplishments" render={({ field }) => (<FormItem><ShadcnFormLabel>Accomplishments</ShadcnFormLabel><FormControl><Textarea placeholder="e.g., 'Led a team to successfully launch Product X...' or 'Published research paper Y...'" {...field} value={field.value ?? ""} rows={5} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><FileText className="h-6 w-6 text-primary" /> Resume</CardTitle>
              <CardDescription>Upload your resume. Text will be extracted for AI question generation (PDF, DOCX, TXT, MD accepted).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    accept={ACCEPT_FILE_EXTENSIONS}
                    onChange={handleFileChange}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isReadingFile || isUploading || isSubmitting}
                  />
                </FormControl>
                {(isReadingFile && !isUploading) && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Max {MAX_FILE_SIZE_MB}MB. Plain text (.txt, .md) is best for AI. For PDF/DOCX, text extraction may be limited.
              </FormDescription>

              {isUploading && uploadProgress !== null && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {uploadProgress === 0 ? "Starting upload..." : (uploadProgress < 100 ? `Uploading: ${Math.round(uploadProgress)}%` :  "Processing...")}
                  </p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {selectedFileName && !isUploading && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate" title={selectedFileName}>{selectedFileName}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {userProfile?.resumeFileUrl && selectedFileName === userProfile.resumeFileName && (
                      <a href={userProfile.resumeFileUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="icon" title="Download saved resume" aria-label="Download saved resume">
                          <DownloadCloud className="h-4 w-4 text-primary" />
                        </Button>
                      </a>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={clearResume} title="Clear resume selection/upload" aria-label="Clear resume" disabled={isSubmitting || isUploading || isReadingFile}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
               {!selectedFileName && userProfile?.resumeFileName && !isUploading && ( 
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                   <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate" title={userProfile.resumeFileName}>{userProfile.resumeFileName} (Saved)</span>
                  </div>
                   <div className="flex items-center gap-1 shrink-0">
                    {userProfile?.resumeFileUrl && (
                      <a href={userProfile.resumeFileUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="icon" title="Download saved resume" aria-label="Download saved resume">
                          <DownloadCloud className="h-4 w-4 text-primary" />
                        </Button>
                      </a>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={clearResume} title="Remove saved resume" aria-label="Remove saved resume" disabled={isSubmitting || isUploading || isReadingFile}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="fixed bottom-0 left-0 right-0 md:relative bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 border-t md:border-none md:p-0">
             <Button type="submit" disabled={!canSubmit} className="w-full md:w-auto text-lg py-3 px-6 shadow-lg">
                {(isSubmitting || isUploading || isReadingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? 'Uploading Resume...' : (isReadingFile ? 'Processing File...' : (isSubmitting ? 'Saving Profile...' : 'Save All Profile Changes'))}
             </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) { setEditingItem(null); setCurrentItemData({}); }}}>
        <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingItem ? "Edit " : "Add New "} 
              {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || '')}
            </DialogTitle>
            <DialogDescription>
              Please fill in the details for your {modalType}. Click save when you're done. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {renderModalContent()}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); setEditingItem(null); setCurrentItemData({});}}>Cancel</Button>
            <Button type="button" onClick={handleSaveItem}>Save {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || '')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}


    