"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle2, Lock, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validation schema for forgot password
const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, { message: "Email is required." })
    .email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordDialogProps {
  trigger?: React.ReactNode;
}

export function ForgotPasswordDialog({ trigger }: ForgotPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onSubmit",
    criteriaMode: "firstError",
    shouldFocusError: false,
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    // Clear any form errors first
    form.clearErrors();
    setLoading(true);
    
    console.log("🔐 Password reset requested for email:", values.email);
    console.log("📧 Firebase Auth Domain:", auth.config.authDomain);
    console.log("📧 Firebase Project ID:", auth.config.apiKey ? "API Key is set" : "⚠️ API Key missing!");
    
    try {
      // Configure action code settings for better email handling
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: false,
      };
      
      console.log("📬 Sending email with settings:", actionCodeSettings);
      
      await sendPasswordResetEmail(auth, values.email, actionCodeSettings);
      
      console.log("✅ Password reset email sent successfully to:", values.email);
      console.log("📨 Check spam folder and wait 1-2 minutes for email delivery");
      
      setEmailSent(true);
      
      // Small delay to ensure state is updated before showing toast
      setTimeout(() => {
        toast({
          title: "Password Reset Email Sent",
          description: "Check your inbox and spam folder for instructions to reset your password.",
        });
      }, 50);

      // Reset form after 5 seconds and close dialog
      setTimeout(() => {
        form.reset();
        setEmailSent(false);
        setOpen(false);
      }, 5000);
    } catch (error: any) {
      console.error("❌ Password reset error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      let errorMessage = "An unexpected error occurred. Please try again.";
      let shouldShowError = true;
      
      // Handle Firebase error codes
      switch (error.code) {
        case "auth/user-not-found":
          console.warn("⚠️ Email not found in Firebase Auth");
          errorMessage = "No account found with this email address. Please check your email or sign up.";
          shouldShowError = true;
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format.";
          shouldShowError = true;
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many password reset attempts. Please try again later.";
          shouldShowError = true;
          break;
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection and try again.";
          shouldShowError = true;
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled. Please contact support.";
          shouldShowError = true;
          break;
        case "auth/missing-android-pkg-name":
        case "auth/missing-continue-uri":
        case "auth/missing-ios-bundle-id":
        case "auth/invalid-continue-uri":
        case "auth/unauthorized-continue-uri":
          console.error("🔧 Firebase configuration error - check your Firebase Console settings");
          errorMessage = "Email service configuration error. Please contact support.";
          shouldShowError = true;
          break;
        default:
          console.error("🔍 Unknown error code:", error.code);
          errorMessage = `Failed to send reset email: ${error.message}`;
          shouldShowError = true;
      }

      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      setOpen(newOpen);
      if (!newOpen) {
        // Reset form when dialog closes
        setTimeout(() => {
          form.reset({ email: "" });
          setEmailSent(false);
        }, 200);
      } else {
        // Ensure form is reset when dialog opens
        form.reset({ email: "" });
        setEmailSent(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm font-medium hover:text-primary transition-colors"
          >
            Forgot Password?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] gap-0 p-0 overflow-hidden shadow-2xl">
        {emailSent ? (
          // Success State
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
            {/* Success Animation Container */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-primary-foreground animate-in zoom-in duration-300" />
              </div>
            </div>

            {/* Success Message */}
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-foreground">
                Check Your Email!
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                We've sent a password reset link to your email address. Click the link to create a new password.
              </p>
            </div>

            {/* Email Sent Details */}
            <div className="w-full max-w-sm space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-left space-y-1">
                    <p className="text-sm font-medium">
                      Check your inbox
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Don't forget to check your spam folder
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-left space-y-1">
                    <p className="text-sm font-medium">
                      Link expires in 1 hour
                    </p>
                    <p className="text-xs text-muted-foreground">
                      For your security, the link is single-use
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full"
              >
                Got it, thanks!
              </Button>
              
              <p className="text-xs text-muted-foreground pt-2">
                Didn't receive an email?{" "}
                <button
                  onClick={() => {
                    setEmailSent(false);
                    form.reset({ email: "" });
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Try again
                </button>
              </p>
            </div>
          </div>
        ) : (
          // Form State
          <>
            {/* Header Section */}
            <div className="relative bg-muted/30 p-8 pb-6 border-b">
              <div className="space-y-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
                  <Lock className="h-6 w-6 text-primary-foreground" />
                </div>

                {/* Title & Description */}
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-bold text-foreground">
                    Reset Your Password
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    No worries! Enter your email address and we'll send you instructions to reset your password.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="p-8 pt-6 space-y-6">
              <Form {...form}>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // ✨ Prevent event from bubbling to parent form
                    // Handle form submission without showing validation errors
                    form.handleSubmit(
                      onSubmit,
                      (errors) => {
                        // Silently handle validation errors without toast
                        console.log("Form validation errors:", errors);
                      }
                    )(e);
                  }} 
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="name@example.com"
                              type="email"
                              autoComplete="email"
                              disabled={loading}
                              className="pl-10 h-11"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Info Box */}
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <div className="flex gap-3">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Quick & Secure Reset
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          You'll receive an email with a secure link to create a new password. The process takes less than a minute!
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-3 sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      disabled={loading}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="flex-1 h-11"
                      onClick={(e) => {
                        e.stopPropagation(); // ✨ Prevent click from bubbling
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Reset Link
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>

              {/* Footer Help Text */}
              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  Remember your password?{" "}
                  <button
                    onClick={() => handleOpenChange(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    Back to login
                  </button>
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
