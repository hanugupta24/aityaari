
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
import { Loader2, FileText, UploadCloud, XCircle } from "lucide-react";
import type { UserProfile } from "@/types";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
  resumeText: z.string().max(25000, {message: "Resume text should be less than 25000 characters."}).optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ACCEPTED_MIME_TYPES = [
  'text/plain', 
  'text/markdown', 
  'application/pdf', 
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];
const ACCEPT_FILE_EXTENSIONS = ".txt,.md,.pdf,.doc,.docx";
const MAX_FILE_SIZE_MB = 5;

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
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
      resumeText: "",
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
          resumeText: userProfile.resumeText || "",
        });
        if (userProfile.resumeText) {
            setSelectedFileName("Resume on file (upload new to replace)");
        } else {
            setSelectedFileName(null);
        }
      } else {
        // User is logged in but no profile data, reset to defaults
        form.reset(form.formState.defaultValues);
        setSelectedFileName(null);
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      // No user logged in
      setIsFetchingProfile(false);
      form.reset(form.formState.defaultValues);
      setSelectedFileName(null);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // If no file is selected, but there was a resumeText in form, keep "Resume on file"
      if (!form.getValues("resumeText")) {
          setSelectedFileName(null);
      }
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a supported file type (${ACCEPT_FILE_EXTENSIONS}). You uploaded: ${file.type || 'unknown'}.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
       toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
      return;
    }
    
    setIsReadingFile(true);
    setSelectedFileName(file.name); // Show the name of the newly selected file

    if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      toast({
        title: "File Type Notice",
        description: `Attempting to extract text from ${file.name}. For PDF/Word documents, complex layouts might not be fully preserved as text. A plain text (.txt, .md) version is recommended for the most accurate AI processing of your resume content.`,
        duration: 7000,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      form.setValue("resumeText", text, { shouldValidate: true });
      setIsReadingFile(false);
      toast({ title: "Resume Content Loaded", description: `Text from ${file.name} has been loaded into the form.`});
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        toast({ title: "File Read Error", description: "Could not read the resume file content.", variant: "destructive"});
        // Revert to "Resume on file" if there was one originally, otherwise null
        setSelectedFileName(userProfile?.resumeText ? "Resume on file (upload new to replace)" : null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsReadingFile(false);
    };
    reader.readAsText(file); 
  };

  const clearResume = () => {
    form.setValue("resumeText", "", { shouldValidate: true });
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input
    }
    toast({ title: "Resume Cleared", description: "Resume text has been removed from the form."});
  }

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      
      const currentProfileSnap = await getDoc(userDocRef);
      const currentProfileData = currentProfileSnap.exists() ? currentProfileSnap.data() : {};

      const profileDataToSave: Partial<UserProfile> = {
        ...currentProfileData, // Preserve existing fields not in the form
        ...values, 
        uid: user.uid, 
        email: user.email || undefined, // Firebase user email might be null
        updatedAt: new Date().toISOString(),
      };
      
      // Ensure optional fields that are empty strings are stored as undefined or removed
      if (profileDataToSave.company === "") profileDataToSave.company = undefined;
      if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined;
      if (profileDataToSave.resumeText === null || profileDataToSave.resumeText === "") {
        profileDataToSave.resumeText = undefined;
      }

      await setDoc(userDocRef, profileDataToSave, { merge: true });

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile(); 
      // If resumeText was updated, reflect this in selectedFileName
      if (values.resumeText) {
        setSelectedFileName("Resume on file (upload new to replace)");
      } else {
        setSelectedFileName(null);
      }

    } catch (error: any) {
      console.error("Profile update error:", error);
      const description = error.message || error.code || "Could not update profile. See browser console for details.";
      toast({
        title: "Update Failed",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading || isFetchingProfile) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Your Profile</CardTitle>
        <CardDescription>Keep your information up to date to get the best interview experience.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ada Lovelace" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="profileField"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Field</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Software Engineering, Product Management" {...field} />
                  </FormControl>
                  <FormDescription>Your primary area of expertise.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current or Target Role</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Senior Frontend Developer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current or Target Company (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Google, Acme Corp" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="education"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., B.S. in Computer Science from Example University" {...field} />
                  </FormControl>
                  <FormDescription>Your highest relevant education.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormItem>
              <FormLabel>Resume (Optional)</FormLabel>
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
                  disabled={isReadingFile}
                />
              </FormControl>
              {isReadingFile && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" />Reading file...</p>}
              {selectedFileName && !isReadingFile && (
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                    <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-primary" />
                        <span>{selectedFileName}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume" disabled={isSubmitting || authLoading || isReadingFile}>
                        <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
              )}
              <FormDescription>
                Upload your resume ({ACCEPT_FILE_EXTENSIONS}, max {MAX_FILE_SIZE_MB}MB). Text content will be extracted.
                For PDF/Word files, plain text versions (.txt, .md) provide the best input for AI question generation.
              </FormDescription>
              <FormField
                control={form.control}
                name="resumeText"
                render={({ field }) => <Input type="hidden" {...field} />} 
              />
              <FormMessage>{form.formState.errors.resumeText?.message}</FormMessage>
            </FormItem>

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting || authLoading || isReadingFile} className="w-full sm:w-auto">
              {(isSubmitting || authLoading || isReadingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    

    