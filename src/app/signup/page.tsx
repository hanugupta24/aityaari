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
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertTriangle, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteConfig } from "@/config/site";
import { GlobalLoading } from "@/components/common/GlobalLoading";
import Link from "next/link";

const emailSignupSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z.string(),
    phoneNumber: z
      .string()
      .min(10, { message: "Phone number must be at least 10 digits." })
      .max(15, { message: "Phone number can be at most 15 digits." })
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

const phoneSignupSchema = z
  .object({
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
    confirmPassword: z.string(),
    email: z
      .string()
      .email({ message: "Invalid email address." })
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

type EmailSignupFormValues = z.infer<typeof emailSignupSchema>;
type PhoneSignupFormValues = z.infer<typeof phoneSignupSchema>;

const otpSchema = z.string().length(6, "OTP must be 6 digits.");

const RECAPTCHA_CONTAINER_ID_SIGNUP = "recaptcha-container-signup";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Email verification states
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Phone verification states
  const [phoneSignupData, setPhoneSignupData] =
    useState<PhoneSignupFormValues | null>(null);
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [isRecaptchaInitializing, setIsRecaptchaInitializing] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialLoading && user && (isEmailVerified || user.emailVerified)) {
      setIsRedirecting(true);
      router.push("/profile");
    }
  }, [user, initialLoading, router, isEmailVerified]);

  // Check email verification status
  useEffect(() => {
    if (user && !user.emailVerified && emailVerificationSent) {
      const checkVerification = setInterval(async () => {
        await user.reload();
        console.log("user", user);
        if (user.emailVerified) {
          setIsEmailVerified(true);
          clearInterval(checkVerification);
          toast({
            title: "Email Verified!",
            description: "Your email has been successfully verified.",
          });
        }
      }, 2000);

      return () => clearInterval(checkVerification);
    }
  }, [user, emailVerificationSent, toast]);

  const initRecaptcha = async (containerId: string) => {
    const pageName = "SIGNUP_PAGE_INIT_RECAPTCHA";
    console.log(
      `${pageName}: Initializing reCAPTCHA for container: ${containerId}`
    );

    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {
        console.warn(`${pageName}: Error clearing old verifier:`, e);
      }
      recaptchaVerifierRef.current = null;
    }

    setIsRecaptchaInitializing(true);
    setIsRecaptchaReady(false);
    setRecaptchaError(null);

    try {
      if (!auth) {
        throw new Error("Firebase auth service not ready.");
      }

      const domContainer = document.getElementById(containerId);
      if (!domContainer) {
        throw new Error(
          `reCAPTCHA container element (ID: ${containerId}) missing from DOM.`
        );
      }

      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: (response: any) => {
          console.log(`${pageName}: reCAPTCHA challenge passed`);
          setIsRecaptchaReady(true);
          setRecaptchaError(null);
        },
        "expired-callback": () => {
          console.warn(`${pageName}: reCAPTCHA challenge expired`);
          setRecaptchaError(
            "reCAPTCHA challenge expired. Please try sending OTP again."
          );
          if (recaptchaVerifierRef.current) {
            try {
              recaptchaVerifierRef.current.clear();
            } catch (e) {
              console.warn(`${pageName}: Error clearing expired reCAPTCHA:`, e);
            }
          }
          recaptchaVerifierRef.current = null;
          setIsRecaptchaReady(false);
        },
      });

      const renderTimeout = 15000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `reCAPTCHA render timed out after ${
                  renderTimeout / 1000
                } seconds`
              )
            ),
          renderTimeout
        )
      );

      await Promise.race([verifier.render(), timeoutPromise]);

      recaptchaVerifierRef.current = verifier;
      setIsRecaptchaReady(true);
      setRecaptchaError(null);
      console.log(`${pageName}: reCAPTCHA setup successful`);
    } catch (error: any) {
      console.error(`${pageName}: reCAPTCHA setup error:`, error);
      setRecaptchaError(
        `reCAPTCHA Setup Error: ${error.message}. Check network connection and domain authorization.`
      );
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          // ignore
        }
      }
      recaptchaVerifierRef.current = null;
      setIsRecaptchaReady(false);
    } finally {
      setIsRecaptchaInitializing(false);
    }
  };

  useEffect(() => {
    if (authMethod === "phone" && auth) {
      if (recaptchaContainerRef.current) {
        if (
          !recaptchaVerifierRef.current &&
          !isRecaptchaInitializing &&
          !isRecaptchaReady
        ) {
          initRecaptcha(RECAPTCHA_CONTAINER_ID_SIGNUP);
        }
      } else {
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (e) {
            // ignore
          }
          recaptchaVerifierRef.current = null;
        }
        setIsRecaptchaReady(false);
        setRecaptchaError(null);
        setIsRecaptchaInitializing(false);
      }
    } else {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.warn("Error clearing reCAPTCHA:", e);
        }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setRecaptchaError(null);
      setIsRecaptchaInitializing(false);
    }

    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.warn("Cleanup - Error clearing verifier:", e);
        }
        recaptchaVerifierRef.current = null;
      }
      setIsRecaptchaReady(false);
      setRecaptchaError(null);
      setIsRecaptchaInitializing(false);
    };
  }, [authMethod, auth, recaptchaContainerRef.current]);

  const handleEmailSignup = async (values: EmailSignupFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const firebaseUser = userCredential.user;

      // Send email verification
      await sendEmailVerification(firebaseUser);
      setEmailVerificationSent(true);

      // Save user data to Firestore
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
        emailVerified: true,
        phoneVerified: false,
      });

      toast({
        title: "Account Created Successfully",
        description:
          "Please check your email and click the verification link to continue.",
      });
    } catch (error: any) {
      console.error("Email Signup error:", error);
      let errorMessage = "An unexpected error occurred.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already registered. Please login instead.";
      } else if (error.code === "auth/weak-password") {
        errorMessage =
          "Password is too weak. Please choose a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }

      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignupStart = async (values: PhoneSignupFormValues) => {
    const validation = phoneSignupSchema.safeParse(values);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (!recaptchaVerifierRef.current || !isRecaptchaReady) {
      toast({
        title: "reCAPTCHA Error",
        description:
          recaptchaError || "reCAPTCHA not ready. Please wait and try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRecaptchaError(null);

    try {
      const result = await signInWithPhoneNumber(
        auth,
        values.phoneNumber,
        recaptchaVerifierRef.current
      );
      setConfirmationResult(result);
      setPhoneSignupData(values);
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: `An OTP has been sent to ${values.phoneNumber}.`,
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      let errorMessage = "Please try again.";

      if (error.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      }

      toast({
        title: "Failed to Send OTP",
        description: errorMessage,
        variant: "destructive",
      });

      if (
        error.code === "auth/captcha-check-failed" ||
        error.code === "auth/too-many-requests" ||
        error.code === "auth/network-request-failed"
      ) {
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (e) {
            console.warn("Error clearing reCAPTCHA after OTP send error:", e);
          }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false);
        setRecaptchaError("reCAPTCHA error. Please try sending OTP again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndCompleteSignup = async () => {
    setLoading(true);

    const otpValidation = otpSchema.safeParse(otp);
    if (!otpValidation.success) {
      toast({
        title: "Invalid OTP",
        description: otpValidation.error.errors[0].message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!confirmationResult || !phoneSignupData) {
      toast({
        title: "Error",
        description: "OTP not sent yet or signup data missing.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const userCredential = await confirmationResult.confirm(otp);
      const firebaseUser = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: phoneSignupData.email || null,
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
        emailVerified: phoneSignupData.email ? false : true, // If no email provided, mark as verified
        phoneVerified: true,
        // Store password hash would be handled by your backend in a real app
        // For now, we're just using Firebase Auth's built-in password handling
      });

      toast({
        title: "Signup Successful!",
        description: "Your phone number has been verified. Welcome!",
      });

      // If email was provided, we could send verification here too
      // But for simplicity, we'll just redirect to dashboard
      setIsEmailVerified(true);
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      let errorMessage = "Please check the OTP and try again.";

      if (error.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid OTP. Please check and try again.";
      } else if (error.code === "auth/code-expired") {
        errorMessage = "OTP has expired. Please request a new one.";
      }

      toast({
        title: "OTP Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user);
        toast({
          title: "Verification Email Sent",
          description: "Please check your email for the verification link.",
        });
      } catch (error: any) {
        toast({
          title: "Failed to Send Email",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  if (initialLoading || isRedirecting) {
    return <GlobalLoading />;
  }

  // Show email verification screen if user exists but email not verified
  if (user && emailVerificationSent && !isEmailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{user.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              <p>Click the link in your email to verify your account.</p>
              <p className="mt-2">
                Can't find the email? Check your spam folder.
              </p>
            </div>
            <Button
              onClick={handleResendEmailVerification}
              variant="outline"
              className="w-full"
            >
              Resend Verification Email
            </Button>
          </CardContent>
          <CardFooter className="text-center text-sm">
            <p className="w-full text-center">
              Wrong email?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => {
                  auth.signOut();
                  setEmailVerificationSent(false);
                }}
              >
                Start Over
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const sendOtpButtonDisabled =
    loading || isRecaptchaInitializing || !isRecaptchaReady || !!recaptchaError;

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">
            Create an Account
          </CardTitle>
          <CardDescription className="text-center">
            Get started with {siteConfig.name} today!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={authMethod}
            onValueChange={(value) => {
              const newAuthMethod = value as "email" | "phone";
              setAuthMethod(newAuthMethod);
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
              setPhoneSignupData(null);
            }}
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
                  const confirmPassword = formData.get(
                    "confirmPassword"
                  ) as string;
                  const phoneNumber = formData.get("phoneNumber") as string;

                  const validation = emailSignupSchema.safeParse({
                    email,
                    password,
                    confirmPassword,
                    phoneNumber,
                  });
                  if (!validation.success) {
                    toast({
                      title: "Validation Error",
                      description: validation.error.errors[0].message,
                      variant: "destructive",
                    });
                    return;
                  }

                  handleEmailSignup({
                    email,
                    password,
                    confirmPassword,
                    phoneNumber,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="emailSignup">Email</Label>
                  <Input
                    id="emailSignup"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="passwordSignup">Password</Label>
                  <Input
                    id="passwordSignup"
                    name="password"
                    placeholder="••••••••"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPasswordSignup">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPasswordSignup"
                    name="confirmPassword"
                    placeholder="••••••••"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="emailBasedPhoneNumberSignup">
                    Phone Number (Optional)
                  </Label>
                  <Input
                    id="emailBasedPhoneNumberSignup"
                    name="phoneNumber"
                    placeholder="e.g., +15551234567"
                    type="tel"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign Up with Email
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="pt-4 space-y-4">
              {authMethod === "phone" && (
                <div
                  ref={recaptchaContainerRef}
                  id={RECAPTCHA_CONTAINER_ID_SIGNUP}
                ></div>
              )}

              {!otpSent ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const phoneNumber = formData.get("phoneNumber") as string;
                    const password = formData.get("password") as string;
                    const confirmPassword = formData.get(
                      "confirmPassword"
                    ) as string;
                    const email = formData.get("email") as string;

                    handlePhoneSignupStart({
                      phoneNumber,
                      password,
                      confirmPassword,
                      email,
                    });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="phoneNumberSignup">
                      Phone Number (with country code)
                    </Label>
                    <Input
                      id="phoneNumberSignup"
                      name="phoneNumber"
                      type="tel"
                      placeholder="+15551234567"
                      required
                      disabled={loading || isRecaptchaInitializing}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your phone number including the country code.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phonePasswordSignup">Password</Label>
                    <Input
                      id="phonePasswordSignup"
                      name="password"
                      placeholder="••••••••"
                      type="password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneConfirmPasswordSignup">
                      Confirm Password
                    </Label>
                    <Input
                      id="phoneConfirmPasswordSignup"
                      name="confirmPassword"
                      placeholder="••••••••"
                      type="password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneBasedEmailSignup">
                      Email (Optional)
                    </Label>
                    <Input
                      id="phoneBasedEmailSignup"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={sendOtpButtonDisabled}
                  >
                    {(loading || isRecaptchaInitializing) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isRecaptchaInitializing
                      ? "Initializing reCAPTCHA..."
                      : loading
                      ? "Sending OTP..."
                      : "Send OTP"}
                  </Button>

                  {!isRecaptchaInitializing &&
                    !isRecaptchaReady &&
                    !recaptchaError &&
                    authMethod === "phone" && (
                      <p className="text-xs text-center text-gray-500">
                        Waiting for reCAPTCHA...
                      </p>
                    )}
                  {recaptchaError && authMethod === "phone" && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>reCAPTCHA Problem</AlertTitle>
                      <AlertDescription>{recaptchaError}</AlertDescription>
                    </Alert>
                  )}
                </form>
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
                    <p className="text-xs text-gray-500 mt-1">
                      An OTP was sent to {phoneSignupData?.phoneNumber}.{" "}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => {
                          setOtpSent(false);
                          setConfirmationResult(null);
                          setOtp("");
                          setPhoneSignupData(null);
                          if (recaptchaVerifierRef.current) {
                            try {
                              recaptchaVerifierRef.current.clear();
                            } catch (e) {
                              console.warn(
                                "Error clearing verifier on resend:",
                                e
                              );
                            }
                            recaptchaVerifierRef.current = null;
                          }
                          setIsRecaptchaReady(false);
                          setRecaptchaError(null);
                          setIsRecaptchaInitializing(false);
                        }}
                      >
                        Change Number or Resend?
                      </Button>
                    </p>
                  </div>
                  <Button
                    onClick={handleVerifyOtpAndCompleteSignup}
                    className="w-full"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verify OTP & Complete Signup
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <p className="w-full text-center">
            Already have an account?{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push("/login")}
            >
              Login
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
