
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


const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  // Email is optional in the schema if it can be null (for phone-only signups)
  email: z.string().email({ message: "Please enter a valid email."}).optional().nullable().or(z.literal('')),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  // Phone number is submitted with the form, can be empty or have a value
  phoneNumber: z.string().max(20).optional().nullable().or(z.literal('')),
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

  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null);
  const [clientSideResumeText, setClientSideResumeText] = useState<string | null>(null); // Holds text from localStorage or current upload for AI
  const [isReadingFile, setIsReadingFile] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "", // Will be populated from user.email (if exists) and be read-only
      profileField: "",
      role: "",
      company: null,
      education: "",
      phoneNumber: "", // Updated from user.phoneNumber or editable
    },
  });

  useEffect(() => {
    console.log("ProfilePage: Attempting to load resume info from localStorage.");
    if (typeof window !== "undefined") {
      const storedFileName = localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
      const storedResumeText = localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
      if (storedFileName) {
        setDisplayedFileName(storedFileName);
      }
      if (storedResumeText) {
        setClientSideResumeText(storedResumeText);
      }
    }
  }, []);

  useEffect(() => {
    console.log("ProfilePage: useEffect for userProfile/user triggered. AuthLoading:", authLoading, "InitialLoading:", initialLoading, "User:", !!user, "UserProfile:", !!userProfile);
    if (!initialLoading && !authLoading && user) {
      // Email is from Firebase Auth user object and is read-only for display
      // Phone number can be from Firebase Auth (if phone signup) or from Firestore profile
      const initialEmail = user.email || ""; // Firebase Auth email can be null
      const initialPhoneNumber = user.phoneNumber || userProfile?.phoneNumber || "";

      if (userProfile) {
        console.log("ProfilePage: User profile found, resetting form with profile data.", userProfile);
        form.reset({
          name: userProfile.name || user.displayName || "",
          email: initialEmail, // Display user.email, make it read-only if it's the primary auth
          profileField: userProfile.profileField || "",
          role: userProfile.role || "",
          company: userProfile.company || null,
          education: userProfile.education || "",
          phoneNumber: initialPhoneNumber,
        });
      } else {
        console.log("ProfilePage: User authenticated, but no Firestore profile yet. Resetting to defaults.");
        form.reset({
          ...form.formState.defaultValues,
          name: user.displayName || "",
          email: initialEmail,
          phoneNumber: initialPhoneNumber,
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
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = ""; // Allow re-selecting same file

    if (!file) { // User cancelled file selection
        console.log("ProfilePage: File selection cancelled.");
        // Do not clear existing loaded/saved resume from localStorage or state here
        return;
    }
    
    console.log("ProfilePage: New file selected:", file.name);
    setIsReadingFile(true);
    // Immediately clear previous local states for the new file
    setDisplayedFileName(null); 
    setClientSideResumeText(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive"});
      // Revert display to what's in localStorage if any
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPT_FILE_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast({ title: "Unsupported File Type", description: `Please use ${ACCEPT_FILE_EXTENSIONS}. Plain text (.txt, .md) is best for AI.`, variant: "destructive" });
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
      return;
    }
    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({ title: "File Type Notice", description: `Attempting to extract text. For PDF/Word, text extraction might be incomplete. A plain text version is recommended.`, duration: 7000 });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      localStorage.setItem(LOCAL_STORAGE_RESUME_TEXT_KEY, text);
      localStorage.setItem(LOCAL_STORAGE_RESUME_FILENAME_KEY, file.name);
      setClientSideResumeText(text); // For AI use
      setDisplayedFileName(file.name); // For UI
      toast({ title: "Resume Processed for AI", description: `Text from ${file.name} stored in browser.` });
      setIsReadingFile(false);
    };
    reader.onerror = (errorEvent) => {
      console.error("ProfilePage: Error reading file:", errorEvent);
      toast({ title: "File Read Error", description: "Could not read resume content.", variant: "destructive" });
      setDisplayedFileName(localStorage.getItem(LOCAL_STORAGE_RESUME_FILENAME_KEY));
      setClientSideResumeText(localStorage.getItem(LOCAL_STORAGE_RESUME_TEXT_KEY));
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  const clearResume = () => {
    console.log("ProfilePage: clearResume initiated for localStorage.");
    localStorage.removeItem(LOCAL_STORAGE_RESUME_FILENAME_KEY);
    localStorage.removeItem(LOCAL_STORAGE_RESUME_TEXT_KEY);
    setDisplayedFileName(null);
    setClientSideResumeText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({ title: "Resume Cleared", description: "Resume removed from browser storage." });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    console.log("ProfilePage: onSubmit triggered. Form Values:", JSON.stringify(values, null, 2));
    setIsSubmitting(true);

    try {
      const profileDataToSave: UserProfile = {
        uid: user.uid,
        // Email in Firestore profile can be different from auth email if user changes it here,
        // but primary login email is user.email from auth.
        // If user signed up with phone, user.email might be null. In that case, values.email is what they entered.
        email: values.email || user.email || null, 
        name: values.name,
        profileField: values.profileField,
        role: values.role,
        company: values.company || null,
        education: values.education,
        phoneNumber: values.phoneNumber || user.phoneNumber || null, // Prioritize form input, then auth phone
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interviewsTaken: userProfile?.interviewsTaken || 0,
        isPlusSubscriber: userProfile?.isPlusSubscriber || false,
        subscriptionPlan: userProfile?.subscriptionPlan || null,
        isAdmin: userProfile?.isAdmin || false,
        // No resume fields saved to Firestore
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
      toast({ title: "Update Failed", description: description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !isSubmitting && !authLoading && !isReadingFile && !isFetchingProfile;
  const isEmailFromAuthProvider = !!user?.email; // Check if email comes from Firebase Auth (not null)

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
                    <FormLabel>{isEmailFromAuthProvider ? "Email (Login ID)" : "Email (Optional, add to link account)"}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={isEmailFromAuthProvider ? "your-login-email@example.com" : "you@example.com"} 
                        {...field} 
                        value={field.value ?? ""}
                        readOnly={isEmailFromAuthProvider} // Read-only if it's the primary auth email
                        className={isEmailFromAuthProvider ? "bg-muted/50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEmailFromAuthProvider 
                        ? "Your login email cannot be changed here." 
                        : "Add an email to your account. This will not change your phone login method."}
                    </FormDescription>
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
                    <FormLabel>Phone Number {user?.phoneNumber ? "(Login ID)" : "(Optional)"}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., +15551234567" 
                        {...field} 
                        value={field.value ?? ""} 
                        type="tel"
                        readOnly={!!user?.phoneNumber} // Read-only if it's the primary auth phone
                        className={!!user?.phoneNumber ? "bg-muted/50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    <FormDescription>
                      {user?.phoneNumber 
                        ? "Your login phone number cannot be changed here." 
                        : "Your contact phone number."}
                    </FormDescription>
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
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isReadingFile || isSubmitting}
                  />
                </FormControl>
                {isReadingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text stored locally in browser for AI.
                Plain text versions (.txt, .md) are best for AI processing.
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

    