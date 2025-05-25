
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
  const pageName = "SIGNUP_PAGE"; // Defined for logging

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
      router.push("/profile"); // Redirect to profile after signup to complete profile
    }
  }, [user, initialLoading, router]);

  useEffect(() => {
    const initRecaptcha = async () => {
      console.log(`${pageName}: initRecaptcha called. Container ref:`, recaptchaContainerRef.current);
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
              console.log(`${pageName}: reCAPTCHA challenge passed by user (invisible flow):`, response);
              // For invisible, this usually means ready to proceed with phone number sign-in
              // setIsRecaptchaReady(true); // Might be redundant if render() promise sets it
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
          await verifier.render(); 
          console.log(`${pageName}: verifier.render() promise RESOLVED.`);
          recaptchaVerifierRef.current = verifier;
          setIsRecaptchaReady(true);
          setRecaptchaError(null); // Clear any previous error on successful render

        } catch (error: any) {
          console.error(`${pageName}: Error during reCAPTCHA verifier.render() or instantiation:`, error);
          toast({
            title: "reCAPTCHA Setup Error",
            description: `Failed to initialize reCAPTCHA: ${error.message}. Phone sign-in may not work.`,
            variant: "destructive",
            duration: 10000,
          });
          if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after error:`, e); }
          }
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
      if (!recaptchaVerifierRef.current && !isRecaptchaInitializing && !recaptchaError) {
         console.log(`${pageName}: Conditions met to call initRecaptcha.`);
         initRecaptcha();
      } else {
        console.log(`${pageName}: initRecaptcha not called. Verifier exists: ${!!recaptchaVerifierRef.current}, Initializing: ${isRecaptchaInitializing}, Error: ${recaptchaError}`);
      }
    } else {
      if (recaptchaVerifierRef.current) {
        console.log(`${pageName}: Cleaning up reCAPTCHA verifier due to auth method change from phone.`);
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
        // No need to clear if it wasn't for phone, or it's already null
      }
    };
  }, [authMethod, auth, toast]);


  const handleEmailSignup = async (values: EmailSignupFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        createdAt: new Date().toISOString(),
        name: "", // Profile to be completed
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
      // User will be redirected by the main useEffect
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
      console.log(`${pageName}: Attempting to send OTP to:`, phoneNumber);
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      setRecaptchaError(null);
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
      console.log(`${pageName}: OTP sent successfully. ConfirmationResult set.`);
    } catch (error: any) {
      console.error(`${pageName}: Error sending OTP:`, error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-verification-code' || error.code === 'auth/too-many-requests') {
        // Reset reCAPTCHA for these specific errors to allow user to retry
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear?.(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after OTP send error:`, e); }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false); // This will trigger re-initialization in useEffect
        setRecaptchaError(`reCAPTCHA or OTP error (${error.code}). Please try again.`);
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
      console.log(`${pageName}: Attempting to verify OTP:`, otp);
      const userCredential = await confirmationResult.confirm(otp);
      const firebaseUser = userCredential.user;
      console.log(`${pageName}: Phone number verified, user signed up/in:`, firebaseUser.uid);

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: null, 
        phoneNumber: firebaseUser.phoneNumber,
        createdAt: new Date().toISOString(),
        name: "", // Profile to be completed
        profileField: "",
        role: "",
        company: null,
        education: "",
        interviewsTaken: 0,
        isPlusSubscriber: false,
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful!", description: "Your account has been created. Redirecting to profile..." });
      // User will be redirected by the main useEffect
    } catch (error: any) {
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
  
  // This should ideally not be reached if redirection logic is correct, but as a fallback.
  if (user && !initialLoading) {
     return <GlobalLoading />;
  }

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
              // Do not clear phoneNumber here to allow retry
              // reCAPTCHA state (isRecaptchaInitializing, isRecaptchaReady, recaptchaError)
              // will be reset by the useEffect when authMethod changes.
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
                        An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { setOtpSent(false); setConfirmationResult(null); setOtp(''); setRecaptchaError(null); /* This will trigger re-init if needed */ }}>Change Number or Resend?</Button>
                    </p>
                  </div>
                  <Button onClick={handleVerifyOtpAndSignup} className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify OTP & Sign Up
                  </Button>
                </>
              )}
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
