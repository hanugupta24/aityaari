
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase"; // storage removed
import { doc, setDoc, getDoc } from "firebase/firestore";
// Firebase Storage imports removed
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
import { Loader2, FileText, UploadCloud, XCircle } from "lucide-react";
import type { UserProfile } from "@/types";
// Progress import removed as no upload progress to show

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  // Resume fields removed from Zod schema as they are not part of Firestore submission
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

// localStorage keys
const LS_RESUME_TEXT_KEY = 'tyaariResumeProcessedText';
const LS_RESUME_FILENAME_KEY = 'tyaariResumeFileName';

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores the File object for current interaction
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null); // For UI display, from localStorage or current upload
  const [currentResumeTextForAI, setCurrentResumeTextForAI] = useState<string | null>(null); // Holds text for AI
  const [isProcessingFile, setIsProcessingFile] = useState(false);

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
      } else {
        form.reset(form.formState.defaultValues);
      }
      // Load resume info from localStorage
      const storedFileName = localStorage.getItem(LS_RESUME_FILENAME_KEY);
      const storedResumeText = localStorage.getItem(LS_RESUME_TEXT_KEY);
      if (storedFileName) {
        setDisplayedFileName(storedFileName);
      }
      if (storedResumeText) {
        setCurrentResumeTextForAI(storedResumeText);
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
      setDisplayedFileName(null);
      setCurrentResumeTextForAI(null);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear input to allow re-selection of the same file
    }

    if (!file) { // User cancelled dialog or no file selected
      // Do not clear existing localStorage or displayedFileName if user just cancels
      return;
    }

    setIsProcessingFile(true);
    setSelectedFile(file); 
    setDisplayedFileName(file.name); // Show new file name immediately
    setCurrentResumeTextForAI(""); // Clear previous text for AI

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024*1024)).toFixed(2)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      setDisplayedFileName(localStorage.getItem(LS_RESUME_FILENAME_KEY) || null); // Revert to stored name
      setCurrentResumeTextForAI(localStorage.getItem(LS_RESUME_TEXT_KEY) || null); // Revert to stored text
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
      setDisplayedFileName(localStorage.getItem(LS_RESUME_FILENAME_KEY) || null);
      setCurrentResumeTextForAI(localStorage.getItem(LS_RESUME_TEXT_KEY) || null);
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
      setCurrentResumeTextForAI(text);
      localStorage.setItem(LS_RESUME_TEXT_KEY, text);
      localStorage.setItem(LS_RESUME_FILENAME_KEY, file.name);
      setDisplayedFileName(file.name); // Ensure this is set on successful load
      toast({ title: "Resume Content Processed", description: `Text from ${file.name} has been processed and stored locally for AI use.`});
      setIsProcessingFile(false);
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive"});
        setCurrentResumeTextForAI(localStorage.getItem(LS_RESUME_TEXT_KEY) || null); // Revert
        setDisplayedFileName(localStorage.getItem(LS_RESUME_FILENAME_KEY) || null); // Revert
        setIsProcessingFile(false);
    };
    reader.readAsText(file); 
  };

  const clearResume = async () => {
    localStorage.removeItem(LS_RESUME_TEXT_KEY);
    localStorage.removeItem(LS_RESUME_FILENAME_KEY);
    
    setSelectedFile(null);
    setDisplayedFileName(null);
    setCurrentResumeTextForAI(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Resume Cleared", description: "Local resume information has been removed." });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    // Resume data is not part of 'values' from the form, it's handled by localStorage
    // Only user profile fields are saved to Firestore
    const profileDataToSave: UserProfile = {
      ...userProfile, 
      uid: user.uid,
      email: user.email || undefined,
      name: values.name,
      profileField: values.profileField,
      role: values.role,
      company: values.company || undefined,
      education: values.education,
      phoneNumber: values.phoneNumber || undefined,
      updatedAt: new Date().toISOString(),
      // No resume fields here
    };
    
    if (profileDataToSave.company === "") profileDataToSave.company = undefined;
    if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile(); 
      // selectedFile is for current interaction, not long-term state after save
      // displayedFileName and currentResumeTextForAI are already updated from localStorage or file change
    } catch (error: any) {
      console.error("Profile update error:", error);
      const description = error.code ? `${error.message} (Code: ${error.code})` : error.message || "Could not update profile.";
      toast({ title: "Update Failed", description: description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <FormLabel>Resume (Optional, stored locally in your browser)</FormLabel>
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
                    disabled={isProcessingFile || isSubmitting}
                  />
                </FormControl>
                {isProcessingFile && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text will be extracted for AI.
                Plain text versions (.txt, .md) are best for AI processing. This resume is stored only in your browser.
              </FormDescription>
              
              {displayedFileName && !isProcessingFile && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{displayedFileName} (loaded from browser)</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume from browser storage" disabled={isSubmitting || authLoading || isProcessingFile}>
                      <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
              {/* No hidden inputs needed for resume as it's not part of form submission values to Firestore */}
            </FormItem>

            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            
            <Button type="submit" disabled={isSubmitting || authLoading || isProcessingFile} className="w-full sm:w-auto">
              {(isSubmitting || isProcessingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessingFile ? 'Processing File...' : (isSubmitting ? 'Saving Profile...' : 'Save Changes')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
