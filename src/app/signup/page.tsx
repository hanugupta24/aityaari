
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { AuthForm } from "@/components/auth/AuthForm";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteConfig } from "@/config/site";
import { GlobalLoading } from "@/components/common/GlobalLoading";

const emailSignupSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z.string(),
    phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits."}).max(15, { message: "Phone number can be at most 15 digits."}).optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

type EmailSignupFormValues = z.infer<typeof emailSignupSchema>;

const phoneSchema = z.string().min(10, "Phone number must be at least 10 digits (including country code, e.g., +1XXXXXXXXXX).").max(15);
const otpSchema = z.string().length(6, "OTP must be 6 digits.");


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [isRedirecting, setIsRedirecting] = useState(false);
  
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
      router.push("/profile"); 
    }
  }, [user, initialLoading, router]);

  useEffect(() => {
    const pageName = "SIGNUP_PAGE";
    const initRecaptcha = async () => {
      console.log(`${pageName}: initRecaptcha called. Container ref:`, recaptchaContainerRef.current);
      
      // Clear any existing verifier first to ensure clean state
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear?.();
          console.log(`${pageName}: Cleared existing reCAPTCHA verifier.`);
        } catch (e) {
          console.warn(`${pageName}: Error clearing previous reCAPTCHA:`, e);
        }
        recaptchaVerifierRef.current = null;
      }

      if (recaptchaContainerRef.current && auth) {
        console.log(`${pageName}: Attempting to initialize reCAPTCHA...`);
        setIsRecaptchaInitializing(true);
        setIsRecaptchaReady(false);
        setRecaptchaError(null);

        try {
          const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            size: "invisible",
            callback: (response: any) => {
              console.log(`${pageName}: reCAPTCHA challenge passed (invisible flow):`, response);
            },
            "expired-callback": () => {
              console.warn(`${pageName}: reCAPTCHA challenge expired.`);
              toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
              if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e); }
              }
              recaptchaVerifierRef.current = null;
              setIsRecaptchaReady(false);
              setRecaptchaError("reCAPTCHA challenge expired. Please refresh and try again.");
            },
          });
          
          console.log(`${pageName}: RecaptchaVerifier instance created. Attempting verifier.render()...`);
          
          const renderPromise = verifier.render();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("reCAPTCHA render timed out after 15 seconds.")), 15000)
          );

          await Promise.race([renderPromise, timeoutPromise]);
          
          console.log(`${pageName}: verifier.render() promise RESOLVED or didn't time out.`);
          recaptchaVerifierRef.current = verifier;
          setIsRecaptchaReady(true); 
          setRecaptchaError(null);

        } catch (error: any) {
          console.error(`${pageName}: Error during reCAPTCHA verifier.render() or instantiation:`, error);
          toast({
            title: "reCAPTCHA Setup Error",
            description: `Failed to initialize reCAPTCHA: ${error.message}. Phone sign-in may not work.`,
            variant: "destructive",
            duration: 10000,
          });
          // Don't try to clear verifier if it failed instantiation
          recaptchaVerifierRef.current = null;
          setIsRecaptchaReady(false);
          setRecaptchaError(`reCAPTCHA Setup Error: ${error.message}. Please check browser console, ensure your domain is authorized in Firebase & Google Cloud for this API key, and no extensions are blocking reCAPTCHA.`);
        } finally {
          console.log(`${pageName}: initRecaptcha finally block. isRecaptchaInitializing -> false`);
          setIsRecaptchaInitializing(false);
        }
      } else {
         console.log(`${pageName}: Conditions not met for reCAPTCHA init (container or auth not ready). Container: ${!!recaptchaContainerRef.current}, Auth: ${!!auth}`);
      }
    };

    if (authMethod === "phone") {
      // Only initialize if not already ready and not currently initializing
      if (!isRecaptchaReady && !isRecaptchaInitializing) {
         console.log(`${pageName}: Conditions met to call initRecaptcha.`);
         initRecaptcha();
      }
    } else {
      // Cleanup if switching away from phone method
      if (recaptchaVerifierRef.current) {
        console.log(`${pageName}: Clearing reCAPTCHA verifier due to auth method change from phone.`);
        try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on auth method change:`, e); }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setIsRecaptchaInitializing(false);
      setRecaptchaError(null);
    }

    return () => {
      // General cleanup on unmount
      if (recaptchaVerifierRef.current) { 
        console.log(`${pageName}: Cleaning up reCAPTCHA verifier on unmount.`);
         try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on unmount:`, e); }
        recaptchaVerifierRef.current = null;
      }
    };
  }, [authMethod, auth, toast, isRecaptchaReady, isRecaptchaInitializing]);


  const handleEmailSignup = async (values: EmailSignupFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

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
        subscriptionPlan: null,
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful", description: "Redirecting to complete your profile..." });
    } catch (error: any) {
      console.error("Email Signup error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          title: "Account Exists",
          description: "This email is already registered. Please login.",
          variant: "default",
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

  const handleSendOtp = async () => {
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
      const pageName = "SIGNUP_PAGE";
      console.log(`${pageName}: Attempting to send OTP to:`, phoneNumber);
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      setRecaptchaError(null); // Clear any previous error
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
      console.log(`${pageName}: OTP sent successfully. ConfirmationResult set.`);
    } catch (error: any) {
      const pageName = "SIGNUP_PAGE";
      console.error(`${pageName}: Error sending OTP:`, error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-verification-code' || error.code === 'auth/too-many-requests') {
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after OTP send error:`, e); }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false); 
        setRecaptchaError(`reCAPTCHA or OTP error (${error.code}). Please try sending OTP again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndSignup = async () => {
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
      const pageName = "SIGNUP_PAGE";
      console.log(`${pageName}: Attempting to verify OTP:`, otp);
      const userCredential = await confirmationResult.confirm(otp);
      const firebaseUser = userCredential.user;
      console.log(`${pageName}: Phone number verified, user signed up/in:`, firebaseUser.uid);

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: null, 
        phoneNumber: firebaseUser.phoneNumber,
        createdAt: new Date().toISOString(),
        name: "", 
        profileField: "",
        role: "",
        company: null,
        education: "",
        interviewsTaken: 0,
        isPlusSubscriber: false,
        subscriptionPlan: null,
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful!", description: "Your account has been created. Redirecting to profile..." });
    } catch (error: any) {
      const pageName = "SIGNUP_PAGE";
      console.error(`${pageName}: Error verifying OTP or creating profile:`, error);
      toast({
        title: "OTP Verification Failed",
        description: error.message || "Please check the OTP and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  if (initialLoading || isRedirecting) {
    return <GlobalLoading />;
  }
  
  if (user && !initialLoading) {
     return <GlobalLoading />;
  }

  const sendOtpButtonDisabled = loading || !phoneNumber.trim() || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Create an Account</CardTitle>
          <CardDescription>Get started with {siteConfig.name} today!</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={authMethod} onValueChange={(value) => {
              setAuthMethod(value as "email" | "phone");
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
              // Reset reCAPTCHA related states manually here because useEffect might not catch all transitions if 'phone' was already selected
              setIsRecaptchaInitializing(false);
              setIsRecaptchaReady(false); // This will allow re-init when switching back to phone
              setRecaptchaError(null);
              if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear?.(); } catch(e) {/* ignore */}
                recaptchaVerifierRef.current = null;
              }
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email & Password</TabsTrigger>
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="pt-4">
              <AuthForm formSchema={emailSignupSchema} onSubmit={handleEmailSignup} type="signup" loading={loading} />
            </TabsContent>
            <TabsContent value="phone" className="pt-4 space-y-4">
              {!otpSent ? (
                <>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number (with country code)</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+15551234567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={loading || isRecaptchaInitializing}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter your phone number including the country code (e.g., +1 for USA, +91 for India).
                    </p>
                  </div>
                  <Button 
                      onClick={handleSendOtp} 
                      className="w-full" 
                      disabled={sendOtpButtonDisabled}
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
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { 
                            setOtpSent(false); 
                            setConfirmationResult(null); 
                            setOtp(''); 
                            // Trigger reCAPTCHA re-initialization if necessary
                            setIsRecaptchaReady(false); 
                            setRecaptchaError(null);
                        }}>Change Number or Resend?</Button>
                    </p>
                  </div>
                  <Button onClick={handleVerifyOtpAndSignup} className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify OTP & Sign Up
                  </Button>
                </>
              )}
              {/* This div must be present in the DOM for reCAPTCHA to render */}
              {authMethod === "phone" && <div ref={recaptchaContainerRef} id="recaptcha-container-signup"></div>}
            </TabsContent>
          </Tabs>
        </CardContent>
         <CardFooter className="text-center text-sm">
           <p>
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push("/login")}>
                Login
              </Button>
            </p>
         </CardFooter>
      </Card>
    </div>
  );
}
