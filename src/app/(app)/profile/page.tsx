
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import type { UserProfile } from "@/types";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50),
  profileField: z.string().min(2, { message: "Profile field is required." }).max(100),
  role: z.string().min(2, { message: "Current role is required." }).max(100),
  company: z.string().max(100).optional().nullable(),
  education: z.string().min(2, { message: "Education details are required." }).max(200),
  phoneNumber: z.string().max(20).optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, userProfile, loading: authLoading, initialLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

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
    if (!initialLoading && !authLoading) { // Check initialLoading and authLoading first
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
        // If userProfile is null but auth is loaded, means no profile or error.
        // Form will use defaultValues (empty strings).
        form.reset(form.formState.defaultValues);
      }
      setIsFetchingProfile(false);
    }
  }, [userProfile, form, authLoading, initialLoading]);


  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      
      // Fetch the current profile to ensure we're merging with the latest data
      const currentProfileSnap = await getDoc(userDocRef);
      const currentProfileData = currentProfileSnap.exists() ? currentProfileSnap.data() : {};

      const profileDataToSave: Partial<UserProfile> = {
        ...currentProfileData, // Spread existing data (includes fields like interviewsTaken, isPlusSubscriber, createdAt)
        ...values, // Spread new form values, potentially overwriting name, role etc.
        uid: user.uid, 
        email: user.email, 
        updatedAt: new Date().toISOString(),
      };
      
      // Ensure optional fields that are empty strings from the form are saved as null or omitted if appropriate
      // For Zod optional strings, empty string is valid. If you want them to be `null` in Firestore:
      if (profileDataToSave.company === "") profileDataToSave.company = undefined; // Or null
      if (profileDataToSave.phoneNumber === "") profileDataToSave.phoneNumber = undefined; // Or null

      await setDoc(userDocRef, profileDataToSave, { merge: true });

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      await refreshUserProfile(); // Refresh userProfile in AuthContext
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

  if (initialLoading || isFetchingProfile) { // authLoading is covered by initialLoading for the initial fetch
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
            <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto">
              {(isSubmitting || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
