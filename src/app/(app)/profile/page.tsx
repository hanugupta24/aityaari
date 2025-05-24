
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase"; // storage re-added
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"; // Firebase Storage imports
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, UploadCloud, XCircle, DownloadCloud } from "lucide-react";
import type { UserProfile } from "@/types";
import { Progress } from "@/components/ui/progress";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  // resumeProcessedText is not a direct form field, but part of the UserProfile data
  // It's populated by file processing logic
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ACCEPTED_MIME_TYPES = [
  'text/plain', 
  'text/markdown', 
  'application/pdf', 
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf,.doc,.docx";
const MAX_FILE_SIZE_MB = 5;

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null); // Holds client-extracted text
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      profileField: "",
      role: "",
      company: "",
      education: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    if (!initialLoading && !authLoading && user) {
      if (userProfile) {
        form.reset({
          name: userProfile.name || "",
          profileField: userProfile.profileField || "",
          role: userProfile.role || "",
          company: userProfile.company || "",
          education: userProfile.education || "",
          phoneNumber: userProfile.phoneNumber || "",
        });
        setSelectedFileName(userProfile.resumeFileName || null);
        setClientSideResumeText(userProfile.resumeProcessedText || null);
      } else {
        form.reset(form.formState.defaultValues);
        setSelectedFileName(null);
        setClientSideResumeText(null);
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
      setSelectedFileName(null);
      setClientSideResumeText(null);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }

    if (!file) { // User cancelled dialog
      setSelectedFile(null); // Clear any previously selected file for new upload
      // Do not clear existing profile's resume info if user just cancels
      return;
    }

    setIsReadingFile(true);
    setSelectedFile(file); 
    setSelectedFileName(file.name); 
    setClientSideResumeText(""); // Clear previous text for AI

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024*1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null); // Revert to saved name
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert
      setIsReadingFile(false);
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.name} (type: ${file.type || 'unknown'}).`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setSelectedFileName(userProfile?.resumeFileName || null); // Revert
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert
      setIsReadingFile(false);
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, complex layouts might not be fully preserved as text. A plain text (.txt, .md) version is recommended for the most accurate AI processing. The original file will be stored.`,
        duration: 7000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text); // Store extracted text locally
      toast({ title: "Resume File Processed", description: `Text from ${file.name} has been extracted for AI use. Save profile to store the file.`});
      setIsReadingFile(false);
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive"});
        setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert
        setSelectedFileName(userProfile?.resumeFileName || null); // Revert
        setSelectedFile(null);
        setIsReadingFile(false);
    };
    reader.readAsText(file); 
  };

  const clearResume = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (userProfile?.resumeStoragePath) {
        const oldResumeRef = storageRef(storage, userProfile.resumeStoragePath);
        await deleteObject(oldResumeRef);
      }
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        resumeFileName: null,
        resumeFileUrl: null,
        resumeStoragePath: null,
        resumeProcessedText: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setSelectedFile(null);
      setSelectedFileName(null);
      setClientSideResumeText(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
      await refreshUserProfile();
      toast({ title: "Resume Cleared", description: "Resume information has been removed from your profile." });
    } catch (error: any) {
        toast({ title: "Error Clearing Resume", description: error.message || "Could not clear resume.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setIsUploading(false);
    setUploadProgress(null);

    let newResumeData: Partial<UserProfile> = {
      resumeProcessedText: clientSideResumeText, // Use client-side extracted text
    };

    try {
      if (selectedFile) { // New file selected for upload
        setIsUploading(true);

        // Delete old resume from storage if it exists
        if (userProfile?.resumeStoragePath) {
          try {
            const oldFileRef = storageRef(storage, userProfile.resumeStoragePath);
            await deleteObject(oldFileRef);
          } catch (deleteError) {
            console.warn("Could not delete old resume file, continuing:", deleteError);
            // Non-critical, proceed with uploading new one
          }
        }
        
        const filePath = `users/${user.uid}/resumes/${Date.now()}_${selectedFile.name}`;
        const newFileRef = storageRef(storage, filePath);
        const uploadTask = uploadBytesResumable(newFileRef, selectedFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload error:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              newResumeData.resumeFileUrl = downloadURL;
              newResumeData.resumeFileName = selectedFile.name;
              newResumeData.resumeStoragePath = filePath;
              resolve();
            }
          );
        });
        setIsUploading(false);
        setUploadProgress(100); // Mark as complete
      } else if (userProfile) { 
        // No new file, retain existing resume info if not cleared
        newResumeData.resumeFileUrl = userProfile.resumeFileUrl;
        newResumeData.resumeFileName = userProfile.resumeFileName;
        newResumeData.resumeStoragePath = userProfile.resumeStoragePath;
        // newResumeData.resumeProcessedText is already set from clientSideResumeText
      }


      const profileDataToSave: UserProfile = {
        ...userProfile, // spread existing profile data first
        uid: user.uid,
        email: user.email || undefined,
        name: values.name,
        profileField: values.profileField,
        role: values.role,
        company: values.company || undefined,
        education: values.education,
        phoneNumber: values.phoneNumber || undefined,
        ...newResumeData, // override with new/existing resume data
        updatedAt: new Date().toISOString(),
      };
      
      // Ensure optional fields are undefined if empty, not empty strings
      if (profileDataToSave.company === "") profileDataToSave.company = undefined;
      if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined;
      
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile();
      setSelectedFile(null); // Clear selected file after successful save
      // selectedFileName and clientSideResumeText will be updated by useEffect from new userProfile
      setUploadProgress(null);
    } catch (error: any) {
      console.error("Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description: description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const canSubmit = !isSubmitting && !authLoading && !isReadingFile && !isUploading;

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Your Profile</CardTitle>
        <CardDescription>Keep your information up to date to get the best interview experience.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Ada Lovelace" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="profileField" render={({ field }) => (<FormItem><FormLabel>Profile Field</FormLabel><FormControl><Input placeholder="e.g., Software Engineering, Product Management" {...field} /></FormControl><FormDescription>Your primary area of expertise.</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Current or Target Role</FormLabel><FormControl><Input placeholder="e.g., Senior Frontend Developer" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="company" render={({ field }) => (<FormItem><FormLabel>Current or Target Company (Optional)</FormLabel><FormControl><Input placeholder="e.g., Google, Acme Corp" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="education" render={({ field }) => (<FormItem><FormLabel>Education</FormLabel><FormControl><Textarea placeholder="e.g., B.S. in Computer Science from Example University" {...field} /></FormControl><FormDescription>Your highest relevant education.</FormDescription><FormMessage /></FormItem>)} />

            <FormItem>
              <FormLabel>Resume (Optional)</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input 
                    type="file" 
                    ref={fileInputRef}
                    accept={ACCEPT_FILE_EXTENSIONS}
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20"
                    disabled={isReadingFile || isSubmitting || isUploading}
                  />
                </FormControl>
                {(isReadingFile || isUploading) && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text will be extracted for AI question generation.
                Plain text versions (.txt, .md) are best for AI processing. The original file will be stored.
              </FormDescription>
              
              {uploadProgress !== null && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">{uploadProgress < 100 ? `Uploading: ${Math.round(uploadProgress)}%` : "Upload complete!"}</p>
                </div>
              )}

              {selectedFileName && !isUploading && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{selectedFileName} {selectedFile ? "(New file selected)" : (userProfile?.resumeFileUrl ? "(Current resume)" : "")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {userProfile?.resumeFileUrl && !selectedFile && (
                        <Button type="button" variant="outline" size="sm" asChild disabled={isSubmitting}>
                            <a href={userProfile.resumeFileUrl} target="_blank" rel="noopener noreferrer" title="Download current resume">
                                <DownloadCloud className="h-4 w-4" />
                            </a>
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume" disabled={isSubmitting || authLoading || isReadingFile || isUploading || !selectedFileName}>
                        <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
              {/* Display client-extracted text for debugging or user review, could be hidden or shown in a modal */}
              {/* {clientSideResumeText && <Textarea readOnly value={clientSideResumeText.substring(0, 200) + "..."} className="mt-2 h-20 bg-muted/50" />} */}
            </FormItem>

            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            
            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              {(isSubmitting || isReadingFile || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReadingFile ? 'Processing File...' : (isUploading ? 'Uploading Resume...' : (isSubmitting ? 'Saving Profile...' : 'Save Changes'))}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
