
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50).optional().nullable(),
  email: z.string().email({ message: "Please enter a valid email." }).optional().nullable(),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100).optional().nullable(),
  role: z.string().min(2, { message: "Current role is required." }).max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  accomplishments: z.string().max(5000).optional().nullable(),
  // Resume fields are handled separately and not part of this Zod schema for form values
  // keySkills, experiences, projects, educationHistory are handled by local state
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
        
        if (userProfile.resumeFileName) {
          setSelectedFileName(userProfile.resumeFileName);
        }
        if (userProfile.resumeProcessedText) {
          setClientSideResumeText(userProfile.resumeProcessedText);
        }

      } else {
        form.reset({ name: user.displayName || "", email: initialEmail, phoneNumber: initialPhoneNumber, profileField: "", role: "", company: "", accomplishments:"" });
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file) {
      console.log("ProfilePage: File selection cancelled.");
      setSelectedFile(null);
      // Do not clear existing selectedFileName or clientSideResumeText from profile here
      return;
    }

    console.log("ProfilePage: New file selected:", file.name);
    setIsReadingFile(true);
    setSelectedFile(file);
    setSelectedFileName(file.name); // Show new file name immediately
    setClientSideResumeText(null); // Clear old processed text

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null); // Revert to saved file name
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert to saved processed text
      setIsReadingFile(false);
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({ title: "Unsupported File Type", description: `Please use ${ACCEPT_FILE_EXTENSIONS}. Plain text (.txt, .md) is best for AI.`, variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeProcessedText || null);
      setIsReadingFile(false);
      return;
    }
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({ title: "File Type Notice", description: `Attempting to extract text. For PDF/Word, text extraction might be incomplete. A plain text version is recommended.`, duration: 7000 });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text); // For AI use, potentially to be saved
      toast({ title: "Resume Content Loaded", description: `Text extracted from ${file.name}. Save profile to update for AI use.` });
      setIsReadingFile(false);
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read resume content.", variant: "destructive" });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null);
      setClientSideResumeText(userProfile?.resumeProcessedText || null);
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  const clearResume = async () => {
    console.log("ProfilePage: clearResume initiated.");
    if (user && userProfile?.resumeStoragePath) {
      setIsSubmitting(true); // Indicate activity
      try {
        const fileToDeleteRef = storageRef(storage, userProfile.resumeStoragePath);
        await deleteObject(fileToDeleteRef);
        console.log("ProfilePage: Resume deleted from Firebase Storage:", userProfile.resumeStoragePath);
        
        // Optimistically update UI and local state
        setSelectedFile(null);
        setSelectedFileName(null);
        setClientSideResumeText(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        // Update Firestore to remove resume fields
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          resumeFileName: null,
          resumeFileUrl: null,
          resumeStoragePath: null,
          resumeProcessedText: null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        
        toast({ title: "Resume Cleared", description: "Resume removed from profile and storage." });
        refreshUserProfile();
      } catch (error) {
        console.error("ProfilePage: Error clearing resume from storage/Firestore:", error);
        toast({ title: "Clear Resume Failed", description: "Could not remove resume. Please try again.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    } else { // If no resume was in storage (e.g., only local changes)
      setSelectedFile(null);
      setSelectedFileName(null);
      setClientSideResumeText(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Resume Cleared", description: "Local resume selection cleared." });
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    console.log("ProfilePage: onSubmit triggered. Form Values:", JSON.stringify(values, null, 2));
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
      resumeProcessedText: clientSideResumeText || userProfile?.resumeProcessedText || null, // Prioritize newly processed text
    };

    try {
      if (selectedFile) {
        console.log("ProfilePage: New resume file selected, starting upload...", selectedFile.name);
        setIsUploading(true);

        // Delete old resume if it exists
        if (userProfile?.resumeStoragePath) {
          try {
            const oldFileRef = storageRef(storage, userProfile.resumeStoragePath);
            await deleteObject(oldFileRef);
            console.log("ProfilePage: Old resume deleted from Firebase Storage:", userProfile.resumeStoragePath);
          } catch (deleteError: any) {
            // Non-critical if old file deletion fails, proceed with new upload
            console.warn("ProfilePage: Failed to delete old resume, continuing with new upload:", deleteError);
          }
        }
        
        const filePath = `users/${user.uid}/resumes/${selectedFile.name}`;
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
              setUploadProgress(null);
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
                  resumeProcessedText: clientSideResumeText, // Use the text extracted from the selected file
                };
                console.log("ProfilePage: New resume data prepared:", newResumeData);
                resolve();
              } catch (urlError) {
                console.error("ProfilePage: Error getting download URL:", urlError);
                toast({ title: "Upload Post-Processing Failed", description: "Could not get resume URL.", variant: "destructive" });
                reject(urlError);
              }
            }
          );
        });
        setIsUploading(false);
        setUploadProgress(null);
      } else if (selectedFileName === null && userProfile?.resumeFileName !== null) {
         // This case means the user cleared the resume (selectedFileName became null),
         // but we handle actual deletion in clearResume. If onSubmit is hit and
         // selectedFileName is null, it implies no new file was chosen,
         // and clearResume should have handled Firestore deletion if intended.
         // For safety, if we reach here and selectedFileName is null, it means
         // no new upload, and whatever is in userProfile (or clientSideResumeText if it's from an un-cleared new selection) is used.
         // If clearResume was used, userProfile fields would be nullified before this save.
      }


      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: values.email || user.email || null,
        name: values.name || "",
        profileField: values.profileField || "",
        role: values.role || "",
        company: values.company || null,
        phoneNumber: values.phoneNumber || user.phoneNumber || null,
        accomplishments: values.accomplishments || "",
        keySkills: keySkills || [],
        experiences: experiences || [],
        projects: projects || [],
        educationHistory: educationHistory || [],
        ...newResumeData, // This includes new or existing resume data
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

    } catch (error: any) {
      console.error("ProfilePage: onSubmit - Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description, variant: "destructive" });
    } finally {
      console.log("ProfilePage: onSubmit - Reached finally block. Setting isSubmitting to false.");
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(null);
      // setSelectedFile(null); // Keep selectedFile if save failed due to other reasons, so user doesn't lose it
    }
  };
  
  const canSubmit = !isSubmitting && !authLoading && !isReadingFile && !isFetchingProfile && !isUploading;
  const isEmailFromAuthProvider = !!user?.email;

  const addListItem = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, newItem: Omit<T, 'id'>) => {
    setter(prev => [...prev, { ...newItem, id: uuidv4() } as T]);
  };

  const removeListItem = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, itemId: string) => {
    setter(prev => prev.filter(item => item.id !== itemId));
  };

  // Placeholder "Add" handlers
  const handleAddExperience = () => console.log("Add Experience clicked - placeholder");
  const handleAddProject = () => console.log("Add Project clicked - placeholder");
  const handleAddEducation = () => console.log("Add Education clicked - placeholder");

  // Placeholder "Edit/Delete" handlers
  const handleEditItem = (section: string, itemId: string) => console.log(`Edit ${section} item ${itemId} - placeholder`);
  const handleDeleteItem = (section: string, itemId: string) => {
    console.log(`Delete ${section} item ${itemId} - placeholder`);
    if (section === 'experience') setExperiences(prev => prev.filter(item => item.id !== itemId));
    if (section === 'project') setProjects(prev => prev.filter(item => item.id !== itemId));
    if (section === 'education') setEducationHistory(prev => prev.filter(item => item.id !== itemId));
    toast({title: `${section.charAt(0).toUpperCase() + section.slice(1)} Item Removed`, description: "Save profile to make changes permanent."});
  };


  if (isFetchingProfile || initialLoading || (authLoading && !userProfile && !initialLoading)) {
    return <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,4rem)-2rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3">Loading profile...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 px-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-6 w-6 text-primary" /> Personal Details</CardTitle>
              <CardDescription>Basic information about you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Ada Lovelace" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>{isEmailFromAuthProvider ? "Email (Login ID)" : "Email"}</FormLabel><FormControl><Input placeholder={isEmailFromAuthProvider ? "your-login-email@example.com" : "you@example.com"} {...field} value={field.value ?? ""} readOnly={isEmailFromAuthProvider} className={isEmailFromAuthProvider ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number {user?.phoneNumber ? "(Login ID)" : "(Optional)"}</FormLabel><FormControl><Input placeholder="e.g., +15551234567" {...field} value={field.value ?? ""} type="tel" readOnly={!!user?.phoneNumber} className={!!user?.phoneNumber ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="profileField" render={({ field }) => (<FormItem><FormLabel>Profile Field / Industry</FormLabel><FormControl><Input placeholder="e.g., Software Engineering, Product Management" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Current or Target Role</FormLabel><FormControl><Input placeholder="e.g., Senior Frontend Developer" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="company" render={({ field }) => (<FormItem><FormLabel>Current or Target Company (Optional)</FormLabel><FormControl><Input placeholder="e.g., Google, Acme Corp" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lightbulb className="h-6 w-6 text-primary" /> Key Skills</CardTitle>
              <CardDescription>Highlight your top professional skills.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input placeholder="e.g., React, Python, Project Management" value={currentSkill} onChange={(e) => setCurrentSkill(e.target.value)} className="flex-grow" />
                <Button type="button" onClick={handleAddSkill} variant="outline" size="icon"><PlusCircle className="h-5 w-5" /></Button>
              </div>
              {keySkills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keySkills.map(skill => (
                    <Badge key={skill} variant="secondary" className="text-sm py-1 px-3">
                      {skill}
                      <button type="button" onClick={() => handleRemoveSkill(skill)} className="ml-2 text-muted-foreground hover:text-destructive">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Work Experience Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" /> Work Experience</CardTitle>
              <CardDescription>Detail your professional journey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {experiences.map((exp) => (
                <Card key={exp.id} className="bg-muted/30 p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-lg">{exp.jobTitle} at {exp.companyName}</CardTitle>
                    <CardDescription>{exp.startDate} - {exp.endDate}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 text-sm">
                    <p className="whitespace-pre-wrap">{exp.description || "No description provided."}</p>
                  </CardContent>
                  <CardFooter className="p-0 pt-2 flex gap-2">
                     <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEditItem('experience', exp.id)}><Edit3 className="mr-1 h-4 w-4" /> Edit</Button>
                     </DialogTrigger>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteItem('experience', exp.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
                  </CardFooter>
                </Card>
              ))}
              <Dialog>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Add Experience</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Experience</DialogTitle><DialogDescription>Full form for adding experience will be implemented here.</DialogDescription></DialogHeader>
                    <p className="py-4 text-center">Experience form fields go here...</p>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Projects Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lightbulb className="h-6 w-6 text-primary" /> Projects</CardTitle> {/* Re-using Lightbulb, consider another icon if available */}
              <CardDescription>Showcase your personal or professional projects.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.map((proj) => (
                <Card key={proj.id} className="bg-muted/30 p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-lg">{proj.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 text-sm">
                    <p className="whitespace-pre-wrap">{proj.description}</p>
                    {proj.technologiesUsed && proj.technologiesUsed.length > 0 && <p className="mt-1 text-xs">Tech: {proj.technologiesUsed.join(', ')}</p>}
                    {proj.projectUrl && <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs block mt-1">View Project</a>}
                  </CardContent>
                  <CardFooter className="p-0 pt-2 flex gap-2">
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEditItem('project', proj.id)}><Edit3 className="mr-1 h-4 w-4" /> Edit</Button>
                    </DialogTrigger>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteItem('project', proj.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
                  </CardFooter>
                </Card>
              ))}
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Add Project</Button>
                </DialogTrigger>
                 <DialogContent>
                    <DialogHeader><DialogTitle>Add New Project</DialogTitle><DialogDescription>Full form for adding a project will be implemented here.</DialogDescription></DialogHeader>
                    <p className="py-4 text-center">Project form fields go here...</p>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Education History Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /> Education History</CardTitle>
              <CardDescription>List your educational qualifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {educationHistory.map((edu) => (
                <Card key={edu.id} className="bg-muted/30 p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-lg">{edu.degree} from {edu.institution}</CardTitle>
                    <CardDescription>Completed: {edu.yearOfCompletion}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 text-sm">
                    <p className="whitespace-pre-wrap">{edu.details || "No additional details."}</p>
                  </CardContent>
                  <CardFooter className="p-0 pt-2 flex gap-2">
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEditItem('education', edu.id)}><Edit3 className="mr-1 h-4 w-4" /> Edit</Button>
                    </DialogTrigger>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteItem('education', edu.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
                  </CardFooter>
                </Card>
              ))}
              <Dialog>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Add Education</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Education</DialogTitle><DialogDescription>Full form for adding education will be implemented here.</DialogDescription></DialogHeader>
                    <p className="py-4 text-center">Education form fields go here...</p>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Accomplishments</CardTitle>
                <CardDescription>Share your significant achievements, awards, or recognitions.</CardDescription>
            </CardHeader>
            <CardContent>
                <FormField control={form.control} name="accomplishments" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="e.g., 'Led a team to successfully launch Product X, resulting in a 20% increase in user engagement.' or 'Published research paper Y at Conference Z.'" {...field} value={field.value ?? ""} rows={5} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Resume</CardTitle>
              <CardDescription>Upload your resume. Text will be extracted for AI question generation.</CardDescription>
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
                Accepted: {ACCEPT_FILE_EXTENSIONS}, Max {MAX_FILE_SIZE_MB}MB. Plain text (.txt, .md) is best for AI.
              </FormDescription>

              {isUploading && uploadProgress !== null && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {uploadProgress < 100 ? `Uploading: ${Math.round(uploadProgress)}%` : (uploadProgress === 0 ? "Starting upload..." : "Processing...")}
                  </p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {selectedFileName && !isUploading && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>{selectedFileName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {userProfile?.resumeFileUrl && selectedFileName === userProfile.resumeFileName && (
                      <a href={userProfile.resumeFileUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="sm" title="Download saved resume">
                          <DownloadCloud className="h-4 w-4 text-primary" />
                        </Button>
                      </a>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume selection/upload" disabled={isSubmitting || isUploading || isReadingFile}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto text-lg py-3 px-6">
            {(isSubmitting || isUploading || isReadingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? 'Uploading Resume...' : (isReadingFile ? 'Processing File...' : (isSubmitting ? 'Saving Profile...' : 'Save All Profile Changes'))}
          </Button>
        </form>
      </Form>
    </div>
  );
}
