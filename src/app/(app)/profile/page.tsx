
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase"; // Removed storage import as it's not directly used here for resume upload to Firebase
import { doc, setDoc } from "firebase/firestore";
// import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"; // Firebase Storage part commented out
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, UploadCloud, XCircle, PlusCircle, Edit3, Trash2, Briefcase, Lightbulb, GraduationCap, Trophy, UserCircle2, Info, AlertTriangle } from "lucide-react";
import type { UserProfile, ExperienceItem, ProjectItem, EducationItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription as ShadcnDialogDescription, 
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';

// Zod schema for the main form fields
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50).optional().nullable(),
  email: z.string().email({ message: "Please enter a valid email." }).optional().nullable(),
  profileField: z.string().min(1, { message: "Profile field is required." }).max(100),
  role: z.string().min(1, { message: "Target role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  accomplishments: z.string().max(5000, {message: "Accomplishments should be less than 5000 characters."}).optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ACCEPTED_MIME_TYPES_FOR_CLIENT_PROCESSING = ['text/plain', 'text/markdown'];
const ACCEPTED_MIME_TYPES_FOR_SERVER_PROCESSING = ['application/pdf'];
const ALL_ACCEPTED_MIME_TYPES = [...ACCEPTED_MIME_TYPES_FOR_CLIENT_PROCESSING, ...ACCEPTED_MIME_TYPES_FOR_SERVER_PROCESSING];
const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf"; //,.doc,.docx removed as server parsing for them is not implemented
const MAX_FILE_SIZE_MB = 5;

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  // State for resume handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores the File object for server upload
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null); // For display
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null); 
  const [isProcessingFile, setIsProcessingFile] = useState(false); // Generic file processing state (client or server)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for array-based profile sections
  const [keySkills, setKeySkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([]);
  
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedResumeText = localStorage.getItem('tyaariResumeProcessedText');
      const storedFileName = localStorage.getItem('tyaariResumeFileName'); // Keep for display consistency
      if (storedResumeText) setClientSideResumeText(storedResumeText);
      if (storedFileName) setSelectedFileName(storedFileName);
    }
  }, []);


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
      setCurrentItemData((prev: any) => ({ ...prev, [name]: value ? value.substring(0, 7) : '' }));
    } else {
      setCurrentItemData((prev: any) => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSaveItem = () => {
    if (!modalType) return;
    if (modalType === 'experience' && (!currentItemData.jobTitle || !currentItemData.companyName || !currentItemData.startDate)) {
      toast({ title: "Missing Fields", description: "Please fill in job title, company, and start date.", variant: "destructive" }); return;
    }
    if (modalType === 'project' && (!currentItemData.title || !currentItemData.description)) {
      toast({ title: "Missing Fields", description: "Please fill in project title and description.", variant: "destructive" }); return;
    }
    if (modalType === 'education' && (!currentItemData.degree || !currentItemData.institution || !currentItemData.yearOfCompletion)) {
      toast({ title: "Missing Fields", description: "Please fill in degree, institution, and year of completion.", variant: "destructive" }); return;
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
    setIsModalOpen(false); setEditingItem(null); setCurrentItemData({});
  };

  const handleDeleteItem = (type: "experience" | "project" | "education", itemId: string) => {
    if (type === "experience") setExperiences(experiences.filter(exp => exp.id !== itemId));
    else if (type === "project") setProjects(projects.filter(proj => proj.id !== itemId));
    else if (type === "education") setEducationHistory(educationHistory.filter(edu => edu.id !== itemId));
    toast({ title: "Item Removed", description: "Item removed locally. Save all profile changes to make it permanent." });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const prevFileName = selectedFileName;
    const prevResumeText = clientSideResumeText;

    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input for re-selection

    if (!file) {
      setSelectedFile(null); // Clear stored file if selection is cancelled
      return;
    }

    setIsProcessingFile(true);
    setSelectedFile(file);
    setSelectedFileName(file.name);
    setClientSideResumeText(""); // Clear previous text while processing

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File Too Large", description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
      setSelectedFile(null); setSelectedFileName(prevFileName); setClientSideResumeText(prevResumeText);
      setIsProcessingFile(false); return;
    }

    if (!ALL_ACCEPTED_MIME_TYPES.some(type => file.type.startsWith(type)) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({ title: "Unsupported File Type", description: `Please upload .txt, .md, or .pdf.`, variant: "destructive" });
      setSelectedFile(null); setSelectedFileName(prevFileName); setClientSideResumeText(prevResumeText);
      setIsProcessingFile(false); return;
    }
    
    // Client-side processing for .txt and .md
    if (ACCEPTED_MIME_TYPES_FOR_CLIENT_PROCESSING.includes(file.type) || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setClientSideResumeText(text);
        if (typeof window !== "undefined") {
          localStorage.setItem('tyaariResumeProcessedText', text);
          localStorage.setItem('tyaariResumeFileName', file.name);
        }
        toast({ title: "Resume Content Loaded", description: `Text extracted from ${file.name}. This will be used for AI question generation.` });
        setIsProcessingFile(false);
      };
      reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read plain text resume.", variant: "destructive" });
        setSelectedFile(null); setSelectedFileName(prevFileName); setClientSideResumeText(prevResumeText);
        setIsProcessingFile(false);
      };
      reader.readAsText(file);
    } 
    // Server-side processing for .pdf
    else if (ACCEPTED_MIME_TYPES_FOR_SERVER_PROCESSING.includes(file.type) || file.name.toLowerCase().endsWith('.pdf')) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch("/api/extract-resume-text", { method: "POST", body: formData });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to parse error from server."}));
          throw new Error(errorData.message || `Server responded with ${response.status}`);
        }
        const data = await response.json();
        setClientSideResumeText(data.text);
        if (typeof window !== "undefined") {
          localStorage.setItem('tyaariResumeProcessedText', data.text);
          localStorage.setItem('tyaariResumeFileName', file.name);
        }
        toast({ title: "PDF Resume Processed", description: `Text extracted from ${file.name}. This will be used for AI question generation.` });
      } catch (error: any) {
        toast({ title: "PDF Processing Error", description: error.message || "Could not extract text from PDF.", variant: "destructive" });
        setSelectedFile(null); setSelectedFileName(prevFileName); setClientSideResumeText(prevResumeText);
      } finally {
        setIsProcessingFile(false);
      }
    } else {
      // Fallback for unexpected types, though validation should catch this.
      toast({ title: "Unsupported File Type", description: "Please upload .txt, .md, or .pdf.", variant: "destructive" });
      setSelectedFile(null); setSelectedFileName(prevFileName); setClientSideResumeText(prevResumeText);
      setIsProcessingFile(false);
    }
  };

  const clearResume = () => {
    setSelectedFile(null); setSelectedFileName(null); setClientSideResumeText(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem('tyaariResumeProcessedText');
      localStorage.removeItem('tyaariResumeFileName');
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({ title: "Resume Cleared", description: "Resume selection removed from this browser session." });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" }); return;
    }
    if (!values.profileField || !values.role) {
      toast({ title: "Missing Required Fields", description: "Profile Field and Target Role are mandatory.", variant: "destructive" });
      form.setError("profileField", { type: "manual", message: !values.profileField ? "Profile field is required." : "" });
      form.setError("role", { type: "manual", message: !values.role ? "Target role is required." : "" });
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
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
        // Resume data (fileName, URL, processedText) is not saved to Firestore user profile.
        // Processed text is handled via localStorage for AI flow input.
      };
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      refreshUserProfile();
    } catch (error: any) {
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canSubmit = !isSubmitting && !authLoading && !isProcessingFile && !isFetchingProfile;
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
            <div><Label htmlFor="jobTitle">Job Title*</Label><Input id="jobTitle" name="jobTitle" value={currentItemData.jobTitle || ''} onChange={handleModalFormChange} /></div>
            <div><Label htmlFor="companyName">Company Name*</Label><Input id="companyName" name="companyName" value={currentItemData.companyName || ''} onChange={handleModalFormChange} /></div>
            <div>
              <Label htmlFor="startDate">Start Date*</Label>
              <Input id="startDate" name="startDate" type="date" value={currentItemData.startDate ? `${currentItemData.startDate}-01` : ''} onChange={handleModalFormChange} />
               <p className="text-xs mt-1 text-muted-foreground">Select the month and year. You can click on the year in the picker to change it.</p>
            </div>
            <div>
              <Label htmlFor="endDate">End Date (or select month for 'Present')</Label>
              <Input id="endDate" name="endDate" type="date" value={currentItemData.endDate ? `${currentItemData.endDate}-01` : ''} onChange={handleModalFormChange} />
               <p className="text-xs mt-1 text-muted-foreground">Select the month and year. You can click on the year in the picker to change it.</p>
            </div>
            <div><Label htmlFor="description">Description (Responsibilities, Achievements)</Label><Textarea id="description" name="description" value={currentItemData.description || ''} onChange={handleModalFormChange} rows={4}/></div>
          </div>
        );
      case "project":
        return (
          <div className="space-y-3">
            <div><Label htmlFor="title">Project Title*</Label><Input id="title" name="title" value={currentItemData.title || ''} onChange={handleModalFormChange} /></div>
            <div><Label htmlFor="description">Description*</Label><Textarea id="description" name="description" value={currentItemData.description || ''} onChange={handleModalFormChange} rows={4}/></div>
            <div><Label htmlFor="technologiesUsed">Technologies Used (comma-separated)</Label><Input id="technologiesUsed" name="technologiesUsed" value={Array.isArray(currentItemData.technologiesUsed) ? currentItemData.technologiesUsed.join(', ') : (currentItemData.technologiesUsed || '')} onChange={(e) => setCurrentItemData((prev: any) => ({ ...prev, technologiesUsed: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} /></div>
            <div><Label htmlFor="projectUrl">Project URL (optional)</Label><Input id="projectUrl" name="projectUrl" type="url" value={currentItemData.projectUrl || ''} onChange={handleModalFormChange} placeholder="https://example.com"/></div>
          </div>
        );
      case "education":
        return (
          <div className="space-y-3">
            <div><Label htmlFor="degree">Degree/Certificate*</Label><Input id="degree" name="degree" value={currentItemData.degree || ''} onChange={handleModalFormChange} /></div>
            <div><Label htmlFor="institution">Institution*</Label><Input id="institution" name="institution" value={currentItemData.institution || ''} onChange={handleModalFormChange} /></div>
            <div><Label htmlFor="yearOfCompletion">Year of Completion (YYYY)*</Label><Input id="yearOfCompletion" name="yearOfCompletion" type="text" maxLength={4} pattern="\d{4}" placeholder="YYYY" value={currentItemData.yearOfCompletion || ''} onChange={handleModalFormChange} /></div>
            <div><Label htmlFor="details">Additional Details (e.g., CGPA, Honors - optional)</Label><Textarea id="details" name="details" value={currentItemData.details || ''} onChange={handleModalFormChange} rows={3}/></div>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><UserCircle2 className="h-6 w-6 text-primary" /> Personal Details</CardTitle><CardDescription>Basic information about you. Profile Field and Target Role are mandatory.</CardDescription></CardHeader>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-6 w-6 text-primary" /> Key Skills</CardTitle><CardDescription>Highlight your top professional skills. Changes here are saved when you click 'Save All Profile Changes'.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input placeholder="e.g., React, Python, Project Management" value={currentSkill} onChange={(e) => setCurrentSkill(e.target.value)} className="flex-grow" onKeyDown={(e) => {if(e.key === 'Enter'){ e.preventDefault(); handleAddSkill();}}} />
                <Button type="button" onClick={handleAddSkill} variant="outline" size="icon" aria-label="Add Skill"><PlusCircle className="h-5 w-5" /></Button>
              </div>
              {keySkills.length > 0 && (<div className="flex flex-wrap gap-2 pt-2">{keySkills.map(skill => (<Badge key={skill} variant="secondary" className="text-sm py-1 px-3 rounded-md shadow-sm">{skill}<button type="button" onClick={() => handleRemoveSkill(skill)} className="ml-2 text-muted-foreground hover:text-destructive" aria-label={`Remove skill ${skill}`}><XCircle className="h-4 w-4" /></button></Badge>))}</div>)}
              {keySkills.length === 0 && <p className="text-sm text-muted-foreground">No skills added yet.</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Briefcase className="h-6 w-6 text-primary" /> Work Experience</CardTitle><CardDescription>Detail your professional journey. Changes are saved when you click 'Save All Profile Changes'.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {experiences.length === 0 && <p className="text-sm text-muted-foreground">No work experience added yet.</p>}
              {experiences.map((exp) => (<Card key={exp.id} className="bg-muted/30 p-4 shadow-sm rounded-md"><CardHeader className="p-0 pb-2 flex flex-row justify-between items-start"><div><CardTitle className="text-md font-semibold">{exp.jobTitle} at {exp.companyName}</CardTitle><CardDescription className="text-xs">{exp.startDate ? exp.startDate.substring(0,7) : ''} - {exp.endDate ? exp.endDate.substring(0,7) : 'Present'}</CardDescription></div><div className="flex gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => openModal('experience', exp)} aria-label={`Edit experience ${exp.jobTitle}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('experience', exp.id)} aria-label={`Delete experience ${exp.jobTitle}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button></div></CardHeader><CardContent className="p-0 text-sm text-muted-foreground"><p className="whitespace-pre-wrap">{exp.description || "No description provided."}</p></CardContent></Card>))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('experience')}><PlusCircle className="mr-2 h-4 w-4" /> Add Experience</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-6 w-6 text-primary" /> Projects</CardTitle><CardDescription>Showcase your personal or professional projects. Changes are saved when you click 'Save All Profile Changes'.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects added yet.</p>}
              {projects.map((proj) => (<Card key={proj.id} className="bg-muted/30 p-4 shadow-sm rounded-md"><CardHeader className="p-0 pb-2 flex flex-row justify-between items-start"><div><CardTitle className="text-md font-semibold">{proj.title}</CardTitle></div><div className="flex gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => openModal('project', proj)} aria-label={`Edit project ${proj.title}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('project', proj.id)} aria-label={`Delete project ${proj.title}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button></div></CardHeader><CardContent className="p-0 text-sm text-muted-foreground"><p className="whitespace-pre-wrap">{proj.description}</p>{proj.technologiesUsed && proj.technologiesUsed.length > 0 && <p className="mt-1 text-xs">Tech: {proj.technologiesUsed.join(', ')}</p>}{proj.projectUrl && <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs block mt-1 break-all">View Project</a>}</CardContent></Card>))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('project')}><PlusCircle className="mr-2 h-4 w-4" /> Add Project</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><GraduationCap className="h-6 w-6 text-primary" /> Education History</CardTitle><CardDescription>List your educational qualifications. Changes are saved when you click 'Save All Profile Changes'.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {educationHistory.length === 0 && <p className="text-sm text-muted-foreground">No education history added yet.</p>}
              {educationHistory.map((edu) => (<Card key={edu.id} className="bg-muted/30 p-4 shadow-sm rounded-md"><CardHeader className="p-0 pb-2 flex flex-row justify-between items-start"><div><CardTitle className="text-md font-semibold">{edu.degree} from {edu.institution}</CardTitle><CardDescription className="text-xs">Completed: {edu.yearOfCompletion}</CardDescription></div><div className="flex gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => openModal('education', edu)} aria-label={`Edit education ${edu.degree}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('education', edu.id)} aria-label={`Delete education ${edu.degree}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button></div></CardHeader><CardContent className="p-0 text-sm text-muted-foreground"><p className="whitespace-pre-wrap">{edu.details || "No additional details."}</p></CardContent></Card>))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('education')}><PlusCircle className="mr-2 h-4 w-4" /> Add Education</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
             <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Trophy className="h-6 w-6 text-primary" /> Accomplishments</CardTitle><CardDescription>Share your significant achievements, awards, or recognitions (optional).</CardDescription></CardHeader>
            <CardContent><FormField control={form.control} name="accomplishments" render={({ field }) => (<FormItem><ShadcnFormLabel>Accomplishments</ShadcnFormLabel><FormControl><Textarea placeholder="e.g., 'Led a team to successfully launch Product X...' or 'Published research paper Y...'" {...field} value={field.value ?? ""} rows={5} /></FormControl><FormMessage /></FormItem>)} /></CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><FileText className="h-6 w-6 text-primary" /> Resume</CardTitle><CardDescription>Upload your resume. Text will be extracted for AI question generation. This text is stored in your browser. Ensure it is up-to-date before starting an interview.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input type="file" ref={fileInputRef} accept={ACCEPT_FILE_EXTENSIONS} onChange={handleFileChange} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isProcessingFile || isSubmitting}/>
                </FormControl>
                {isProcessingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <Alert variant="default" className="border-blue-500/50 text-blue-700 dark:text-blue-300 dark:border-blue-400/50">
                <Info className="h-4 w-4 !text-blue-500 dark:!text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">File Format Recommendation</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-200">
                  For best AI results, <strong>.txt or .md</strong> files are preferred. PDF processing is supported but may be less accurate for complex layouts.
                </AlertDescription>
              </Alert>
              {selectedFileName && (<div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50"><div className="flex items-center gap-2 overflow-hidden"><FileText className="h-4 w-4 text-primary shrink-0" /><span className="truncate" title={selectedFileName}>{selectedFileName}</span></div><div className="flex items-center gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={clearResume} title="Clear resume selection" aria-label="Clear resume" disabled={isSubmitting || isProcessingFile}><XCircle className="h-4 w-4 text-destructive" /></Button></div></div>)}
            </CardContent>
          </Card>

          <div className="fixed bottom-0 left-0 right-0 md:relative bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 border-t md:border-none md:p-0">
             <Button type="submit" disabled={!canSubmit} className="w-full md:w-auto text-lg py-3 px-6 shadow-lg">
                {(isSubmitting || isProcessingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessingFile ? 'Processing File...' : (isSubmitting ? 'Saving Profile...' : 'Save All Profile Changes')}
             </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) { setEditingItem(null); setCurrentItemData({}); }}}>
        <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{editingItem ? "Edit " : "Add New "} {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || '')}</DialogTitle>
            <ShadcnDialogDescription>Please fill in the details for your {modalType}. Click save when you're done. Fields marked with * are required.</ShadcnDialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">{renderModalContent()}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); setEditingItem(null); setCurrentItemData({});}}>Cancel</Button>
            <Button type="button" onClick={handleSaveItem}>Save {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || '')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
