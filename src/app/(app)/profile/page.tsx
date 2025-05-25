
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, UploadCloud, XCircle, DownloadCloud } from "lucide-react";
import type { UserProfile } from "@/types";
import { Progress } from "@/components/ui/progress";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  // Resume related fields, values will be set programmatically before saving to Firestore
  resumeFileName: z.string().optional().nullable(),
  resumeFileUrl: z.string().url().optional().nullable(),
  resumeStoragePath: z.string().optional().nullable(),
  resumeProcessedText: z.string().optional().nullable(), // Text extracted from resume for AI
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

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
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null);
  // This state holds the text extracted from the resume, either from a new upload or from the loaded profile.
  // It's the source of truth for what the AI will see if the profile is saved.
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null);
  
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      profileField: "",
      role: "",
      company: null,
      education: "",
      phoneNumber: null,
      resumeFileName: null,
      resumeFileUrl: null,
      resumeStoragePath: null,
      resumeProcessedText: null,
    },
  });

  useEffect(() => {
    console.log("ProfilePage: useEffect for userProfile triggered. AuthLoading:", authLoading, "InitialLoading:", initialLoading, "User:", !!user);
    if (!initialLoading && !authLoading && user) {
      if (userProfile) {
        console.log("ProfilePage: User profile found, resetting form.", userProfile);
        form.reset({
          name: userProfile.name || "",
          profileField: userProfile.profileField || "",
          role: userProfile.role || "",
          company: userProfile.company || null,
          education: userProfile.education || "",
          phoneNumber: userProfile.phoneNumber || null,
          resumeFileName: userProfile.resumeFileName || null,
          resumeFileUrl: userProfile.resumeFileUrl || null,
          resumeStoragePath: userProfile.resumeStoragePath || null,
          resumeProcessedText: userProfile.resumeProcessedText || null,
        });
        setDisplayedFileName(userProfile.resumeFileName || null);
        setClientSideResumeText(userProfile.resumeProcessedText || null); // Populate client-side text from profile
      } else {
        console.log("ProfilePage: No user profile found, resetting to defaults.");
        form.reset(form.formState.defaultValues);
        setDisplayedFileName(null);
        setClientSideResumeText(null); // Clear client-side text
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      console.log("ProfilePage: No user, resetting form and fetching state.");
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
      setDisplayedFileName(null);
      setClientSideResumeText(null);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("ProfilePage: handleFileChange triggered.");

    if (!file) {
      console.log("ProfilePage: File selection cancelled by user or no file selected. Resetting file input value only.");
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Allow re-selecting the same file
      }
      // Do not clear existing resume data from form/state if user just cancelled.
      return;
    }

    console.log("ProfilePage: New file selected:", file.name, "Size:", file.size, "Type:", file.type);
    setIsReadingFile(true);
    setSelectedFile(file); // Store the file object for potential upload
    
    // Clear previous client-side extracted text and displayed name for the new file
    setClientSideResumeText(null); 
    setDisplayedFileName(file.name); // Tentatively set file name for display
    form.setValue("resumeProcessedText", null); // Clear in form as well
    setUploadProgress(null); // Reset progress for new selection

    const currentFormValues = form.getValues();

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setClientSideResumeText(currentFormValues.resumeProcessedText); // Revert to existing form value
      setDisplayedFileName(currentFormValues.resumeFileName); // Revert to existing form value
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: File too large. Reverted UI to reflect current profile state.");
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.name} (type: ${file.type || 'unknown'}).`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setClientSideResumeText(currentFormValues.resumeProcessedText); // Revert
      setDisplayedFileName(currentFormValues.resumeFileName); // Revert
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: Unsupported file type. Reverted UI.");
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, text extraction might be incomplete. A plain text (.txt, .md) version is recommended for AI processing. The original file will still be stored.`,
        duration: 8000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text); 
      form.setValue("resumeProcessedText", text, { shouldValidate: true }); // Update form as well
      setDisplayedFileName(file.name); // Confirm display name
      toast({ title: "Resume File Processed", description: `Text from ${file.name} has been extracted for AI use. Click 'Save Changes' to upload the file and update your profile.` });
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear to allow re-selection of same file
      console.log("ProfilePage: File read successfully. Text extracted length:", text?.length);
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive" });
      setClientSideResumeText(currentFormValues.resumeProcessedText); // Revert
      setDisplayedFileName(currentFormValues.resumeFileName); // Revert
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: File read error. Reverted UI.");
    };
    reader.readAsText(file);
  };

  const clearResume = async () => {
    if (!user) return;
    console.log("ProfilePage: clearResume initiated.");
    setIsSubmitting(true); 
    try {
      const currentStoragePath = form.getValues("resumeStoragePath");
      if (currentStoragePath) {
        console.log("ProfilePage: Deleting old resume from storage:", currentStoragePath);
        const oldResumeRef = storageRef(storage, currentStoragePath);
        await deleteObject(oldResumeRef);
        console.log("ProfilePage: Old resume deleted from storage.");
      }
      
      const profileDataToClearResume: Partial<UserProfile> = {
        resumeFileName: null,
        resumeFileUrl: null,
        resumeStoragePath: null,
        resumeProcessedText: null,
        updatedAt: new Date().toISOString(),
      };

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToClearResume, { merge: true });
      console.log("ProfilePage: Firestore profile updated to clear resume fields.");

      setSelectedFile(null);
      setDisplayedFileName(null);
      setClientSideResumeText(null);
      
      // Reset form fields related to resume
      form.reset({
        ...form.getValues(), 
        resumeFileName: null,
        resumeFileUrl: null,
        resumeStoragePath: null,
        resumeProcessedText: null,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      refreshUserProfile().then(() => {
        console.log("ProfilePage: User profile refreshed after clearing resume.");
      }).catch(err => {
        console.error("ProfilePage: Error refreshing user profile after clearing resume:", err);
      });
      toast({ title: "Resume Cleared", description: "Resume information has been removed from your profile." });
    } catch (error: any) {
      console.error("ProfilePage: Error Clearing Resume:", error);
      toast({ title: "Error Clearing Resume", description: error.message || "Could not clear resume.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      console.log("ProfilePage: clearResume finished.");
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    console.log("ProfilePage: onSubmit triggered. Form Values (from form.handleSubmit):", JSON.stringify(values, null, 2));
    console.log("ProfilePage: Current selectedFile:", selectedFile?.name);
    console.log("ProfilePage: Current clientSideResumeText length:", clientSideResumeText?.length);

    setIsSubmitting(true);
    setIsUploading(false); // Reset uploading state initially
    setUploadProgress(null);

    // This object will hold the resume-related data to be merged into the profile
    let finalResumeData: {
        resumeFileName: string | null;
        resumeFileUrl: string | null;
        resumeStoragePath: string | null;
        resumeProcessedText: string | null;
    } = {
        resumeFileName: values.resumeFileName, // from loaded profile or if user cleared via input
        resumeFileUrl: values.resumeFileUrl,
        resumeStoragePath: values.resumeStoragePath,
        resumeProcessedText: clientSideResumeText, // Always use the up-to-date clientSideResumeText
    };

    try {
      console.log("ProfilePage: Starting profile update process.");
      if (selectedFile) { 
        console.log("ProfilePage: New resume file selected, starting upload:", selectedFile.name);
        setIsUploading(true);
        setUploadProgress(0);

        const oldStoragePath = form.getValues("resumeStoragePath"); // Use form's current value for old path
        if (oldStoragePath) {
          try {
            console.log("ProfilePage: Deleting existing resume from storage:", oldStoragePath);
            const oldFileRef = storageRef(storage, oldStoragePath);
            await deleteObject(oldFileRef);
            console.log("ProfilePage: Existing resume deleted successfully.");
          } catch (deleteError: any) {
            console.warn("ProfilePage: Could not delete old resume file, continuing. Error:", deleteError.message);
          }
        }

        const filePath = `users/${user.uid}/resumes/${Date.now()}_${selectedFile.name}`;
        const newFileRef = storageRef(storage, filePath);
        const uploadTask = uploadBytesResumable(newFileRef, selectedFile);
        console.log("ProfilePage: Upload task created for path:", filePath);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("ProfilePage: Upload progress:", progress);
              setUploadProgress(progress);
            },
            (error) => {
              console.error("ProfilePage: Upload error in listener:", error);
              toast({ title: "Resume Upload Failed", description: error.message || "Could not upload the resume file.", variant: "destructive" });
              reject(error); 
            },
            async () => { 
              try {
                console.log("ProfilePage: Upload complete. Getting download URL.");
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("ProfilePage: Download URL obtained:", downloadURL);
                
                finalResumeData.resumeFileUrl = downloadURL;
                finalResumeData.resumeFileName = selectedFile.name; 
                finalResumeData.resumeStoragePath = filePath;
                // finalResumeData.resumeProcessedText is already sourced from clientSideResumeText
                                
                setUploadProgress(100); 
                resolve();
              } catch (urlError) {
                console.error("ProfilePage: Error getting download URL:", urlError);
                toast({ title: "Resume URL Error", description: (urlError as Error).message || "Could not get resume URL after upload.", variant: "destructive" });
                reject(urlError);
              }
            }
          );
        });
        console.log("ProfilePage: Resume file upload promise resolved/rejected.");
        setIsUploading(false); // Upload process finished (success or fail via catch)
      } else {
         // No new file selected. Check if the resume was meant to be cleared.
         // clientSideResumeText and displayedFileName are the sources of truth here if no new file is selected.
         if (!displayedFileName && !clientSideResumeText) { 
            // This implies user action to clear the resume (e.g., via clearResume button or by selecting then cancelling and no prior resume)
            console.log("ProfilePage: No new file and no displayedFileName/clientSideResumeText. Ensuring resume fields are null.");
            finalResumeData.resumeFileName = null;
            finalResumeData.resumeFileUrl = null;
            finalResumeData.resumeStoragePath = null;
            finalResumeData.resumeProcessedText = null;
        } else {
            // Retain existing resume file info if a file was not cleared and no new one was selected
            // finalResumeData is already initialized with form values or updated clientSideResumeText
             console.log("ProfilePage: No new file selected. Retaining existing or client-side processed resume text.");
        }
      }

      console.log("ProfilePage: Assembling final profile data to save. Resume data part:", JSON.stringify(finalResumeData, null, 2));
      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: user.email || userProfile?.email || undefined,
        name: values.name,
        profileField: values.profileField,
        role: values.role,
        company: values.company || null,
        education: values.education,
        phoneNumber: values.phoneNumber || null,
        
        resumeFileName: finalResumeData.resumeFileName,
        resumeFileUrl: finalResumeData.resumeFileUrl,
        resumeStoragePath: finalResumeData.resumeStoragePath,
        resumeProcessedText: finalResumeData.resumeProcessedText, // This is the text for AI

        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        isAdmin: userProfile?.isAdmin || false,
      };
      
      console.log("ProfilePage: FINAL data to save to Firestore:", JSON.stringify(profileDataToSave, null, 2));
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      console.log("ProfilePage: Profile data successfully saved to Firestore.");

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      
      // Refresh profile data in context, but don't let it block UI
      refreshUserProfile().then(() => {
        console.log("ProfilePage: User profile refreshed in context after save.");
      }).catch(err => {
        console.error("ProfilePage: Error refreshing user profile in context after save:", err);
      });
      
      setSelectedFile(null); 
      // displayedFileName and clientSideResumeText will be updated by useEffect from new userProfile
      if (fileInputRef.current) {
         fileInputRef.current.value = ""; 
      }

    } catch (error: any) { 
      console.error("ProfilePage: onSubmit - Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description: description, variant: "destructive" });
      setUploadProgress(null); // Clear progress on error
    } finally {
      setIsUploading(false); // Ensure this is reset
      console.log("ProfilePage: onSubmit - Reached finally block. Preparing to set isSubmitting to false.");
      setIsSubmitting(false);
      console.log("ProfilePage: onSubmit - isSubmitting has been set to false.");
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
                {(isReadingFile && !isUploading) && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text will be extracted for AI question generation.
                Plain text versions (.txt, .md) are best for AI processing. The original file will be stored.
              </FormDescription>

              {uploadProgress !== null && isUploading && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadProgress === 0 ? (
                        "Starting upload..."
                    ) : uploadProgress < 100 ? (
                      `Uploading: ${Math.round(uploadProgress)}%`
                    ) : (
                      "Upload complete! Processing..."
                    )}
                  </p>
                </div>
              )}

              {displayedFileName && !isUploading && !isReadingFile && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>
                      {displayedFileName}
                      {selectedFile ? " (New file selected, pending save)" : (form.getValues("resumeFileUrl") ? " (Current resume)" : "")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {form.getValues("resumeFileUrl") && !selectedFile && ( // Show download only if there's a saved URL and no new file selected
                      <Button type="button" variant="outline" size="sm" asChild disabled={isSubmitting || isReadingFile || isUploading}>
                        <a href={form.getValues("resumeFileUrl")!} target="_blank" rel="noopener noreferrer" title="Download current resume">
                          <DownloadCloud className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume" disabled={isSubmitting || authLoading || isReadingFile || isUploading || (!displayedFileName && !form.getValues("resumeFileName")) }>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </FormItem>

            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />

            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              {(isSubmitting || (isReadingFile && !isUploading) || isUploading ) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReadingFile && !isUploading ? 'Processing File...' : (isUploading ? 'Uploading Resume...' : (isSubmitting ? 'Saving Profile...' : 'Save Changes'))}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


    