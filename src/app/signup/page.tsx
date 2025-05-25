
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


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneEmail, setPhoneEmail] = useState(""); // For email input in phone tab
  const [phonePassword, setPhonePassword] = useState(""); // For password input in phone tab
  const [phoneConfirmPassword, setPhoneConfirmPassword] = useState(""); // For confirm password
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
    const pageName = "SIGNUP_PAGE_RECAPTCHA";
    const initRecaptcha = async () => {
      console.log(`${pageName}: initRecaptcha called. Container ref exists:`, !!recaptchaContainerRef.current);
      
      if (recaptchaVerifierRef.current) {
        try {
          console.log(`${pageName}: Attempting to clear existing reCAPTCHA verifier.`);
          recaptchaVerifierRef.current.clear();
          console.log(`${pageName}: Cleared existing reCAPTCHA verifier.`);
        } catch (e) {
          console.warn(`${pageName}: Error clearing previous reCAPTCHA:`, e);
        }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false); // Reset readiness

      if (recaptchaContainerRef.current && auth) {
        console.log(`${pageName}: Attempting to initialize new reCAPTCHA verifier...`);
        setIsRecaptchaInitializing(true);
        setRecaptchaError(null);

        try {
          console.log(`${pageName}: Creating new RecaptchaVerifier instance.`);
          const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            size: "invisible",
            callback: (response: any) => {
              console.log(`${pageName}: reCAPTCHA challenge passed (invisible flow):`, response);
            },
            "expired-callback": () => {
              console.warn(`${pageName}: reCAPTCHA challenge expired.`);
              setRecaptchaError("reCAPTCHA challenge expired. Please try sending OTP again.");
              if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e); }
              }
              recaptchaVerifierRef.current = null;
              setIsRecaptchaReady(false);
            },
          });
          
          console.log(`${pageName}: New RecaptchaVerifier instance created. Attempting verifier.render()...`);
          
          const renderPromise = verifier.render();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("reCAPTCHA render timed out after 15 seconds.")), 15000)
          );

          await Promise.race([renderPromise, timeoutPromise]);
          
          console.log(`${pageName}: verifier.render() promise RESOLVED or didn't time out.`);
          recaptchaVerifierRef.current = verifier;
          setIsRecaptchaReady(true); 
          setRecaptchaError(null); // Clear any previous error
          console.log(`${pageName}: reCAPTCHA setup successful. isRecaptchaReady: true`);

        } catch (error: any) {
          console.error(`${pageName}: Error during reCAPTCHA verifier.render() or instantiation:`, error);
          setRecaptchaError(`reCAPTCHA Setup Error: ${error.message}. Please check browser console for more details, ensure your domain is authorized in Firebase & Google Cloud for this API key, and that no browser extensions are blocking reCAPTCHA scripts.`);
          recaptchaVerifierRef.current = null;
          setIsRecaptchaReady(false);
        } finally {
          console.log(`${pageName}: initRecaptcha finally block. isRecaptchaInitializing -> false`);
          setIsRecaptchaInitializing(false);
        }
      } else {
         console.log(`${pageName}: Conditions not met for reCAPTCHA init. Container ref: ${!!recaptchaContainerRef.current}, Auth: ${!!auth}`);
      }
    };

    if (authMethod === "phone") {
      // Only initialize if not already ready and not currently initializing
      if (!isRecaptchaReady && !isRecaptchaInitializing && recaptchaContainerRef.current) {
         console.log(`${pageName}: Conditions met to call initRecaptcha.`);
         initRecaptcha();
      } else if (!recaptchaContainerRef.current && !isRecaptchaInitializing) {
         console.log(`${pageName}: recaptchaContainerRef.current is null, cannot init reCAPTCHA yet.`);
      }
    } else {
      // Cleanup if switching away from phone method
      if (recaptchaVerifierRef.current) {
        console.log(`${pageName}: Clearing reCAPTCHA verifier due to auth method change from phone.`);
        try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on auth method change:`, e); }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setIsRecaptchaInitializing(false);
      setRecaptchaError(null);
    }
    
    // Cleanup on unmount
    return () => {
      if (recaptchaVerifierRef.current) { 
        console.log(`${pageName}: Cleaning up reCAPTCHA verifier on component unmount.`);
        try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA on unmount:`, e); }
        recaptchaVerifierRef.current = null;
      }
    };
  // Add recaptchaContainerRef.current as a dependency if its availability triggers re-init
  }, [authMethod, auth, toast, isRecaptchaInitializing, isRecaptchaReady]); 


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
    const validation = phoneSchema.safeParse(phoneNumber);
    if (!validation.success) {
      toast({ title: "Invalid Phone Number", description: validation.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!recaptchaVerifierRef.current || !isRecaptchaReady) {
        console.error(`${pageName}: Send OTP clicked but reCAPTCHA not ready. isRecaptchaReady: ${isRecaptchaReady}, recaptchaError: ${recaptchaError}`);
        toast({ title: "reCAPTCHA Error", description: recaptchaError || "reCAPTCHA not ready. Please wait or try refreshing the reCAPTCHA setup.", variant: "destructive"});
        setLoading(false);
        return;
    }
    
    try {
      console.log(`${pageName}: Attempting signInWithPhoneNumber for ${phoneNumber}`);
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      setRecaptchaError(null); // Clear error on success
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
      console.log(`${pageName}: OTP sent successfully.`);
    } catch (error: any) {
      console.error(`${pageName}: Error sending OTP:`, error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      // Reset reCAPTCHA on certain errors to allow retrying the whole flow
      if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-verification-code' || error.code === 'auth/too-many-requests') {
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear(); } catch (e) { console.warn(`${pageName}: Error clearing reCAPTCHA after OTP send error:`, e); }
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

      let finalEmail = null;
      if (phoneEmail && phonePassword && firebaseUser) {
        try {
          console.log(`${pageName}: Attempting to link email ${phoneEmail} to user ${firebaseUser.uid}`);
          const credential = EmailAuthProvider.credential(phoneEmail, phonePassword);
          await linkWithCredential(firebaseUser, credential);
          finalEmail = phoneEmail;
          console.log(`${pageName}: Email ${phoneEmail} successfully linked to user ${firebaseUser.uid}`);
        } catch (linkError: any) {
          console.error(`${pageName}: Error linking email credential:`, linkError);
          if (linkError.code === 'auth/email-already-in-use') {
            toast({ title: "Email Link Error", description: "This email is already associated with another account.", variant: "destructive" });
          } else if (linkError.code === 'auth/credential-already-in-use') {
             toast({ title: "Account Link Error", description: "This email/password is already linked to another account or this phone.", variant: "destructive" });
          } else {
            toast({ title: "Email Link Error", description: `Could not link email: ${linkError.message}`, variant: "destructive" });
          }
          // Decide if you want to proceed with signup without email link or halt
          // For now, we proceed but email won't be linked
        }
      }

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: finalEmail, // Store the linked email, or null if not linked/failed
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
  
  if (user && !initialLoading) {
     return <GlobalLoading />;
  }

  const sendOtpButtonDisabled = loading || !phoneNumber.trim() || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError;
  const verifyOtpButtonDisabled = loading || otp.length !== 6 || (phoneEmail && !phonePassword) || (phonePassword && phonePassword !== phoneConfirmPassword);

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
              console.log(`SIGNUP_PAGE: Auth method changed to ${newAuthMethod}`);
              setAuthMethod(newAuthMethod);
              // Reset phone auth specific states
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
              setPhoneEmail("");
              setPhonePassword("");
              setPhoneConfirmPassword("");
              // Critical: Reset reCAPTCHA states to trigger re-initialization if switching to phone
              setIsRecaptchaInitializing(false); // Allow re-init
              setIsRecaptchaReady(false);      // Mark as not ready
              setRecaptchaError(null);         // Clear any old errors
              if (recaptchaVerifierRef.current) { // Attempt to clear any existing instance
                try { 
                  console.log("SIGNUP_PAGE: Clearing reCAPTCHA verifier due to auth method switch.");
                  recaptchaVerifierRef.current.clear(); 
                } catch(e) {
                  console.warn("SIGNUP_PAGE: Error clearing reCAPTCHA on method switch:", e);
                }
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
                      aria-live="polite"
                  >
                    {isRecaptchaInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isRecaptchaInitializing ? 'Initializing reCAPTCHA...' : (loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP')}
                  </Button>
                  {/* Visual feedback for reCAPTCHA state */}
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
                        An OTP was sent to {phoneNumber}. 
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { 
                            console.log("SIGNUP_PAGE: User clicked 'Change Number or Resend OTP'.");
                            setOtpSent(false); 
                            setConfirmationResult(null); 
                            setOtp('');
                            setIsRecaptchaReady(false); 
                            setRecaptchaError(null);
                            if(recaptchaVerifierRef.current) {
                              try { recaptchaVerifierRef.current.clear(); } catch(e) {/* ignore */}
                              recaptchaVerifierRef.current = null;
                            }
                        }}>Change Number or Resend?</Button>
                    </p>
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phoneEmail">Email (Optional)</Label>
                     <Input id="phoneEmail" type="email" placeholder="you@example.com" value={phoneEmail} onChange={(e) => setPhoneEmail(e.target.value)} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phonePassword">Password (Optional, if email provided)</Label>
                     <Input id="phonePassword" type="password" placeholder="••••••••" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} disabled={loading || !phoneEmail} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="phoneConfirmPassword">Confirm Password (if password provided)</Label>
                     <Input id="phoneConfirmPassword" type="password" placeholder="••••••••" value={phoneConfirmPassword} onChange={(e) => setPhoneConfirmPassword(e.target.value)} disabled={loading || !phonePassword} />
                  </div>
                  <Button onClick={handleVerifyOtpAndSignup} className="w-full" disabled={verifyOtpButtonDisabled}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify OTP & Sign Up
                  </Button>
                </>
              )}
              {/* This div must be present in the DOM for reCAPTCHA to render, ensure it's always there when authMethod is phone */}
              {authMethod === "phone" && <div ref={recaptchaContainerRef} id="recaptcha-container-signup"></div>}
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

