
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
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

// Schema now reflects that resume data is handled client-side via localStorage
// and not part of the Firestore submission for the core profile.
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  email: z.string().email({ message: "Please enter a valid email."}).optional(), // Display only, not for submission
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
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

const LOCAL_STORAGE_RESUME_FILENAME_KEY = 'tyaariResumeFileName';
const LOCAL_STORAGE_RESUME_TEXT_KEY = 'tyaariResumeProcessedText';

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  // State for client-side resume handling (localStorage)
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null);
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "", // Will be populated from user.email and be read-only
      profileField: "",
      role: "",
      company: null,
      education: "",
      phoneNumber: null,
    },
  });

  // Load resume info from localStorage on mount
  useEffect(() => {
    console.log("ProfilePage: Attempting to load resume info from localStorage.");
    if (typeof window !== "undefined") {
      const storedFileName = localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
      const storedResumeText = localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
      if (storedFileName) {
        setDisplayedFileName(storedFileName);
        console.log("ProfilePage: Loaded fileName from localStorage:", storedFileName);
      }
      if (storedResumeText) {
        setClientSideResumeText(storedResumeText);
        console.log("ProfilePage: Loaded resumeText from localStorage, length:", storedResumeText.length);
      }
    }
  }, []);

  useEffect(() => {
    console.log("ProfilePage: useEffect for userProfile/user triggered. AuthLoading:", authLoading, "InitialLoading:", initialLoading, "User:", !!user, "UserProfile:", !!userProfile);
    if (!initialLoading && !authLoading && user) {
      form.setValue("email", user.email || ""); // Set read-only email from auth user
      if (userProfile) {
        console.log("ProfilePage: User profile found, resetting form with profile data.", userProfile);
        form.reset({
          name: userProfile.name || "",
          email: user.email || "", // Ensure auth email is used
          profileField: userProfile.profileField || "",
          role: userProfile.role || "",
          company: userProfile.company || null,
          education: userProfile.education || "",
          phoneNumber: userProfile.phoneNumber || null,
        });
      } else {
        // User exists, but no profile yet (e.g., fresh signup redirected here)
        console.log("ProfilePage: User authenticated, but no Firestore profile yet. Resetting to defaults, keeping email.");
        form.reset({
          ...form.formState.defaultValues,
          email: user.email || "", // Keep auth email
          name: user.displayName || "", // Pre-fill name from auth if available
        });
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      console.log("ProfilePage: No user, resetting form and fetching state.");
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("ProfilePage: handleFileChange triggered.");
    const file = event.target.files?.[0];
    
    // Always reset the file input value to allow re-selecting the same file
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }

    if (!file) {
      console.log("ProfilePage: File selection cancelled or no file selected. Not altering localStorage.");
      return; // User cancelled, don't clear localStorage or current display
    }

    console.log("ProfilePage: New file selected:", file.name, "Size:", file.size, "Type:", file.type);
    setIsReadingFile(true);
    // Clear previous display for the new file while it's being processed
    setDisplayedFileName(file.name); // Tentatively set name
    setClientSideResumeText(null);  // Clear old text

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      // Revert display to what's in localStorage, as this upload failed
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
      console.log("ProfilePage: File too large. UI reverted to localStorage state.");
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.name} (type: ${file.type || 'unknown'}). Plain text versions (.txt, .md) are best for AI.`,
        variant: "destructive",
      });
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
      console.log("ProfilePage: Unsupported file type. UI reverted.");
      return;
    }
    
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, text extraction might be incomplete. A plain text (.txt, .md) version is recommended for AI processing.`,
        duration: 8000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClientSideResumeText(text);
      setDisplayedFileName(file.name); // Confirm display name
      localStorage.setItem(LOCAL_STORAGE_RESUME_TEXT_KEY, text);
      localStorage.setItem(LOCAL_STORAGE_RESUME_FILENAME_KEY, file.name);
      toast({ title: "Resume Processed for AI", description: `Text from ${file.name} has been extracted and stored in this browser. It will be used if you start an interview.` });
      setIsReadingFile(false);
      console.log("ProfilePage: File read successfully. Text stored in localStorage. Length:", text?.length);
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive" });
      // Revert display to localStorage state on error
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
      console.log("ProfilePage: File read error. UI reverted.");
    };
    reader.readAsText(file);
  };

  const clearResume = async () => {
    console.log("ProfilePage: clearResume initiated for localStorage.");
    localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
    localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
    setDisplayedFileName(null);
    setClientSideResumeText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({ title: "Resume Cleared", description: "Resume information has been removed from this browser session." });
    console.log("ProfilePage: Resume cleared from localStorage and UI.");
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    // The email from the form (`values.email`) is just for display consistency if needed;
    // the actual email for the UserProfile object should come from `user.email`.
    console.log("ProfilePage: onSubmit triggered. Form Values (excluding resume):", JSON.stringify(values, null, 2));
    
    setIsSubmitting(true);

    try {
      console.log("ProfilePage: Starting profile update process (resume handled by localStorage).");
      
      const profileDataToSave: UserProfile = {
        uid: user.uid,
        email: user.email, // Crucially use the authenticated user's email
        name: values.name,
        profileField: values.profileField,
        role: values.role,
        company: values.company || null,
        education: values.education,
        phoneNumber: values.phoneNumber || null,
        // Resume fields are NOT saved to Firestore in this version
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
      };
      
      console.log("ProfilePage: FINAL data to save to Firestore (NO RESUME DATA):", JSON.stringify(profileDataToSave, null, 2));
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true }); // merge:true is good practice
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
      toast({ title: "Update Failed", description: description, variant: "destructive" });
    } finally {
      console.log("ProfilePage: onSubmit - Reached finally block. Preparing to set isSubmitting to false.");
      setIsSubmitting(false);
      console.log("ProfilePage: onSubmit - isSubmitting has been set to false.");
    }
  };

  const canSubmit = !isSubmitting && !authLoading && !isReadingFile && !isFetchingProfile;

  if (isFetchingProfile || initialLoading || (authLoading && !userProfile && !initialLoading) ) {
     return <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,4rem)-2rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3">Loading profile...</p></div>;
  }


  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Your Profile</CardTitle>
        <CardDescription>Keep your information up to date. Resume text is stored in your browser for AI question generation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Login ID)</FormLabel>
                    <FormControl>
                      <Input placeholder="your-login-email@example.com" {...field} readOnly className="bg-muted/50 cursor-not-allowed" />
                    </FormControl>
                    <FormDescription>Your login email cannot be changed here.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Ada Lovelace" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="profileField" render={({ field }) => (<FormItem><FormLabel>Profile Field</FormLabel><FormControl><Input placeholder="e.g., Software Engineering, Product Management" {...field} /></FormControl><FormDescription>Your primary area of expertise.</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Current or Target Role</FormLabel><FormControl><Input placeholder="e.g., Senior Frontend Developer" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="company" render={({ field }) => (<FormItem><FormLabel>Current or Target Company (Optional)</FormLabel><FormControl><Input placeholder="e.g., Google, Acme Corp" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="education" render={({ field }) => (<FormItem><FormLabel>Education</FormLabel><FormControl><Textarea placeholder="e.g., B.S. in Computer Science from Example University" {...field} /></FormControl><FormDescription>Your highest relevant education.</FormDescription><FormMessage /></FormItem>)} />
             <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +1 555-123-4567 or 0123456789" {...field} value={field.value ?? ""} type="tel" />
                    </FormControl>
                    <FormDescription>Your contact phone number.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormItem>
              <FormLabel>Resume (Optional, processed text stored in browser)</FormLabel>
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
                    disabled={isReadingFile || isSubmitting}
                  />
                </FormControl>
                {isReadingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text will be extracted for AI question generation and stored locally in your browser.
                Plain text versions (.txt, .md) are best for AI processing. PDF/Word text extraction may be incomplete.
              </FormDescription>

              {displayedFileName && !isReadingFile && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>
                      {displayedFileName} (In browser storage)
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume from browser" disabled={isSubmitting || authLoading || isReadingFile || !displayedFileName}>
                      <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </FormItem>

            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              {(isSubmitting || isReadingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReadingFile ? 'Processing File...' : (isSubmitting ? 'Saving Profile...' : 'Save Profile Changes')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
