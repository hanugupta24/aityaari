
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
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
  const [isRecaptchaInitializing, setIsRecaptchaInitializing] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);


  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  useEffect(() => {
    const pageName = "LOGIN";
    const initRecaptcha = async () => {
      if (recaptchaContainerRef.current && auth) {
        if (recaptchaVerifierRef.current) {
          console.log(`${pageName}: reCAPTCHA verifier already exists or being initialized.`);
          return;
        }

        console.log(`${pageName}: Attempting to initialize reCAPTCHA...`);
        setIsRecaptchaInitializing(true);
        setIsRecaptchaReady(false);
        setRecaptchaError(null);

        try {
          const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            size: "invisible",
            callback: (response: any) => {
              console.log(`${pageName}: reCAPTCHA challenge solved by user:`, response);
              setIsRecaptchaReady(true);
            },
            "expired-callback": () => {
              toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
              if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e); }
              }
              recaptchaVerifierRef.current = null;
              setIsRecaptchaReady(false);
              setRecaptchaError("reCAPTCHA challenge expired. Please refresh and try again.");
            },
          });
          
          await verifier.render(); 
          console.log(`${pageName}: Invisible reCAPTCHA rendered and should be ready for user interaction.`);
          recaptchaVerifierRef.current = verifier;
          setIsRecaptchaReady(true);

        } catch (error: any) {
          console.error(`${pageName}: Error during reCAPTCHA initialization or rendering:`, error);
          toast({
            title: "reCAPTCHA Setup Error",
            description: `Failed to initialize reCAPTCHA: ${error.message}. Phone sign-in may not work. Check browser console for details.`,
            variant: "destructive",
            duration: 10000,
          });
          if (recaptchaVerifierRef.current) {
             try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after error:`, e); }
          }
          recaptchaVerifierRef.current = null;
          setIsRecaptchaReady(false);
          setRecaptchaError(`reCAPTCHA Error: ${error.message}. Please check your internet connection, browser settings (disable ad-blockers), or try again later. Ensure this website domain is authorized for Firebase phone authentication in your Firebase project and Google Cloud API key settings.`);
        } finally {
          setIsRecaptchaInitializing(false);
        }
      } else {
         console.log(`${pageName}: Conditions not met for reCAPTCHA init (authMethod not phone, or container/auth not ready).`);
      }
    };

    if (authMethod === "phone") {
      if (!recaptchaVerifierRef.current && !isRecaptchaInitializing && !recaptchaError) {
        initRecaptcha();
      } else if (recaptchaVerifierRef.current) {
        setIsRecaptchaReady(true);
      }
    } else {
      if (recaptchaVerifierRef.current) {
        console.log(`${pageName}: Clearing reCAPTCHA verifier due to auth method change.`);
        try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on auth method change:`, e); }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setIsRecaptchaInitializing(false);
      setRecaptchaError(null);
    }

    return () => {
      if (recaptchaVerifierRef.current && authMethod === "phone") { 
        console.log(`${pageName}: Cleaning up reCAPTCHA verifier on unmount (authMethod was phone).`);
        try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on unmount:`, e); }
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
     if (!recaptchaVerifierRef.current || !isRecaptchaReady) {
        toast({ title: "reCAPTCHA Error", description: recaptchaError || "reCAPTCHA not ready. Please wait or try refreshing.", variant: "destructive"});
        setLoading(false);
        return;
    }

    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      setRecaptchaError(null);
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
    } catch (error: any) {
      console.error("Error sending OTP for login:", error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-verification-code') {
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn('LOGIN: Error clearing reCAPTCHA after OTP send error:', e); }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false);
        setRecaptchaError("reCAPTCHA verification failed. Please try again.");
      }
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
                // setPhoneNumber(""); // Keep phone number if user wants to retry
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
                        disabled={loading || isRecaptchaInitializing}
                      />
                       <p className="text-xs text-muted-foreground mt-1">
                        Enter your phone number including the country code.
                       </p>
                    </div>
                    <Button 
                        onClick={handleSendOtpForLogin} 
                        className="w-full" 
                        disabled={loading || !phoneNumber.trim() || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError}
                    >
                      {loading || isRecaptchaInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isRecaptchaInitializing ? 'Initializing reCAPTCHA...' : 'Send OTP'}
                    </Button>
                    {!isRecaptchaReady && !isRecaptchaInitializing && !recaptchaError && authMethod === 'phone' && (
                        <p className="text-xs text-center text-muted-foreground">Waiting for reCAPTCHA...</p>
                    )}
                    {recaptchaError && authMethod === 'phone' && (
                        <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>reCAPTCHA Problem</AlertTitle>
                            <AlertDescription>{recaptchaError}</AlertDescription>
                        </Alert>
                    )}
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
                        An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { setOtpSent(false); setConfirmationResult(null); setOtp(''); setRecaptchaError(null); setIsRecaptchaReady(false); }}>Change Number or Resend?</Button>
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
