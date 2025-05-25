
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

// Updated schema to include new resume fields
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  resumeFileName: z.string().optional().nullable(),
  resumeFileUrl: z.string().url().optional().nullable(),
  resumeStoragePath: z.string().optional().nullable(),
  resumeProcessedText: z.string().optional().nullable(), // No specific client-side length validation here
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
  // This state is for displaying the name in the UI. It's updated from userProfile on load, or by file selection.
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null); 
  // This state holds the text extracted on client-side, to be saved if profile is submitted.
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
      company: "",
      education: "",
      phoneNumber: "",
      resumeFileName: "",
      resumeFileUrl: "",
      resumeStoragePath: "",
      resumeProcessedText: "",
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
          company: userProfile.company || "",
          education: userProfile.education || "",
          phoneNumber: userProfile.phoneNumber || "",
          resumeFileName: userProfile.resumeFileName || "",
          resumeFileUrl: userProfile.resumeFileUrl || "",
          resumeStoragePath: userProfile.resumeStoragePath || "",
          resumeProcessedText: userProfile.resumeProcessedText || "",
        });
        setDisplayedFileName(userProfile.resumeFileName || null);
        setClientSideResumeText(userProfile.resumeProcessedText || null);
      } else {
        console.log("ProfilePage: No user profile found, resetting to defaults.");
        form.reset(form.formState.defaultValues);
        setDisplayedFileName(null);
        setClientSideResumeText(null);
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

    // Clear previous file input visually to allow re-selecting the same file
    if (fileInputRef.current && !file) { // User cancelled dialog
        console.log("ProfilePage: File selection cancelled by user.");
        fileInputRef.current.value = ""; 
        // Do not clear existing form data or displayedFileName if user just cancels
        return;
    }
    
    if (!file) {
      console.log("ProfilePage: No file selected in handleFileChange.");
      return; // Should not happen if the above check is done
    }

    console.log("ProfilePage: New file selected:", file.name, "Size:", file.size, "Type:", file.type);
    setIsReadingFile(true);
    setSelectedFile(file); // Store the file object for potential upload
    setDisplayedFileName(file.name); // Tentatively set file name for display
    setClientSideResumeText(""); // Clear previous client-side extracted text
    form.setValue("resumeProcessedText", ""); // Clear in form as well
    setUploadProgress(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setDisplayedFileName(userProfile?.resumeFileName || null); // Revert to saved name
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert to saved text
      form.setValue("resumeProcessedText", userProfile?.resumeProcessedText || "");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: File too large. Reverted UI.");
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.name} (type: ${file.type || 'unknown'}).`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setDisplayedFileName(userProfile?.resumeFileName || null); // Revert
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert
      form.setValue("resumeProcessedText", userProfile?.resumeProcessedText || "");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: Unsupported file type. Reverted UI.");
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, text extraction might be incomplete or garbled. A plain text (.txt, .md) version is recommended for the most accurate AI processing. The original file will be stored.`,
        duration: 8000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text); // Update local state for AI
      form.setValue("resumeProcessedText", text, { shouldValidate: true }); // Update form state
      setDisplayedFileName(file.name); // Confirm file name on successful read
      toast({ title: "Resume File Processed", description: `Text from ${file.name} has been extracted for AI use. Save profile to store the file.` });
      setIsReadingFile(false);
      console.log("ProfilePage: File read successfully. Text extracted length:", text?.length);
      // Do not clear fileInputRef.current.value here, as the file is "staged" via selectedFile state.
      // It will be cleared after successful form submission.
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive" });
      setClientSideResumeText(userProfile?.resumeProcessedText || null); // Revert
      form.setValue("resumeProcessedText", userProfile?.resumeProcessedText || "");
      setDisplayedFileName(userProfile?.resumeFileName || null); // Revert
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsReadingFile(false);
      console.log("ProfilePage: File read error. Reverted UI.");
    };
    reader.readAsText(file); // Attempt to read as text
  };

  const clearResume = async () => {
    if (!user) return;
    console.log("ProfilePage: clearResume initiated.");
    setIsSubmitting(true);
    try {
      if (form.getValues("resumeStoragePath")) {
        console.log("ProfilePage: Deleting old resume from storage:", form.getValues("resumeStoragePath"));
        const oldResumeRef = storageRef(storage, form.getValues("resumeStoragePath")!);
        await deleteObject(oldResumeRef);
        console.log("ProfilePage: Old resume deleted from storage.");
      }
      
      const updatedProfileData: Partial<UserProfile> = {
        resumeFileName: undefined, // Using undefined to remove field in Firestore merge
        resumeFileUrl: undefined,
        resumeStoragePath: undefined,
        resumeProcessedText: undefined,
        updatedAt: new Date().toISOString(),
      };

      const userDocRef = doc(db, "users", user.uid);
      // Merge with undefined to remove fields, or set specific fields to null
      await setDoc(userDocRef, {
        resumeFileName: null,
        resumeFileUrl: null,
        resumeStoragePath: null,
        resumeProcessedText: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log("ProfilePage: Firestore profile updated to clear resume fields.");

      setSelectedFile(null);
      setDisplayedFileName(null);
      setClientSideResumeText(null);
      // Reset form fields related to resume
      form.reset({
        ...form.getValues(), // keep other form values
        resumeFileName: "",
        resumeFileUrl: "",
        resumeStoragePath: "",
        resumeProcessedText: "",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshUserProfile();
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
    console.log("ProfilePage: onSubmit triggered. Form Values:", values);
    console.log("ProfilePage: Current selectedFile:", selectedFile?.name);
    console.log("ProfilePage: Current clientSideResumeText length:", clientSideResumeText?.length);

    setIsSubmitting(true);
    setUploadProgress(null); // Reset progress for new submission

    let newResumeData: Partial<UserProfile> = {
      resumeProcessedText: clientSideResumeText || undefined, // Use the state that holds client-extracted text
    };

    try {
      console.log("ProfilePage: Starting profile update process.");
      if (selectedFile) { // New file selected for upload
        console.log("ProfilePage: New resume file selected, starting upload:", selectedFile.name);
        setIsUploading(true);
        setUploadProgress(0);

        const oldStoragePath = form.getValues("resumeStoragePath");
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
              reject(error);
            },
            async () => {
              try {
                console.log("ProfilePage: Upload complete. Getting download URL.");
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("ProfilePage: Download URL obtained:", downloadURL);
                newResumeData.resumeFileUrl = downloadURL;
                newResumeData.resumeFileName = selectedFile.name; // Use the name of the currently selected file
                newResumeData.resumeStoragePath = filePath;
                // resumeProcessedText is already in newResumeData from clientSideResumeText
                setUploadProgress(100); 
                resolve();
              } catch (urlError) {
                console.error("ProfilePage: Error getting download URL:", urlError);
                reject(urlError);
              }
            }
          );
        });
        console.log("ProfilePage: Resume file upload process completed.");
      } else {
        console.log("ProfilePage: No new resume file selected. Retaining existing resume info if any from form values.");
        newResumeData.resumeFileUrl = values.resumeFileUrl || undefined;
        newResumeData.resumeFileName = values.resumeFileName || undefined;
        newResumeData.resumeStoragePath = values.resumeStoragePath || undefined;
        // newResumeData.resumeProcessedText is already set from clientSideResumeText
      }

      console.log("ProfilePage: Assembling final profile data to save.");
      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: user.email || userProfile?.email || undefined,
        name: values.name,
        profileField: values.profileField,
        role: values.role,
        company: values.company || undefined,
        education: values.education,
        phoneNumber: values.phoneNumber || undefined,
        ...newResumeData, // This includes resumeFileName, resumeFileUrl, resumeStoragePath, resumeProcessedText
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        isAdmin: userProfile?.isAdmin || false,
      };
      
      console.log("ProfilePage: Saving profile data to Firestore:", JSON.stringify(profileDataToSave, null, 2));
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      console.log("ProfilePage: Profile data successfully saved to Firestore.");

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      
      console.log("ProfilePage: Refreshing user profile from AuthContext.");
      await refreshUserProfile(); // This should update userProfile, triggering useEffect to reset form and displayedFileName
      console.log("ProfilePage: User profile refreshed.");

      setSelectedFile(null); // Clear selected file object after successful save
      // displayedFileName and clientSideResumeText will be updated by useEffect from new userProfile
      
      if (fileInputRef.current) {
         fileInputRef.current.value = ""; // Clear file input
      }

    } catch (error: any) {
      console.error("ProfilePage: onSubmit - Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description: description, variant: "destructive" });
      setUploadProgress(null);
    } finally {
      console.log("ProfilePage: onSubmit - finally block. Setting isSubmitting and isUploading to false.");
      setIsUploading(false); // Ensure uploading is false after attempt
      setIsSubmitting(false);
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

              {uploadProgress !== null && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {isUploading && uploadProgress === 0 ? (
                      "Starting upload..."
                    ) : uploadProgress < 100 ? (
                      `Uploading: ${Math.round(uploadProgress)}%`
                    ) : uploadProgress === 100 && !isSubmitting ? (
                      "Upload complete!"
                    ) : isSubmitting && isUploading && uploadProgress === 100 ? (
                      `Upload: ${Math.round(uploadProgress)}%`
                    ) : (
                      isSubmitting ? "Processing..." : "" 
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
                      {selectedFile ? " (New file selected)" : (form.getValues("resumeFileUrl") ? " (Current resume)" : "")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {form.getValues("resumeFileUrl") && !selectedFile && (
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
              {(isSubmitting || isReadingFile || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReadingFile ? 'Processing File...' : (isUploading ? 'Uploading Resume...' : (isSubmitting ? 'Saving Profile...' : 'Save Changes'))}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    

    