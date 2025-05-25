
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
import { Loader2, ShieldCheck, Sparkles, CheckCircle, Zap, BarChart, Brain, Users, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SubscriptionPage() {
  const { user, userProfile, refreshUserProfile, initialLoading: authInitialLoading, loading: authProfileLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // Store plan ID being processed

  const isLoading = authInitialLoading || authProfileLoading;

  const plans = [
    {
      id: "monthly",
      name: "Monthly Plan",
      price: 9.99,
      billingCycle: "month",
      icon: CalendarDays,
      description: "Flexible monthly access.",
      priceDisplay: "$9.99 / month",
    },
    {
      id: "quarterly",
      name: "Quarterly Plan",
      price: 27.99,
      billingCycle: "quarter",
      icon: CalendarRange,
      description: "Save with 3-month billing.",
      priceDisplay: "$27.99 / quarter",
      highlight: "Popular",
    },
    {
      id: "yearly",
      name: "Yearly Plan",
      price: 99.99,
      billingCycle: "year",
      icon: Calendar,
      description: "Best value, billed annually.",
      priceDisplay: "$99.99 / year",
      highlight: "Best Value",
    },
  ];

  const plusFeatures = [
    { icon: Zap, text: "Unlimited interview sessions" },
    { icon: Brain, text: "Access to all question types & difficulties" },
    { icon: BarChart, text: "More detailed performance analytics (coming soon)" },
    { icon: Users, text: "Priority AI model access for faster responses" },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--header-height,4rem)-2rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isLoading) {
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

  const handleUpgrade = async (planId: string) => {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to upgrade.", variant: "destructive"});
        return;
    }
    setIsProcessing(planId);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          isPlusSubscriber: true,
          subscriptionPlan: planId, // Optionally store chosen plan
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await refreshUserProfile(); // Refresh context

      toast({
        title: "Upgrade Successful!",
        description: `Welcome to aiTyaari Plus! You now have unlimited access with the ${plans.find(p => p.id === planId)?.name || 'selected plan'}.`,
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
      setIsProcessing(null);
    }
  };


  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-12">
      <header className="text-center">
        <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Unlock aiTyaari Plus
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Choose the plan that's right for you and supercharge your interview preparation.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const PlanIcon = plan.icon;
          return (
            <Card key={plan.id} className={`flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 ${plan.highlight ? (plan.highlight === "Best Value" ? 'border-2 border-primary ring-2 ring-primary/50' : 'border-2 border-accent ring-2 ring-accent/50') : ''}`}>
              <CardHeader className="pb-4">
                {plan.highlight && (
                  <div className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-2 self-start ${plan.highlight === "Best Value" ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {plan.highlight}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <PlanIcon className="h-8 w-8 text-primary" />
                  <CardTitle className="text-2xl font-semibold">{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <p className="text-4xl font-bold text-foreground">
                  ${plan.price.toFixed(2)}
                  <span className="text-lg font-normal text-muted-foreground"> / {plan.billingCycle}</span>
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plusFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <feature.icon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  size="lg"
                  className="w-full text-lg py-3"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!isProcessing || isLoading}
                  variant={plan.highlight ? (plan.highlight === "Best Value" ? "default" : "default") : "outline"}
                >
                  {isProcessing === plan.id ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-5 w-5" />
                  )}
                  {isProcessing === plan.id ? "Processing..." : "Upgrade Securely"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <div className="text-center text-sm text-muted-foreground">
        <p>All payments are processed securely. This is a mock payment for demonstration purposes. No real transaction will occur.</p>
        <Link href="/dashboard" className="mt-2 inline-block">
          <Button variant="ghost">Maybe Later, Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

