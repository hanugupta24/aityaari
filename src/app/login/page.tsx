"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useToast } from "@/hooks/use-toast";
import { GlobalLoading } from "@/components/common/GlobalLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { collection, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { doc, getDoc } from "firebase/firestore";

const emailLoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

const phoneLoginSchema = z.object({
  phoneNumber: z
    .string()
    .min(
      10,
      "Phone number must be at least 10 digits (including country code)."
    )
    .max(15),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;
type PhoneLoginFormValues = z.infer<typeof phoneLoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");

  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  const handleEmailLogin = async (values: EmailLoginFormValues) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );

      const user = userCredential.user;

      if (!user.emailVerified) {
        await auth.signOut();

        toast({
          title: "Email Not Verified",
          description:
            "Please verify your email before logging in. A verification link was sent when you signed up.",
          variant: "destructive",
        });
        return;
      }

      // Proceed if verified
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });

      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "An unexpected error occurred.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (values: PhoneLoginFormValues) => {
    setLoading(true);
    try {
      // First, find the user document by phone number to get their email
      // Since Firebase Auth requires email for signInWithEmailAndPassword,
      // we need to store phone-to-email mapping in Firestore

      // For now, we'll show an error since phone+password login requires custom implementation
      // You would need to implement a custom backend endpoint or use a different approach

      toast({
        title: "Feature Coming Soon",
        description:
          "Phone + password login will be available soon. Please use email login for now.",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error("Phone login error:", error);
      toast({
        title: "Login Failed",
        description:
          "Unable to login with phone number. Please try email login.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || isRedirecting) {
    return <GlobalLoading />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Welcome Back!</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your {siteConfig.name} dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={authMethod}
            onValueChange={(value) => setAuthMethod(value as "email" | "phone")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email & Password</TabsTrigger>
              {/* <TabsTrigger value="phone">Phone & Password</TabsTrigger> */}
            </TabsList>

            <TabsContent value="email" className="pt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const email = formData.get("email") as string;
                  const password = formData.get("password") as string;

                  const validation = emailLoginSchema.safeParse({
                    email,
                    password,
                  });
                  if (!validation.success) {
                    toast({
                      title: "Validation Error",
                      description: validation.error.errors[0].message,
                      variant: "destructive",
                    });
                    return;
                  }
                  handleEmailLogin({ email, password });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="emailLogin">Email</Label>
                  <Input
                    id="emailLogin"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="passwordLogin">Password</Label>
                  <Input
                    id="passwordLogin"
                    name="password"
                    placeholder="••••••••"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login with Email
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="pt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const phoneNumber = formData.get("phoneNumber") as string;
                  const password = formData.get("password") as string;

                  const validation = phoneLoginSchema.safeParse({
                    phoneNumber,
                    password,
                  });
                  if (!validation.success) {
                    toast({
                      title: "Validation Error",
                      description: validation.error.errors[0].message,
                      variant: "destructive",
                    });
                    return;
                  }

                  handlePhoneLogin({ phoneNumber, password });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="phoneNumberLogin">
                    Phone Number (with country code)
                  </Label>
                  <Input
                    id="phoneNumberLogin"
                    name="phoneNumber"
                    type="tel"
                    placeholder="+1234567890"
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your phone number including the country code.
                  </p>
                </div>
                <div>
                  <Label htmlFor="phonePasswordLogin">Password</Label>
                  <Input
                    id="phonePasswordLogin"
                    name="password"
                    placeholder="••••••••"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login with Phone
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <p className="w-full text-center">
            Don't have an account?{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push("/signup")}
            >
              Sign Up
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
