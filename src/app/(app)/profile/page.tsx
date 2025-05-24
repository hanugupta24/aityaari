
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase"; // Added storage
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"; // Storage imports
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
import { Loader2, FileText, UploadCloud, XCircle, Download } from "lucide-react";
import type { UserProfile } from "@/types";
import { Progress } from "@/components/ui/progress"; // For upload progress

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  
  resumeFileName: z.string().optional().nullable(),
  resumeFileUrl: z.string().url().optional().nullable(),
  resumeStoragePath: z.string().optional().nullable(),
  resumeProcessedText: z.string().optional().nullable(),
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
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores the File object for upload
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null); // For UI display
  const [isProcessingFile, setIsProcessingFile] = useState(false); // For client-side text extraction spinner
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
      resumeFileName: "",
      resumeFileUrl: "",
      resumeStoragePath: "",
      resumeProcessedText: "",
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
          resumeFileName: userProfile.resumeFileName || "",
          resumeFileUrl: userProfile.resumeFileUrl || "",
          resumeStoragePath: userProfile.resumeStoragePath || "",
          resumeProcessedText: userProfile.resumeProcessedText || "",
        });
        setDisplayedFileName(userProfile.resumeFileName || null);
      } else {
        form.reset(form.formState.defaultValues);
        setDisplayedFileName(null);
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
      setDisplayedFileName(null);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (fileInputRef.current) { // Always clear the actual input element's value
        fileInputRef.current.value = "";
    }

    if (!file) { // User cancelled dialog
      setSelectedFile(null); 
      // Do not clear form fields here, they might hold saved data.
      // If user *had* a file selected for upload and then cancels, selectedFile becomes null.
      // If they then save, nothing new gets uploaded regarding the resume.
      // If they had a saved resume, it remains unless cleared explicitly.
      return;
    }

    setIsProcessingFile(true);
    setSelectedFile(file); // Store the File object
    setDisplayedFileName(file.name); // Display new file name immediately
    form.setValue("resumeProcessedText", ""); // Clear previously extracted text

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024*1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null); // Clear invalid file
      setDisplayedFileName(form.getValues("resumeFileName") || null); // Revert to saved file name if any
      setIsProcessingFile(false);
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.name} (type: ${file.type || 'unknown'}).`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setDisplayedFileName(form.getValues("resumeFileName") || null);
      setIsProcessingFile(false);
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, complex layouts might not be fully preserved as text. A plain text (.txt, .md) version is recommended for the most accurate AI processing.`,
        duration: 7000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      form.setValue("resumeProcessedText", text, { shouldValidate: true });
      toast({ title: "Resume Content Processed", description: `Text from ${file.name} has been processed for AI use.`});
      setIsProcessingFile(false);
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        toast({ title: "File Read Error", description: "Could not read the resume file content for AI processing.", variant: "destructive"});
        form.setValue("resumeProcessedText", ""); // Clear if read fails
        setIsProcessingFile(false);
    };
    reader.readAsText(file); 
  };

  const clearResume = async () => {
    if (!user) return;
    setIsSubmitting(true); // Use submitting state to disable buttons
    const currentStoragePath = form.getValues("resumeStoragePath");

    if (currentStoragePath) {
      try {
        const fileRef = storageRef(storage, currentStoragePath);
        await deleteObject(fileRef);
        toast({ title: "Resume Deleted", description: "Previous resume file removed from storage." });
      } catch (error: any) {
        console.error("Error deleting old resume from storage:", error);
        toast({ title: "Storage Error", description: `Could not delete previous resume: ${error.message}`, variant: "destructive" });
        // Do not halt, attempt to clear DB fields anyway
      }
    }

    form.setValue("resumeFileName", "");
    form.setValue("resumeFileUrl", "");
    form.setValue("resumeStoragePath", "");
    form.setValue("resumeProcessedText", "");
    
    setSelectedFile(null);
    setDisplayedFileName(null);

    // Directly update Firestore to clear resume fields
    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            resumeFileName: null,
            resumeFileUrl: null,
            resumeStoragePath: null,
            resumeProcessedText: null,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        await refreshUserProfile();
        toast({ title: "Resume Cleared", description: "Resume information has been removed." });
    } catch (error: any) {
        toast({ title: "Update Error", description: `Failed to clear resume from profile: ${error.message}`, variant: "destructive"});
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
    setUploadProgress(null);

    let newResumeData: Partial<UserProfile> = {};

    if (selectedFile) { // A new file was selected for upload
      setIsUploading(true);
      const oldStoragePath = userProfile?.resumeStoragePath; // Path of the file currently in DB
      if (oldStoragePath) {
        try {
          const oldFileRef = storageRef(storage, oldStoragePath);
          await deleteObject(oldFileRef);
          console.log("Old resume deleted from storage:", oldStoragePath);
        } catch (error: any) {
          // Log error but continue, user might be trying to replace a non-existent/broken link file
          console.error("Error deleting old resume from storage (continuing upload):", error);
        }
      }

      const filePath = `users/${user.uid}/resumes/${selectedFile.name}`;
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, selectedFile);

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload error:", error);
              toast({ title: "Upload Failed", description: `Could not upload resume: ${error.message}`, variant: "destructive" });
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              newResumeData = {
                resumeFileName: selectedFile.name,
                resumeFileUrl: downloadURL,
                resumeStoragePath: filePath,
                // resumeProcessedText is already in 'values' from client-side extraction
              };
              resolve();
            }
          );
        });
      } catch (error) { // Catch error from the promise new Promise created
        setIsSubmitting(false);
        setIsUploading(false);
        setUploadProgress(null);
        return; // Stop submission if upload fails
      }
    } else {
      // No new file selected, keep existing resumeProcessedText from form (if any)
      // If user cleared via UI but didn't save, selectedFile is null.
      // If `values` contains old URLs, they will be saved. If they were cleared by `clearResume` they won't.
    }
    
    // Merge form values (which include client-extracted resumeProcessedText) 
    // with newResumeData (from file upload)
    const profileDataToSave: UserProfile = {
      ...userProfile, // Start with existing profile to ensure fields not in form are preserved
      uid: user.uid,
      email: user.email || undefined,
      name: values.name,
      profileField: values.profileField,
      role: values.role,
      company: values.company || undefined,
      education: values.education,
      phoneNumber: values.phoneNumber || undefined,
      
      // Apply new file data if a file was uploaded, otherwise values from form (could be nullified by clearResume)
      resumeFileName: selectedFile ? newResumeData.resumeFileName : values.resumeFileName,
      resumeFileUrl: selectedFile ? newResumeData.resumeFileUrl : values.resumeFileUrl,
      resumeStoragePath: selectedFile ? newResumeData.resumeStoragePath : values.resumeStoragePath,
      resumeProcessedText: values.resumeProcessedText || undefined, // ensure it's undefined if empty

      updatedAt: new Date().toISOString(),
    };
    
    // Ensure optional fields are set to undefined if empty string, rather than empty string
    if (profileDataToSave.company === "") profileDataToSave.company = undefined;
    if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined;


    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile(); 
      setSelectedFile(null); // Clear selected file after successful save & upload
      // displayedFileName is already updated via userProfile effect or handleFileChange
    } catch (error: any) {
      console.error("Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description: description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const currentResumeUrl = form.watch("resumeFileUrl");
  const currentResumeFileNameForDisplay = displayedFileName || form.watch("resumeFileName");


  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Your Profile</CardTitle>
        <CardDescription>Keep your information up to date to get the best interview experience.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Other form fields remain the same */}
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
                    disabled={isProcessingFile || isSubmitting || isUploading}
                  />
                </FormControl>
                {isProcessingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text will be extracted for AI.
                Plain text versions (.txt, .md) are best for AI processing.
              </FormDescription>
              
              {isUploading && uploadProgress !== null && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-sm text-muted-foreground text-center">{Math.round(uploadProgress)}% uploaded</p>
                </div>
              )}

              {currentResumeFileNameForDisplay && !isProcessingFile && !isUploading && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{currentResumeFileNameForDisplay}</span>
                      {currentResumeUrl && (
                        <a href={currentResumeUrl} target="_blank" rel="noopener noreferrer" title="Download saved resume">
                            <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                        </a>
                      )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear and remove resume" disabled={isSubmitting || authLoading || isProcessingFile || isUploading}>
                      <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
              {/* Hidden inputs for schema compliance, values managed by logic */}
              <FormField control={form.control} name="resumeFileName" render={({ field }) => <Input type="hidden" {...field} value={field.value ?? ""} />} />
              <FormField control={form.control} name="resumeFileUrl" render={({ field }) => <Input type="hidden" {...field} value={field.value ?? ""} />} />
              <FormField control={form.control} name="resumeStoragePath" render={({ field }) => <Input type="hidden" {...field} value={field.value ?? ""} />} />
              <FormField control={form.control} name="resumeProcessedText" render={({ field }) => <Input type="hidden" {...field} value={field.value ?? ""} />} />
              <FormMessage />
            </FormItem>

            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            
            <Button type="submit" disabled={isSubmitting || authLoading || isProcessingFile || isUploading} className="w-full sm:w-auto">
              {(isSubmitting || isProcessingFile || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUploading ? 'Uploading...' : (isSubmitting ? 'Saving...' : 'Save Changes')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
