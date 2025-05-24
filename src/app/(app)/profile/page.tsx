
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
  resumeText: z.string().max(25000, {message: "Resume text should be less than 25000 characters."}).optional().nullable(), // Max 25k chars for resume
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ACCEPTED_FILE_TYPES = ['text/plain', 'text/markdown'];
const MAX_FILE_SIZE_MB = 2; // Max 2MB for resume text file

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
        }
      } else {
        form.reset(form.formState.defaultValues);
      }
      setIsFetchingProfile(false);
    } else if (!initialLoading && !authLoading && !user) {
      setIsFetchingProfile(false);
    }
  }, [user, userProfile, form, authLoading, initialLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // No file selected or selection cancelled
      // If user previously had a resume and now clears the input,
      // we should reflect that. We will clear it if they save without a new file.
      // For now, just ensure no old filename is stuck if they cancel.
      // If `form.getValues("resumeText")` has content, `selectedFileName` will be "Resume on file..."
      // otherwise it's null.
      if (!form.getValues("resumeText")) {
          setSelectedFileName(null);
      }
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a .txt or .md file. You uploaded a ${file.type} file.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
       toast({
        title: "File Too Large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      return;
    }
    
    setIsReadingFile(true);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      form.setValue("resumeText", text, { shouldValidate: true });
      setIsReadingFile(false);
      toast({ title: "Resume Loaded", description: `${file.name} content has been loaded into the form.`});
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        toast({ title: "File Read Error", description: "Could not read the resume file.", variant: "destructive"});
        setSelectedFileName(userProfile?.resumeText ? "Resume on file (upload new to replace)" : null); // Revert to previous state
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
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
        ...currentProfileData,
        ...values, 
        uid: user.uid, 
        email: user.email, 
        updatedAt: new Date().toISOString(),
      };
      
      if (profileDataToSave.company === "") profileDataToSave.company = undefined;
      if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined;
      // resumeText can be an empty string if user clears it, which is fine.
      // If it was never set or is null, it can also be undefined.
      if (profileDataToSave.resumeText === null || profileDataToSave.resumeText === "") {
        profileDataToSave.resumeText = undefined;
      }


      await setDoc(userDocRef, profileDataToSave, { merge: true });

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile(); 
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
                  accept=".txt,.md" 
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
                    <Button type="button" variant="ghost" size="sm" onClick={clearResume} title="Clear resume">
                        <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
              )}
              <FormDescription>
                Upload your resume as a .txt or .md file (max {MAX_FILE_SIZE_MB}MB). This can significantly improve question relevance.
              </FormDescription>
              {/* Hidden FormField for resumeText to ensure it's part of the form state and validation if needed */}
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


    