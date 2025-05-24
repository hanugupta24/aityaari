
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { z } from "zod";
import { AuthForm } from "@/components/auth/AuthForm";
import { useToast } from "@/hooks/use-toast";
import { GlobalLoading } from "@/components/common/GlobalLoading";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  if (initialLoading || isRedirecting) {
    // Show a loading state or null while initial auth check or redirection is in progress
    return <GlobalLoading />; 
  }
  
  // If user is null and not initialLoading, show the form
  if (!user && !initialLoading) {
    const handleLogin = async (values: LoginFormValues) => {
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
        // router.push("/dashboard"); // Redirection is handled by useEffect now
      } catch (error: any) {
        console.error("Login error:", error);
        toast({
          title: "Login Failed",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    return <AuthForm formSchema={loginSchema} onSubmit={handleLogin} type="login" loading={loading} />;
  }

  // Fallback, though ideally one of the above conditions should always be met.
  return <GlobalLoading />;
}

