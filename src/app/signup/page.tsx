
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { AuthForm } from "@/components/auth/AuthForm";
import { useToast } from "@/hooks/use-toast";

const signupSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z.string(),
    phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits."}).max(15, { message: "Phone number can be at most 15 digits."}).optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"], // path of error
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (user) {
    router.push("/dashboard"); // Redirect if already logged in
    return null;
  }

  const handleSignup = async (values: SignupFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      // Create a basic user profile document in Firestore
      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        createdAt: new Date().toISOString(),
        name: "",
        profileField: "",
        role: "",
        company: null,
        education: "",
        phoneNumber: values.phoneNumber || null,
        interviewsTaken: 0,
        isPlusSubscriber: false,
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful", description: "Redirecting to complete your profile..." });
      router.push("/profile");
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          title: "Account Exists",
          description: "This email is already registered. Please login.",
          variant: "default", // Or "destructive" if preferred
        });
      } else {
        toast({
          title: "Signup Failed",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return <AuthForm formSchema={signupSchema} onSubmit={handleSignup} type="signup" loading={loading} />;
}
