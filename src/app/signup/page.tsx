
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
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
import Link from "next/link";

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
const passwordSchema = z.string().min(6, "Password must be at least 6 characters.");

const RECAPTCHA_CONTAINER_ID_SIGNUP = "recaptcha-container-signup";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneEmail, setPhoneEmail] = useState(""); 
  const [phonePassword, setPhonePassword] = useState(""); 
  const [phoneConfirmPassword, setPhoneConfirmPassword] = useState(""); 
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null); 

  const [isRecaptchaInitializing, setIsRecaptchaInitializing] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  const emailSignupForm = useForm<EmailSignupFormValues>({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", phoneNumber: "" },
  });

  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/profile"); 
    }
  }, [user, initialLoading, router]);

  const initRecaptcha = async (containerId: string) => {
    const pageName = "SIGNUP_PAGE_INIT_RECAPTCHA";
    console.log(`${pageName}: Attempting to initialize reCAPTCHA on container ID: ${containerId}. Current verifier: ${!!recaptchaVerifierRef.current}`);
    
    // Ensure previous verifier is cleared if any exists and isn't the one we're about to create
    if (recaptchaVerifierRef.current) {
        console.warn(`${pageName}: Existing verifier instance found. Clearing before re-init.`);
        try { 
          recaptchaVerifierRef.current.clear(); 
          console.log(`${pageName}: Old verifier cleared.`);
        } catch(e) { 
          console.warn(`${pageName}: Error clearing old verifier:`, e); 
        }
        recaptchaVerifierRef.current = null;
    }
    
    setIsRecaptchaInitializing(true);
    setIsRecaptchaReady(false);
    setRecaptchaError(null);

    try {
      if (!auth) {
        console.error(`${pageName}: Firebase auth object is NOT available.`);
        throw new Error("Firebase auth service not ready.");
      }
      const domContainer = document.getElementById(containerId);
      if (!domContainer) {
        console.error(`${pageName}: DOM element with ID '${containerId}' NOT FOUND for reCAPTCHA.`);
        throw new Error(`reCAPTCHA container element (ID: ${containerId}) missing from DOM.`);
      }
      console.log(`${pageName}: DOM element with ID '${containerId}' FOUND:`, domContainer);
      
      console.log(`${pageName}: Creating new RecaptchaVerifier instance for element ID: ${containerId}`);
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: (response: any) => {
          console.log(`${pageName}: reCAPTCHA challenge PASSED (invisible flow). Response:`, response);
          setIsRecaptchaReady(true);
          setRecaptchaError(null);
        },
        "expired-callback": () => {
          console.warn(`${pageName}: reCAPTCHA challenge EXPIRED.`);
          setRecaptchaError("reCAPTCHA challenge expired. Please try sending OTP again.");
          if (recaptchaVerifierRef.current) { // Check if it's the current verifier
            try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e); }
          }
          recaptchaVerifierRef.current = null; // Definitely nullify on expiry
          setIsRecaptchaReady(false);
        },
      });
      console.log(`${pageName}: New RecaptchaVerifier instance CREATED.`);
      
      console.log(`${pageName}: Attempting verifier.render()...`);
      const renderTimeout = 15000; 
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`reCAPTCHA render timed out after ${renderTimeout / 1000} seconds. Check network and domain authorization.`)), renderTimeout)
      );
      
      await Promise.race([verifier.render(), timeoutPromise]);
      
      console.log(`${pageName}: verifier.render() promise RESOLVED or didn't time out. Setting verifier ref and ready state.`);
      recaptchaVerifierRef.current = verifier;
      setIsRecaptchaReady(true); 
      setRecaptchaError(null);
      console.log(`${pageName}: reCAPTCHA setup successful. isRecaptchaReady: true`);

    } catch (error: any) {
      console.error(`${pageName}: CRITICAL ERROR during reCAPTCHA setup:`, error);
      setRecaptchaError(`reCAPTCHA Setup Error: ${error.message}. This often indicates issues with API key domain restrictions or network access to Google's reCAPTCHA services. Check console & network tab, and ensure the reCAPTCHA container div is visible.`);
      if (recaptchaVerifierRef.current) { // If verifier was assigned then errored
          try { recaptchaVerifierRef.current.clear(); } catch(e) {/*ignore*/}
      }
      recaptchaVerifierRef.current = null;
      setIsRecaptchaReady(false);
    } finally {
      console.log(`${pageName}: initRecaptcha finally block. isRecaptchaInitializing -> false`);
      setIsRecaptchaInitializing(false);
    }
  };

  useEffect(() => {
    const pageName = "SIGNUP_PAGE_RECAPTCHA_EFFECT";
    console.log(`${pageName}: Main reCAPTCHA useEffect. AuthMethod: ${authMethod}, Auth: ${!!auth}, recaptchaContainerRef.current:`, recaptchaContainerRef.current);

    if (authMethod === "phone" && auth) {
      // Check if the ref to the div is available. This ensures the div is rendered.
      if (recaptchaContainerRef.current) { 
        if (!recaptchaVerifierRef.current && !isRecaptchaInitializing && !isRecaptchaReady) {
            console.log(`${pageName}: Conditions met (container ref available, no active verifier, not initializing, not ready). Triggering initRecaptcha for ID: ${RECAPTCHA_CONTAINER_ID_SIGNUP}`);
            initRecaptcha(RECAPTCHA_CONTAINER_ID_SIGNUP);
        } else {
            console.log(`${pageName}: Not calling initRecaptcha. VerifierRef: ${!!recaptchaVerifierRef.current}, Initializing: ${isRecaptchaInitializing}, Ready: ${isRecaptchaReady}`);
        }
      } else {
          console.warn(`${pageName}: reCAPTCHA container ref (recaptchaContainerRef.current) NOT available yet for ID ${RECAPTCHA_CONTAINER_ID_SIGNUP}. Will re-run when ref updates or authMethod changes.`);
          // If container not ready, ensure states are reset for next attempt
          if (recaptchaVerifierRef.current) {
              try { recaptchaVerifierRef.current.clear(); } catch(e) {/*ignore*/}
              recaptchaVerifierRef.current = null;
          }
          setIsRecaptchaReady(false);
          setRecaptchaError(null); 
          setIsRecaptchaInitializing(false);
      }
    } else { 
        // Cleanup when not in phone mode or auth not ready
        console.log(`${pageName}: Auth method is not 'phone' or auth not ready. Running cleanup.`);
        if (recaptchaVerifierRef.current) {
            console.log(`${pageName}: Clearing existing reCAPTCHA verifier.`);
            try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA:`, e); }
            recaptchaVerifierRef.current = null;
        }
        setIsRecaptchaReady(false);
        setRecaptchaError(null);
        setIsRecaptchaInitializing(false);
    }
    
    // Cleanup function for the effect
    return () => {
        console.log(`${pageName}: useEffect cleanup - Current Verifier:`, !!recaptchaVerifierRef.current);
        if (recaptchaVerifierRef.current) {
            console.log(`${pageName}: Cleanup - Clearing verifier instance.`);
            try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Cleanup - Error clearing verifier:`, e); }
            recaptchaVerifierRef.current = null;
        }
        // Reset states on cleanup to ensure clean state for next init
        setIsRecaptchaReady(false);
        setRecaptchaError(null);
        setIsRecaptchaInitializing(false);
    };
  }, [authMethod, auth, recaptchaContainerRef.current]); // Add recaptchaContainerRef.current as dependency


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
    const pageName = "SIGNUP_PAGE_SEND_OTP";
    setLoading(true);
    setRecaptchaError(null); 

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
      console.error(`${pageName}: Error sending OTP:`, error);
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

  const handleVerifyOtpAndSignup = async () => {
    const pageName = "SIGNUP_PAGE_VERIFY_OTP";
    setLoading(true);

    const otpValidation = otpSchema.safeParse(otp);
    if (!otpValidation.success) {
      toast({ title: "Invalid OTP", description: otpValidation.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (phoneEmail && phonePassword) { 
      if (phonePassword !== phoneConfirmPassword) {
        toast({ title: "Password Mismatch", description: "Passwords do not match.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const passwordValidation = passwordSchema.safeParse(phonePassword);
      if (!passwordValidation.success) {
        toast({ title: "Invalid Password", description: passwordValidation.error.errors[0].message, variant: "destructive" });
        setLoading(false);
        return;
      }
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

      let finalEmailToStore = null;
      if (phoneEmail && phonePassword && firebaseUser) {
        try {
          console.log(`${pageName}: Attempting to link email ${phoneEmail} to user ${firebaseUser.uid}`);
          const credential = EmailAuthProvider.credential(phoneEmail, phonePassword);
          await linkWithCredential(firebaseUser, credential);
          finalEmailToStore = phoneEmail; 
          console.log(`${pageName}: Email ${phoneEmail} successfully linked to user ${firebaseUser.uid}`);
        } catch (linkError: any) {
          console.error(`${pageName}: Error linking email credential:`, linkError);
          let linkErrorMessage = `Could not link email: ${linkError.message}`;
          if (linkError.code === 'auth/email-already-in-use') {
            linkErrorMessage = "This email is already associated with another account.";
          } else if (linkError.code === 'auth/credential-already-in-use') {
             linkErrorMessage = "This email/password is already linked to another account or this phone.";
          }
          toast({ title: "Email Link Error", description: linkErrorMessage, variant: "destructive" });
        }
      }

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: finalEmailToStore, 
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
      console.log(`${pageName}: User profile created/updated in Firestore for UID: ${firebaseUser.uid}`);

      toast({ title: "Signup Successful!", description: "Your account has been created. Redirecting to profile..." });
    } catch (error: any)
     {
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
  
  const sendOtpButtonDisabled = loading || !phoneNumber.trim() || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError;
  const verifyOtpButtonDisabled = loading || otp.length !== 6 || (phoneEmail && (!phonePassword || !phoneConfirmPassword)) || (phonePassword && phonePassword !== phoneConfirmPassword && phoneEmail.length > 0) ;


  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Create an Account</CardTitle>
          <CardDescription>Get started with {siteConfig.name} today!</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={authMethod} onValueChange={(value) => {
              const newAuthMethod = value as "email" | "phone";
              console.log(`SIGNUP_PAGE_TABS: Auth method changed to ${newAuthMethod}`);
              setAuthMethod(newAuthMethod);
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
              setPhoneEmail("");
              setPhonePassword("");
              setPhoneConfirmPassword("");
              // No need to manually reset recaptcha states here, useEffect handles it.
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email & Password</TabsTrigger>
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="pt-4">
              <Form {...emailSignupForm}>
                <form onSubmit={emailSignupForm.handleSubmit(handleEmailSignup)} className="space-y-4">
                  <FormField
                    control={emailSignupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="emailSignup">Email</Label>
                        <FormControl>
                          <Input id="emailSignup" placeholder="you@example.com" {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailSignupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="passwordSignup">Password</Label>
                        <FormControl>
                          <Input id="passwordSignup" placeholder="••••••••" {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailSignupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="confirmPasswordSignup">Confirm Password</Label>
                        <FormControl>
                          <Input id="confirmPasswordSignup" placeholder="••••••••" {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailSignupForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="emailBasedPhoneNumberSignup">Phone Number (Optional)</Label>
                        <FormControl>
                          <Input id="emailBasedPhoneNumberSignup" placeholder="e.g., +15551234567" {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Up with Email
                  </Button>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="phone" className="pt-4 space-y-4">
               {/* This div MUST be rendered when authMethod is phone for reCAPTCHA to attach */}
               {authMethod === "phone" && <div ref={recaptchaContainerRef} id={RECAPTCHA_CONTAINER_ID_SIGNUP}></div>}
              {!otpSent ? (
                <>
                  <div>
                    <Label htmlFor="phoneNumberSignup">Phone Number (with country code)</Label>
                    <Input
                      id="phoneNumberSignup"
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
                      aria-live="polite"
                  >
                    {(loading || isRecaptchaInitializing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isRecaptchaInitializing ? 'Initializing reCAPTCHA...' : (loading ? 'Sending OTP...' : 'Send OTP')}
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
                    <Label htmlFor="otpSignup">Enter OTP</Label>
                    <Input
                      id="otpSignup"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        An OTP was sent to {phoneNumber}. 
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { 
                            console.log("SIGNUP_PAGE: User clicked 'Change Number or Resend OTP'.");
                            setOtpSent(false); 
                            setConfirmationResult(null); 
                            setOtp('');
                            // Resetting reCAPTCHA states to allow re-initialization
                            if (recaptchaVerifierRef.current) {
                                try { recaptchaVerifierRef.current.clear(); } catch(e) { console.warn("Error clearing verifier on resend:", e); }
                                recaptchaVerifierRef.current = null;
                            }
                            setIsRecaptchaReady(false); 
                            setRecaptchaError(null);
                            setIsRecaptchaInitializing(false); 
                        }}>Change Number or Resend?</Button>
                    </p>
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phoneBasedEmailSignup">Email (Optional, to link with your phone account)</Label>
                     <Input id="phoneBasedEmailSignup" type="email" placeholder="you@example.com" value={phoneEmail} onChange={(e) => setPhoneEmail(e.target.value)} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phoneBasedPasswordSignup">Password (Optional, if email provided)</Label>
                     <Input id="phoneBasedPasswordSignup" type="password" placeholder="••••••••" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} disabled={loading || !phoneEmail} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phoneBasedConfirmPasswordSignup">Confirm Password (if password provided)</Label>
                     <Input id="phoneBasedConfirmPasswordSignup" type="password" placeholder="••••••••" value={phoneConfirmPassword} onChange={(e) => setPhoneConfirmPassword(e.target.value)} disabled={loading || !phonePassword} />
                  </div>
                  <Button onClick={handleVerifyOtpAndSignup} className="w-full" disabled={verifyOtpButtonDisabled}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify OTP & Sign Up
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
         <CardFooter className="text-center text-sm">
           <p>
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto" asChild>
                <Link href="/login">Login</Link>
              </Button>
            </p>
         </CardFooter>
      </Card>
    </div>
  );
}

    