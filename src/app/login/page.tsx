
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
    const pageName = "LOGIN_PAGE_RECAPTCHA_EFFECT";
    console.log(`${pageName}: useEffect triggered. AuthMethod: ${authMethod}, Auth object available: ${!!auth}`);

    const initRecaptcha = async () => {
      console.log(`${pageName}: initRecaptcha called. Container ref current:`, recaptchaContainerRef.current);
      setIsRecaptchaInitializing(true);
      setIsRecaptchaReady(false);
      setRecaptchaError(null);

      if (recaptchaVerifierRef.current) {
        try {
          console.log(`${pageName}: Clearing existing reCAPTCHA verifier.`);
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.warn(`${pageName}: Error clearing previous reCAPTCHA:`, e);
        }
        recaptchaVerifierRef.current = null;
      }
      
      if (!auth) {
        console.error(`${pageName}: Firebase auth object is not available. Cannot initialize reCAPTCHA.`);
        setRecaptchaError("Firebase auth service is not ready. Please try again later.");
        setIsRecaptchaInitializing(false);
        return;
      }

      if (!recaptchaContainerRef.current) {
        console.error(`${pageName}: reCAPTCHA container element not found in DOM.`);
        setRecaptchaError("reCAPTCHA container element missing. Cannot initialize.");
        setIsRecaptchaInitializing(false);
        return;
      }
      
      const containerId = recaptchaContainerRef.current.id;
      if (!containerId) {
        console.error(`${pageName}: reCAPTCHA container element does not have an ID.`);
        setRecaptchaError("reCAPTCHA container ID missing. Cannot initialize.");
        setIsRecaptchaInitializing(false);
        return;
      }
      console.log(`${pageName}: reCAPTCHA container ID: ${containerId}`);

      let verifier: RecaptchaVerifier | null = null;
      try {
        console.log(`${pageName}: Attempting to create new RecaptchaVerifier instance for element ID: ${containerId}`);
        verifier = new RecaptchaVerifier(auth, containerId, {
          size: "invisible",
          callback: (response: any) => {
            console.log(`${pageName}: reCAPTCHA challenge PASSED (invisible flow). Response:`, response);
            setIsRecaptchaReady(true); 
            // setIsRecaptchaInitializing(false); // Already handled in finally
            setRecaptchaError(null);
          },
          "expired-callback": () => {
            console.warn(`${pageName}: reCAPTCHA challenge expired.`);
            setRecaptchaError("reCAPTCHA challenge expired. Please try sending OTP again.");
            if (recaptchaVerifierRef.current) { // Check if current is this verifier or a new one
              try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e); }
            }
            recaptchaVerifierRef.current = null; // Ensure it's cleared
            setIsRecaptchaReady(false);
            // setIsRecaptchaInitializing(false);
          },
        });
        console.log(`${pageName}: New RecaptchaVerifier instance CREATED.`);
      } catch (error: any) {
        console.error(`${pageName}: CRITICAL ERROR instantiating RecaptchaVerifier:`, error);
        setRecaptchaError(`reCAPTCHA Instantiation Error: ${error.message}. Check console for details.`);
        setIsRecaptchaInitializing(false);
        return; // Stop if verifier couldn't be created
      }

      try {
        console.log(`${pageName}: Attempting verifier.render()...`);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("reCAPTCHA render timed out after 15 seconds.")), 15000)
        );
        
        await Promise.race([verifier.render(), timeoutPromise]);
        
        console.log(`${pageName}: verifier.render() promise RESOLVED or didn't time out.`);
        recaptchaVerifierRef.current = verifier; // Assign only after successful render
        setIsRecaptchaReady(true);
        setRecaptchaError(null);
        console.log(`${pageName}: reCAPTCHA setup successful. isRecaptchaReady: true`);
      } catch (error: any) {
        console.error(`${pageName}: CRITICAL ERROR during verifier.render():`, error);
        setRecaptchaError(`reCAPTCHA Render Error: ${error.message}. This often indicates issues with API key domain restrictions or network access to Google's reCAPTCHA services. Check console & network tab.`);
        recaptchaVerifierRef.current = null; // Clear ref on render error
        setIsRecaptchaReady(false);
      } finally {
        console.log(`${pageName}: initRecaptcha finally block. isRecaptchaInitializing -> false`);
        setIsRecaptchaInitializing(false);
      }
    };

    if (authMethod === "phone") {
      // Only initialize if not already ready and not currently initializing.
      // The container must exist.
      if (!isRecaptchaReady && !isRecaptchaInitializing && recaptchaContainerRef.current && auth) {
         console.log(`${pageName}: Phone auth method selected, reCAPTCHA not ready and not initializing. Triggering initRecaptcha.`);
         initRecaptcha();
      } else {
        console.log(`${pageName}: Phone auth method selected. Conditions for initRecaptcha: isReady: ${isRecaptchaReady}, isInitializing: ${isRecaptchaInitializing}, container: ${!!recaptchaContainerRef.current}, auth: ${!!auth}`);
      }
    } else { // email method
      if (recaptchaVerifierRef.current) {
        console.log(`${pageName}: Clearing reCAPTCHA verifier due to auth method change from phone.`);
        try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA:`, e); }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setRecaptchaError(null);
      setIsRecaptchaInitializing(false); // Ensure this is reset
    }
    
    return () => {
      const cleanupPageName = "LOGIN_PAGE_RECAPTCHA_CLEANUP";
      console.log(`${cleanupPageName}: Running cleanup for authMethod: ${authMethod}`);
      if (recaptchaVerifierRef.current) { 
        console.log(`${cleanupPageName}: Cleaning up reCAPTCHA verifier on component unmount or authMethod change.`);
        try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${cleanupPageName}: Error clearing reCAPTCHA during cleanup:`, e); }
        recaptchaVerifierRef.current = null;
      }
      // Reset states on cleanup to ensure fresh init if component remounts or method changes back quickly
      // setIsRecaptchaReady(false);
      // setRecaptchaError(null);
      // setIsRecaptchaInitializing(false);
    };
  // Ensure auth is a dependency if its availability triggers re-init
  }, [authMethod, auth]); 

  const handleEmailLogin = async (values: EmailLoginFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
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
    const pageName = "LOGIN_PAGE_SEND_OTP";
    setLoading(true);
    setRecaptchaError(null); // Clear previous errors

    const validation = phoneSchema.safeParse(phoneNumber);
    if (!validation.success) {
      toast({ title: "Invalid Phone Number", description: validation.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }
     if (!recaptchaVerifierRef.current || !isRecaptchaReady) {
        console.error(`${pageName}: Send OTP clicked but reCAPTCHA not ready or verifier not set. Verifier set: ${!!recaptchaVerifierRef.current}, isReady: ${isRecaptchaReady}, Error: ${recaptchaError}`);
        toast({ title: "reCAPTCHA Error", description: recaptchaError || "reCAPTCHA not ready. Please wait or re-check configurations. If this persists, your domain/API key might not be authorized for reCAPTCHA.", variant: "destructive"});
        setLoading(false);
        return;
    }

    try {
      console.log(`${pageName}: Attempting signInWithPhoneNumber for ${phoneNumber} with verifier:`, recaptchaVerifierRef.current);
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
      console.log(`${pageName}: OTP sent successfully.`);
    } catch (error: any) {
      console.error(`${pageName}: Error sending OTP for login:`, error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-verification-code' || error.code === 'auth/too-many-requests' || error.code === 'auth/network-request-failed') {
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after OTP send error:`, e); }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false); 
        setRecaptchaError(`reCAPTCHA or OTP error (${error.code}). Please try sending OTP again. The reCAPTCHA widget may need to re-initialize.`);
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
  
  const sendOtpButtonDisabled = loading || !phoneNumber.trim() || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError;
  
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome Back!</CardTitle>
          <CardDescription>Sign in to access your {siteConfig.name} dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={authMethod} onValueChange={(value) => {
              const newAuthMethod = value as "email" | "phone";
              console.log(`LOGIN_PAGE_TABS: Auth method changed to ${newAuthMethod}`);
              setAuthMethod(newAuthMethod);
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
              // Reset reCAPTCHA states if changing, to trigger re-initialization if switching to phone
              // No need to set isRecaptchaInitializing here, useEffect will handle it.
              // if (recaptchaVerifierRef.current) {
              //   try { 
              //     console.log("LOGIN_PAGE_TABS: Clearing reCAPTCHA verifier due to auth method switch.");
              //     recaptchaVerifierRef.current.clear(); 
              //   } catch(e) {
              //     console.warn("LOGIN_PAGE_TABS: Error clearing reCAPTCHA on method switch:", e);
              //   }
              //   recaptchaVerifierRef.current = null;
              // }
              // setIsRecaptchaReady(false); // This will be handled by the effect
              // setRecaptchaError(null);
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email & Password</TabsTrigger>
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="pt-4">
              <AuthForm formSchema={emailLoginSchema} onSubmit={handleEmailLogin} type="login" loading={loading} />
            </TabsContent>
            <TabsContent value="phone" className="pt-4 space-y-4">
              {/* This div must be present in the DOM for reCAPTCHA to render, ensure it has an ID */}
              {authMethod === "phone" && <div ref={recaptchaContainerRef} id="recaptcha-container-login"></div>}

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
                      disabled={sendOtpButtonDisabled}
                      aria-live="polite"
                  >
                    {isRecaptchaInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isRecaptchaInitializing ? 'Initializing reCAPTCHA...' : (loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP')}
                  </Button>
                  
                  {!isRecaptchaInitializing && !isRecaptchaReady && !recaptchaError && authMethod === 'phone' && (
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
                      An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { 
                          console.log("LOGIN_PAGE: User clicked 'Change Number or Resend OTP'.");
                          setOtpSent(false); 
                          setConfirmationResult(null); 
                          setOtp(''); 
                          // Trigger re-initialization of reCAPTCHA by resetting its ready state
                          setIsRecaptchaReady(false); 
                          setRecaptchaError(null); // Clear any previous error
                          // if(recaptchaVerifierRef.current) {
                          //   try { recaptchaVerifierRef.current.clear(); } catch(e) { console.warn("Error clearing verifier on resend:", e) }
                          //   recaptchaVerifierRef.current = null;
                          // }
                      }}>Change Number or Resend?</Button>
                    </p>
                  </div>
                  <Button onClick={handleVerifyOtpAndLogin} className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify OTP & Login
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <p>
            Don't have an account?{" "}
            <Button variant="link" className="p-0 h-auto" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
