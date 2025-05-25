
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  useEffect(() => {
    if (authMethod === "phone" && recaptchaContainerRef.current && auth && !recaptchaVerifierRef.current) {
      console.log("SIGNUP: Initializing reCAPTCHA...");
      try {
        const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: "invisible",
          callback: (response: any) => {
            console.log("SIGNUP: reCAPTCHA solved:", response);
          },
          "expired-callback": () => {
            toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
            setLoading(false);
            // Reset the verifier to allow re-initialization on next attempt
            if (recaptchaVerifierRef.current) {
                // Firebase doesn't provide a direct method to "reset" the widget if it expires this way
                // other than creating a new one. Nullifying our ref ensures it's re-created.
                recaptchaVerifierRef.current = null;
            }
          },
        });

        verifier.render().then((widgetId) => {
          console.log("SIGNUP: Invisible reCAPTCHA rendered. Widget ID:", widgetId);
          recaptchaVerifierRef.current = verifier; // IMPORTANT: Store verifier only after successful render
        }).catch((error) => {
          console.error("SIGNUP: Error rendering reCAPTCHA:", error);
          toast({ title: "reCAPTCHA Render Error", description: `Could not render reCAPTCHA: ${error.message}. Phone auth may not work.`, variant: "destructive" });
          recaptchaVerifierRef.current = null; // Nullify on render error
        });

      } catch (error: any) {
        console.error("SIGNUP: Error initializing RecaptchaVerifier instance:", error);
        toast({ title: "reCAPTCHA Init Error", description: `Could not initialize reCAPTCHA: ${error.message}. Phone auth may not work.`, variant: "destructive" });
        recaptchaVerifierRef.current = null;
      }
    } else if (authMethod !== "phone" && recaptchaVerifierRef.current) {
      // If switching away from phone method, clear the ref
      console.log("SIGNUP: Auth method not phone, clearing reCAPTCHA ref.");
      recaptchaVerifierRef.current = null;
    }

    // Cleanup when component unmounts or authMethod changes away from phone
    return () => {
      if (recaptchaVerifierRef.current && authMethod === "phone") {
        console.log("SIGNUP: Cleaning up reCAPTCHA verifier ref on unmount or method change from phone.");
        // Firebase's RecaptchaVerifier cleanup is mostly internal.
        // Nullifying the ref is the main step for our logic.
        recaptchaVerifierRef.current = null;
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
        name: "",
        profileField: "",
        role: "",
        company: null,
        education: "",
        phoneNumber: values.phoneNumber || null, // Save phone if provided
        interviewsTaken: 0,
        isPlusSubscriber: false,
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful", description: "Redirecting to complete your profile..." });
      router.push("/profile");
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

    if (!recaptchaVerifierRef.current) {
        toast({ title: "reCAPTCHA Error", description: "reCAPTCHA not ready. Please wait a moment and try again.", variant: "destructive"});
        setLoading(false);
        return;
    }
    
    try {
      console.log("SIGNUP: Attempting to send OTP to:", phoneNumber);
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
      console.log("SIGNUP: OTP sent successfully. ConfirmationResult:", result);
    } catch (error: any) {
      console.error("SIGNUP: Error sending OTP:", error);
      toast({ title: "Failed to Send OTP", description: error.message || "Please try again.", variant: "destructive" });
      // It might be necessary to reset reCAPTCHA here.
      // For simplicity, user retry might re-initialize it if ref was nulled on expiry.
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
      console.log("SIGNUP: Attempting to verify OTP:", otp);
      const userCredential = await confirmationResult.confirm(otp);
      const firebaseUser = userCredential.user;
      console.log("SIGNUP: Phone number verified, user signed up/in:", firebaseUser.uid);

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
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Signup Successful!", description: "Your account has been created. Redirecting to profile..." });
      router.push("/profile");
    } catch (error: any) {
      console.error("SIGNUP: Error verifying OTP or creating profile:", error);
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
  
  if (!user && !initialLoading && !isRedirecting) {
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
                // When switching auth method, reset phone auth state
                setOtpSent(false);
                setOtp("");
                setPhoneNumber("");
                setConfirmationResult(null);
                // recaptchaVerifierRef will be handled by useEffect
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
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter your phone number including the country code (e.g., +1 for USA, +91 for India).
                      </p>
                    </div>
                    <Button 
                        onClick={handleSendOtp} 
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
                          An OTP was sent to {phoneNumber}. <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => { setOtpSent(false); setConfirmationResult(null); setOtp(''); /* Keep phoneNumber for retry? Or clear: setPhoneNumber(''); */}}>Change Number or Resend?</Button>
                      </p>
                    </div>
                    <Button onClick={handleVerifyOtpAndSignup} className="w-full" disabled={loading || otp.length !== 6}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Verify OTP & Sign Up
                    </Button>
                  </>
                )}
                {/* Container for invisible reCAPTCHA */}
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
  return <GlobalLoading />;
}

    