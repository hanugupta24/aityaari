
"use client";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, XCircle, PlusCircle, Edit3, Trash2, Briefcase, Lightbulb, GraduationCap, Trophy, UserCircle2, Info, AlertTriangle, UploadCloud } from "lucide-react";
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
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';


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

const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf,.doc,.docx";
const MAX_FILE_SIZE_MB = 5; 
const LOCAL_STORAGE_RESUME_TEXT_KEY = 'tyaariResumeProcessedText';
const LOCAL_STORAGE_RESUME_FILENAME_KEY = 'tyaariResumeFileName';


export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null); 
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null); 
  const [isProcessingFile, setIsProcessingFile] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  });
  
  useEffect(() => {
    if (typeof window !== "undefined" && typeof pdfjsLib !== "undefined") {
        const workerSrc = `${window.location.origin}/pdf.worker.mjs`;
        console.log("ProfilePage: Attempting to set pdf.js workerSrc to:", workerSrc);
        console.warn("CRITICAL: Ensure `node_modules/pdfjs-dist/build/pdf.worker.mjs` is copied to `public/pdf.worker.mjs` AND your dev server is restarted.");
        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        } else {
            console.error("ProfilePage: pdfjsLib.GlobalWorkerOptions is undefined. PDF.js might not be loaded correctly.");
        }
    }
  }, []);

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
        
        // Prioritize localStorage, then Firestore for resume text on initial load
        const lsText = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY) : null;
        const lsFileName = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY) : null;

        if (lsText && lsFileName) {
            setClientSideResumeText(lsText);
            setSelectedFileName(lsFileName);
        } else if (userProfile.resumeRawText) { 
            setClientSideResumeText(userProfile.resumeRawText);
            setSelectedFileName("resume_from_profile.txt"); // Generic name if from DB
        }

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
        if (typeof window !== "undefined") {
            const lsText = localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
            const lsFileName = localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
            if (lsText && lsFileName) {
                setClientSideResumeText(lsText);
                setSelectedFileName(lsFileName);
            }
        }
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) { 
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues); 
    }
  }, [user, userProfile, authLoading, initialLoading, form.reset, form.formState.defaultValues]);


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
      if (type === "experience") setCurrentItemData({ id: uuidv4(), jobTitle: '', companyName: '', startDate: '', endDate: '', description: '' });
      else if (type === "project") setCurrentItemData({ id: uuidv4(), title: '', description: '', technologiesUsed: [], projectUrl: '' });
      else if (type === "education") setCurrentItemData({ id: uuidv4(), degree: '', institution: '', yearOfCompletion: '', details: '' });
    }
    setIsModalOpen(true);
  };
  
  const handleModalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if ((name === "startDate" || name === "endDate") && e.target instanceof HTMLInputElement && e.target.type === "month") {
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

  const clearResume = (showToast: boolean = false, toastMessage?: string) => {
    setSelectedFileName(null); 
    setClientSideResumeText(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
      localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (showToast) {
        toast({ title: "Resume Cleared", description: toastMessage || "Resume selection and local storage text removed." });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input for re-upload

    if (!file) {
      clearResume(false);
      return;
    }
    
    setSelectedFileName(file.name);
    setIsProcessingFile(true);
    setClientSideResumeText(null); 
    toast({ title: "Processing Resume", description: `Extracting text from ${file.name}...` });

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File Too Large", description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
      clearResume(true, "Previous resume data (if any) cleared due to file size error.");
      setIsProcessingFile(false);
      return;
    }
    
    try {
      let extractedText = "";
      if (file.type === 'application/pdf') {
        console.log("ProfilePage: CLIENT_SIDE_PARSE - Attempting PDF parsing with pdfjs-dist.");
        if (typeof pdfjsLib === "undefined" || !pdfjsLib.GlobalWorkerOptions?.workerSrc) {
             throw new Error("PDF.js worker not configured. Ensure pdf.worker.mjs is in public/ and server restarted.");
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdfDoc.numPages;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          extractedText += textContent.items.map((item: any) => item.str).join(' ');
        }
        console.log("ProfilePage: CLIENT_SIDE_PARSE - PDF text extracted via pdf.js.");
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
        console.log("ProfilePage: CLIENT_SIDE_PARSE - Attempting DOCX parsing with mammoth.js.");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
        console.log("ProfilePage: CLIENT_SIDE_PARSE - DOCX text extracted via mammoth.js.");
      } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
        console.log("ProfilePage: CLIENT_SIDE_PARSE - Attempting TXT/MD parsing with FileReader.");
        extractedText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsText(file);
        });
        console.log("ProfilePage: CLIENT_SIDE_PARSE - TXT/MD text extracted via FileReader.");
      } else {
        toast({ title: "Unsupported File Type", description: `Cannot extract text from ${file.name}. Supported types: PDF, DOCX, TXT, MD.`, variant: "destructive" });
        clearResume(true, "Previous resume data (if any) cleared due to unsupported file type.");
        setIsProcessingFile(false);
        return;
      }

      if (extractedText && extractedText.trim().length > 0) {
        setClientSideResumeText(extractedText);
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_RESUME_TEXT_KEY, extractedText);
          localStorage.setItem(LOCAL_STORAGE_RESUME_FILENAME_KEY, file.name);
        }
        toast({ title: "Resume Processed", description: `Raw text extracted from ${file.name} and stored in browser.` });
      } else {
        toast({ title: "No Text Extracted", description: `Could not extract text from ${file.name}. It might be empty or corrupted.`, variant: "default" });
        clearResume(true, "Previous resume data (if any) cleared as no text was extracted from the new file.");
      }
    } catch (error: any) {
      console.error("ProfilePage: CLIENT_SIDE_PARSE - Error processing file:", error);
      let toastMessage = "An error occurred while processing your resume. Check console for details.";
      if (error.message?.includes("worker") || error.message?.includes("fetch dynamically imported module") || error.message?.includes("pdf.js worker")) {
        toastMessage = "PDF Processing Initialization Error. Ensure `pdf.worker.mjs` is in `public/` folder and restart server. Previous resume data (if any) has been kept.";
        // Preserve existing valid resume text if the error is due to PDF worker setup
        setSelectedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY)); // Restore selection to previous valid one
      } else {
        // For other errors (e.g., corrupted file), clear resume data
        clearResume(true, "Previous resume data (if any) cleared due to an error processing the new file.");
      }
      toast({ title: "Resume Processing Error", description: toastMessage, variant: "destructive", duration: 10000 });
    } finally {
      setIsProcessingFile(false);
    }
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
        // Save clientSideResumeText to Firestore if available, otherwise keep existing or null
        resumeRawText: clientSideResumeText !== null ? clientSideResumeText : (userProfile?.resumeRawText || null),
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
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
              <Label htmlFor="startDate">Start Date* (YYYY-MM)</Label>
              <Input id="startDate" name="startDate" type="month" value={currentItemData.startDate || ''} onChange={handleModalFormChange} />
            </div>
            <div>
              <Label htmlFor="endDate">End Date (YYYY-MM, leave blank if current)</Label>
              <Input id="endDate" name="endDate" type="month" value={currentItemData.endDate || ''} onChange={handleModalFormChange} />
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
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><FileText className="h-6 w-6 text-primary" /> Upload Resume</CardTitle>
                <CardDescription>
                    Upload your resume (PDF, DOCX, TXT, MD). Text will be extracted and stored in your browser for question generation.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input type="file" ref={fileInputRef} accept={ACCEPT_FILE_EXTENSIONS} onChange={handleFileChange} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isProcessingFile || isSubmitting}/>
                </FormControl>
                {isProcessingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <Alert variant="default" className="border-blue-500/50 text-blue-700 dark:text-blue-300 dark:border-blue-400/50">
                <UploadCloud className="h-4 w-4 !text-blue-500 dark:!text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Resume Processing</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-200">
                  Supported: <strong>.pdf, .docx, .txt, .md</strong>. Max: {MAX_FILE_SIZE_MB}MB. 
                  Text is extracted client-side. Ensure your browser supports the libraries used (pdf.js for PDF, mammoth.js for DOCX).
                </AlertDescription>
              </Alert>
              {selectedFileName && (<div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50"><div className="flex items-center gap-2 overflow-hidden"><FileText className="h-4 w-4 text-primary shrink-0" /><span className="truncate" title={selectedFileName}>{selectedFileName}</span> ({clientSideResumeText ? `${Math.round(clientSideResumeText.length / 1024)} KB` : 'No text extracted'})</div><div className="flex items-center gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => clearResume(true, "Resume selection and local storage text removed.")} title="Clear resume selection" aria-label="Clear resume" disabled={isSubmitting || isProcessingFile}><XCircle className="h-4 w-4 text-destructive" /></Button></div></div>)}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Briefcase className="h-6 w-6 text-primary" /> Work Experience</CardTitle><CardDescription>Detail your professional journey. This is saved to your profile.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {experiences.length === 0 && <p className="text-sm text-muted-foreground">No work experience added yet.</p>}
              {experiences.map((exp) => (<Card key={exp.id} className="bg-muted/30 p-4 shadow-sm rounded-md"><CardHeader className="p-0 pb-2 flex flex-row justify-between items-start"><div><CardTitle className="text-md font-semibold">{exp.jobTitle} at {exp.companyName}</CardTitle><CardDescription className="text-xs">{exp.startDate || 'N/A'} - {exp.endDate || 'Present'}</CardDescription></div><div className="flex gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => openModal('experience', exp)} aria-label={`Edit experience ${exp.jobTitle}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('experience', exp.id)} aria-label={`Delete experience ${exp.jobTitle}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button></div></CardHeader><CardContent className="p-0 text-sm text-muted-foreground"><p className="whitespace-pre-wrap">{exp.description || "No description provided."}</p></CardContent></Card>))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('experience')}><PlusCircle className="mr-2 h-4 w-4" /> Add Experience Manually</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-6 w-6 text-primary" /> Projects</CardTitle><CardDescription>Showcase your personal or professional projects. Saved to your profile.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects added yet.</p>}
              {projects.map((proj) => (<Card key={proj.id} className="bg-muted/30 p-4 shadow-sm rounded-md"><CardHeader className="p-0 pb-2 flex flex-row justify-between items-start"><div><CardTitle className="text-md font-semibold">{proj.title}</CardTitle></div><div className="flex gap-1 shrink-0"><Button type="button" variant="ghost" size="icon" onClick={() => openModal('project', proj)} aria-label={`Edit project ${proj.title}`}><Edit3 className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteItem('project', proj.id)} aria-label={`Delete project ${proj.title}`}><Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" /></Button></div></CardHeader><CardContent className="p-0 text-sm text-muted-foreground"><p className="whitespace-pre-wrap">{proj.description}</p>{proj.technologiesUsed && proj.technologiesUsed.length > 0 && <p className="mt-1 text-xs">Tech: {proj.technologiesUsed.join(', ')}</p>}{proj.projectUrl && <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs block mt-1 break-all">View Project</a>}</CardContent></Card>))}
              <Button type="button" variant="outline" className="w-full mt-2 border-dashed hover:border-primary hover:text-primary" onClick={() => openModal('project')}><PlusCircle className="mr-2 h-4 w-4" /> Add Project Manually</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><GraduationCap className="h-6 w-6 text-primary" /> Education History</CardTitle><CardDescription>List your educational qualifications. This is saved to your profile.</CardDescription></CardHeader>
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


          <div className="fixed bottom-0 left-0 right-0 md:relative bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 border-t md:border-none md:p-0">
             <Button type="submit" disabled={!canSubmit} className="w-full md:w-auto text-lg py-3 px-6 shadow-lg">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving Profile...' : 'Save All Profile Changes'}
             </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) { setEditingItem(null); setCurrentItemData({}); }}}>
        <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{editingItem ? "Edit " : "Add New "} {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || '')}</DialogTitle>
            <ShadcnDialogDescription>
              Please fill in the details for your {modalType}. Click save when you&apos;re done. Fields marked with * are required. For dates, use YYYY-MM.
            </ShadcnDialogDescription>
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
