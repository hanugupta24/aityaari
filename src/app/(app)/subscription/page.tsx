
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, Sparkles, CheckCircle, Zap, BarChart, Brain, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function SubscriptionPage() {
  const { user, userProfile, refreshUserProfile, initialLoading: authInitialLoading, loading: authProfileLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const isLoading = authInitialLoading || authProfileLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,4rem)-2rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isLoading) {
    // This should ideally be caught by the AppLayout, but as a safeguard
    router.push("/login");
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (userProfile && userProfile.isPlusSubscriber) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-2xl gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              You're Already a Plus Member!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thank you for being a valued aiTyaari Plus subscriber. You have
              access to all premium features, including unlimited interviews.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleUpgrade = async () => {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to upgrade.", variant: "destructive"});
        return;
    }
    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          isPlusSubscriber: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await refreshUserProfile(); // Refresh context

      toast({
        title: "Upgrade Successful!",
        description: "Welcome to aiTyaari Plus! You now have unlimited access.",
        variant: "default",
        duration: 5000,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Error upgrading to Plus:", error);
      toast({
        title: "Upgrade Failed",
        description: "Something went wrong while processing your upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const plusFeatures = [
    { icon: Zap, text: "Unlimited interview sessions" },
    { icon: Brain, text: "Access to all question types & difficulties" },
    { icon: BarChart, text: "More detailed performance analytics (coming soon)" },
    { icon: Users, text: "Priority AI model access for faster responses" },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary to-accent text-primary-foreground p-8">
          <div className="flex items-center justify-between">
            <CardTitle className="text-4xl font-bold">aiTyaari Plus</CardTitle>
            <Sparkles className="h-12 w-12 text-yellow-300" />
          </div>
          <CardDescription className="text-primary-foreground/80 text-lg mt-2">
            Unlock your full potential and ace your interviews with our premium features.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <h3 className="text-2xl font-semibold mb-6 text-center text-foreground">
            Why Go Plus?
          </h3>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {plusFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                <feature.icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <p className="text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>

          <div className="text-center p-6 bg-muted rounded-lg">
            <p className="text-4xl font-bold text-primary mb-2">$9.99 <span className="text-lg font-normal text-muted-foreground">/ month</span></p>
            <p className="text-sm text-muted-foreground mb-6">Billed monthly. Cancel anytime.</p>
            <Button
              size="lg"
              className="w-full max-w-xs mx-auto text-lg py-6"
              onClick={handleUpgrade}
              disabled={isProcessing || isLoading}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-5 w-5" />
              )}
              {isProcessing ? "Processing Payment..." : "Upgrade to Plus Securely"}
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
                This is a mock payment for demonstration purposes. No real transaction will occur.
            </p>
          </div>
        </CardContent>
      </Card>
       <div className="text-center">
          <Link href="/dashboard">
            <Button variant="ghost">Maybe Later, Back to Dashboard</Button>
          </Link>
      </div>
    </div>
  );
}
