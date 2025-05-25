
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { z } from "zod";
import { AuthForm } from "@/components/auth/AuthForm";
import { useToast } from "@/hooks/use-toast";
import { GlobalLoading } from "@/components/common/GlobalLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { siteConfig } from "@/config/site";


const emailLoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;

const phoneSchema = z.string().min(10, "Phone number must be at least 10 digits (including country code, e.g., +1XXXXXXXXXX).").max(15);
const otpSchema = z.string().length(6, "OTP must be 6 digits.");


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");

  // Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  useEffect(() => {
    if (authMethod === "phone" && recaptchaContainerRef.current && auth && !recaptchaVerifierRef.current) {
      console.log("LOGIN: Initializing reCAPTCHA...");
      try {
        const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: "invisible",
          callback: (response: any) => {
            console.log("LOGIN: reCAPTCHA solved:", response);
          },
          "expired-callback": () => {
            toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
            setLoading(false);
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current = null;
            }
          },
        });
        
        verifier.render().then((widgetId) => {
          console.log("LOGIN: Invisible reCAPTCHA rendered. Widget ID:", widgetId);
          recaptchaVerifierRef.current = verifier;
        }).catch((error) => {
          console.error("LOGIN: Error rendering reCAPTCHA:", error);
          toast({ title: "reCAPTCHA Render Error", description: `Could not render reCAPTCHA: ${error.message}. Phone auth may not work.`, variant: "destructive" });
          recaptchaVerifierRef.current = null;
        });

      } catch (error: any) {
        console.error("LOGIN: Error initializing RecaptchaVerifier instance:", error);
        toast({ title: "reCAPTCHA Init Error", description: `Could not initialize reCAPTCHA: ${error.message}. Phone auth may not work.`, variant: "destructive" });
        recaptchaVerifierRef.current = null;
      }
    } else if (authMethod !== "phone" && recaptchaVerifierRef.current) {
        console.log("LOGIN: Auth method not phone, clearing reCAPTCHA ref.");
        recaptchaVerifierRef.current = null;
    }
    
    return () => {
      if (recaptchaVerifierRef.current && authMethod === "phone") {
         console.log("LOGIN: Cleaning up reCAPTCHA verifier ref on unmount or method change from phone.");
         recaptchaVerifierRef.current = null;
      }
    };
  }, [authMethod, auth, toast]);

  const handleEmailLogin = async (values: EmailLoginFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
      // Redirection is handled by the main useEffect checking `user`
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

  const handleSendOtpForLogin = async () => {
    setLoading(true);
    const validation = phoneSchema.safeParse(phoneNumber);
    if (!validation.success) {
      toast({ title: "Invalid Phone Number", description: validation.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }
     if (!recaptchaVerifierRef.current) {
        toast({ title: "reCAPTCHA Error", description: "reCAPTCHA not ready. Please wait a moment and try again.", variant: "destructive"});
        setLoading(false);
        return;
    }

    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
    } catch (error: any) {
      console.error("Error sending OTP for login:", error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndLogin = async () => {
    setLoading(true);
    const otpValidation = otpSchema.safeParse(otp);
    if (!otpValidation.success) {
      toast({ title: "Invalid OTP", description: otpValidation.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!confirmationResult) {
      toast({ title: "Error", description: "OTP not sent yet or confirmation failed.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      await confirmationResult.confirm(otp);
      toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
      // Redirection will be handled by the main useEffect checking `user`
    } catch (error: any) {
      console.error("Error verifying OTP for login:", error);
      toast({
        title: "OTP Verification Failed",
        description: error.message || "Please check the OTP and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || isRedirecting ) {
    return <GlobalLoading />;
  }
  
  if (!user && !initialLoading && !isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl">Welcome Back!</CardTitle>
            <CardDescription>Sign in to access your {siteConfig.name} dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMethod} onValueChange={(value) => {
                setAuthMethod(value as "email" | "phone");
                setOtpSent(false);
                setOtp("");
                setPhoneNumber("");
                setConfirmationResult(null);
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">Email & Password</TabsTrigger>
                <TabsTrigger value="phone">Phone Number</TabsTrigger>
              </TabsList>
              <TabsContent value="email" className="pt-4">
                <AuthForm formSchema={emailLoginSchema} onSubmit={handleEmailLogin} type="login" loading={loading} />
              </TabsContent>
              <TabsContent value="phone" className="pt-4 space-y-4">
                {!otpSent ? (
                  <>
                    <div>
                      <Label htmlFor="phoneNumberLogin">Phone Number (with country code)</Label>
                      <Input
                        id="phoneNumberLogin"
                        type="tel"
                        placeholder="+15551234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={loading}
                      />
                       <p className="text-xs text-muted-foreground mt-1">
                        Enter your phone number including the country code.
                       </p>
                    </div>
                    <Button 
                        onClick={handleSendOtpForLogin} 
                        className="w-full" 
                        disabled={loading || !phoneNumber.trim() || !recaptchaVerifierRef.current}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send OTP
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="otpLogin">Enter OTP</Label>
                      <Input
                        id="otpLogin"
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { setOtpSent(false); setConfirmationResult(null); setOtp(''); /* setPhoneNumber(''); */ }}>Change Number or Resend?</Button>
                      </p>
                    </div>
                    <Button onClick={handleVerifyOtpAndLogin} className="w-full" disabled={loading || otp.length !== 6}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Verify OTP & Login
                    </Button>
                  </>
                )}
                {/* Container for invisible reCAPTCHA */}
                {authMethod === "phone" && <div ref={recaptchaContainerRef} id="recaptcha-container-login"></div>}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="text-center text-sm">
            <p>
              Don't have an account?{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push("/signup")}>
                Sign Up
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }
  return <GlobalLoading />;
}

    