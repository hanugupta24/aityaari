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

const emailLoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;

const phoneSchema = z
  .string()
  .min(
    10,
    "Phone number must be at least 10 digits (including country code, e.g., +1XXXXXXXXXX)."
  )
  .max(15);
const otpSchema = z.string().length(6, "OTP must be 6 digits.");

const RECAPTCHA_CONTAINER_ID_LOGIN = "recaptcha-container-login";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, initialLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [isRecaptchaInitializing, setIsRecaptchaInitializing] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  const emailLoginForm = useForm<EmailLoginFormValues>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!initialLoading && user) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [user, initialLoading, router]);

  const initRecaptcha = async (containerId: string) => {
    const pageName = "LOGIN_PAGE_INIT_RECAPTCHA";
    console.log(
      `${pageName}: Attempting to initialize reCAPTCHA on container ID: ${containerId}. Current verifier: ${!!recaptchaVerifierRef.current}`
    );

    if (!containerId || !document.getElementById(containerId)) {
      setRecaptchaError("reCAPTCHA container not found in DOM");
      setIsRecaptchaInitializing(false);
      return;
    }

    if (recaptchaVerifierRef.current) {
      console.warn(
        `${pageName}: Existing verifier instance found. Clearing before re-init.`
      );
      try {
        recaptchaVerifierRef.current.clear();
        console.log(`${pageName}: Old verifier cleared.`);
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
        console.error(`${pageName}: Firebase auth object is NOT available.`);
        throw new Error("Firebase auth service not ready.");
      }
      const domContainer = document.getElementById(containerId);
      if (!domContainer) {
        console.error(
          `${pageName}: DOM element with ID '${containerId}' NOT FOUND for reCAPTCHA.`
        );
        throw new Error(
          `reCAPTCHA container element (ID: ${containerId}) missing from DOM.`
        );
      }
      console.log(
        `${pageName}: DOM element with ID '${containerId}' FOUND:`,
        domContainer
      );

      console.log(
        `${pageName}: Creating new RecaptchaVerifier instance for element ID: ${containerId}`
      );
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: (response: any) => {
          console.log(
            `${pageName}: reCAPTCHA challenge PASSED (invisible flow). Response:`,
            response
          );
          setIsRecaptchaReady(true);
          setRecaptchaError(null);
        },
        "expired-callback": () => {
          console.warn(`${pageName}: reCAPTCHA challenge EXPIRED.`);
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
      console.log(`${pageName}: New RecaptchaVerifier instance CREATED.`);

      console.log(`${pageName}: Attempting verifier.render()...`);
      const renderTimeout = 15000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `reCAPTCHA render timed out after ${
                  renderTimeout / 1000
                } seconds. Check network and domain authorization.`
              )
            ),
          renderTimeout
        )
      );

      await Promise.race([verifier.render(), timeoutPromise]);

      console.log(
        `${pageName}: verifier.render() promise RESOLVED or didn't time out. Setting verifier ref and ready state.`
      );
      recaptchaVerifierRef.current = verifier;
      setIsRecaptchaReady(true);
      setRecaptchaError(null);
      console.log(
        `${pageName}: reCAPTCHA setup successful. isRecaptchaReady: true`
      );
    } catch (error: any) {
      console.error(
        `${pageName}: CRITICAL ERROR during reCAPTCHA setup:`,
        error
      );
      setRecaptchaError(
        `reCAPTCHA Setup Error: ${error.message}. This often indicates issues with API key domain restrictions or network access to Google's reCAPTCHA services. Check console & network tab, and ensure the reCAPTCHA container div is visible.`
      );
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          /*ignore*/
        }
      }
      recaptchaVerifierRef.current = null;
      setIsRecaptchaReady(false);
    } finally {
      console.log(
        `${pageName}: initRecaptcha finally block. isRecaptchaInitializing -> false`
      );
      setIsRecaptchaInitializing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const container = recaptchaContainerRef.current;

      if (
        authMethod === "phone" &&
        auth &&
        container &&
        !recaptchaVerifierRef.current &&
        !isRecaptchaInitializing &&
        !isRecaptchaReady
      ) {
        clearInterval(interval);
        initRecaptcha(RECAPTCHA_CONTAINER_ID_LOGIN);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [authMethod, auth]);

  const handleEmailLogin = async (values: EmailLoginFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });
      window.location.reload();
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
    setRecaptchaError(null);

    const validation = phoneSchema.safeParse(phoneNumber);
    if (!validation.success) {
      toast({
        title: "Invalid Phone Number",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    if (!recaptchaVerifierRef.current || !isRecaptchaReady) {
      console.error(
        `${pageName}: Send OTP clicked but reCAPTCHA not ready or verifier not set. Verifier set: ${!!recaptchaVerifierRef.current}, isReady: ${isRecaptchaReady}, Error: ${recaptchaError}`
      );
      toast({
        title: "reCAPTCHA Error",
        description:
          recaptchaError ||
          "reCAPTCHA not ready. Please wait or re-check configurations. If this persists, your domain/API key might not be authorized for reCAPTCHA.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      console.log(
        `${pageName}: Attempting signInWithPhoneNumber for ${phoneNumber} with verifier:`,
        recaptchaVerifierRef.current
      );
      const result = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifierRef.current
      );
      setConfirmationResult(result);
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: `An OTP has been sent to ${phoneNumber}.`,
      });
      console.log(`${pageName}: OTP sent successfully.`);
    } catch (error: any) {
      console.error(`${pageName}: Error sending OTP for login:`, error);
      toast({
        title: "Failed to Send OTP",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      if (
        error.code === "auth/captcha-check-failed" ||
        error.code === "auth/invalid-verification-code" ||
        error.code === "auth/too-many-requests" ||
        error.code === "auth/network-request-failed"
      ) {
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (e) {
            console.warn(
              `${pageName}: Error clearing reCAPTCHA after OTP send error:`,
              e
            );
          }
        }
        recaptchaVerifierRef.current = null;
        setIsRecaptchaReady(false);
        setRecaptchaError(
          `reCAPTCHA or OTP error (${error.code}). Please try sending OTP again. The reCAPTCHA widget may need to re-initialize.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndLogin = async () => {
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

    if (!confirmationResult) {
      toast({
        title: "Error",
        description: "OTP not sent yet or confirmation failed.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      await confirmationResult.confirm(otp);
      toast({
        title: "Login Successful!",
        description: "Redirecting to dashboard...",
      });
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

  if (initialLoading || isRedirecting) {
    return <GlobalLoading />;
  }

  const sendOtpButtonDisabled =
    loading ||
    !phoneNumber.trim() ||
    isRecaptchaInitializing ||
    !isRecaptchaReady ||
    !!recaptchaError;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome Back!</CardTitle>
          <CardDescription>
            Sign in to access your {siteConfig.name} dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={authMethod}
            onValueChange={(value) => {
              const newAuthMethod = value as "email" | "phone";
              console.log(
                `LOGIN_PAGE_TABS: Auth method changed to ${newAuthMethod}`
              );
              setAuthMethod(newAuthMethod);
              setOtpSent(false);
              setOtp("");
              setConfirmationResult(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email & Password</TabsTrigger>
              {/* <TabsTrigger value="phone">Phone Number</TabsTrigger> */}
            </TabsList>
            <TabsContent value="email" className="pt-4">
              <Form {...emailLoginForm}>
                <form
                  onSubmit={emailLoginForm.handleSubmit(handleEmailLogin)}
                  className="space-y-4"
                >
                  <FormField
                    control={emailLoginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="emailLogin">Email</Label>
                        <FormControl>
                          <Input
                            id="emailLogin"
                            placeholder="you@example.com"
                            {...field}
                            type="email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailLoginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="passwordLogin">Password</Label>
                        <FormControl>
                          <Input
                            id="passwordLogin"
                            placeholder="••••••••"
                            {...field}
                            type="password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Login
                  </Button>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="phone" className="pt-4 space-y-4">
              {authMethod === "phone" && (
                <div
                  ref={recaptchaContainerRef}
                  id="recaptcha-container-login"
                ></div>
              )}

              {!otpSent ? (
                <>
                  <div>
                    <Label htmlFor="phoneNumberLogin">
                      Phone Number (with country code)
                    </Label>
                    <Input
                      id="phoneNumberLogin"
                      type="tel"
                      placeholder="+91XXXXXXXXXX"
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
                      <p className="text-xs text-center text-muted-foreground">
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
                      An OTP was sent to {phoneNumber}.{" "}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => {
                          console.log(
                            "LOGIN_PAGE: User clicked 'Change Number or Resend OTP'."
                          );
                          setOtpSent(false);
                          setConfirmationResult(null);
                          setOtp("");
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
                    onClick={handleVerifyOtpAndLogin}
                    className="w-full"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
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
