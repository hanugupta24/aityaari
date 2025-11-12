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
import {
  Loader2,
  ShieldCheck,
  Sparkles,
  CheckCircle,
  Zap,
  BarChart,
  Brain,
  Users,
  CalendarDays,
  CalendarRange,
  Calendar,
  Crown,
  Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SubscriptionPage() {
  const {
    user,
    userProfile,
    refreshUserProfile,
    initialLoading: authInitialLoading,
    loading: authProfileLoading,
  } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const isLoading = authInitialLoading || authProfileLoading;

  const plans = [
    {
      id: "monthly",
      name: "Monthly Plan",
      price: 99,
      billingCycle: "month",
      icon: CalendarDays,
      description: "Flexible monthly access.",
      priceDisplay: "₹99 / month",
    },
    {
      id: "quarterly",
      name: "Quarterly Plan",
      price: 249,
      billingCycle: "quarter",
      icon: CalendarRange,
      description: "Save with 3-month billing.",
      priceDisplay: "₹249 / quarter",
      highlight: "Popular",
    },
    {
      id: "yearly",
      name: "Yearly Plan",
      price: 899,
      billingCycle: "year",
      icon: Calendar,
      description: "Best value, billed annually.",
      priceDisplay: "₹899 / year",
      highlight: "Best Value",
    },
  ];

  const plusFeatures = [
    { icon: Zap, text: "Unlimited interview sessions" },
    { icon: Brain, text: "Access to all question types & difficulties" },
    {
      icon: BarChart,
      text: "More detailed performance analytics (coming soon)",
    },
    { icon: Users, text: "Priority AI model access for faster responses" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-medium">
            Loading subscription options...
          </p>
        </div>
      </div>
    );
  }

  if (!user && !isLoading) {
    router.push("/login");
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (userProfile && userProfile.isPlusSubscriber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          <Card className="shadow-lg border-primary/20 animate-in fade-in-0 zoom-in-95 duration-500">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-in zoom-in-50 duration-700 delay-200">
                <Crown className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <CardTitle className="flex items-center justify-center text-2xl gap-2">
                <CheckCircle className="h-8 w-8 text-green-500 animate-bounce" />
                You're Already a Plus Member!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg border border-border">
                <p className="text-muted-foreground leading-relaxed">
                  Thank you for being a valued aiTyaari Plus subscriber. You
                  have access to all premium features, including unlimited
                  interviews with the{" "}
                  <span className="font-semibold text-foreground">
                    {userProfile.subscriptionPlan
                      ? userProfile.subscriptionPlan.charAt(0).toUpperCase() +
                        userProfile.subscriptionPlan.slice(1)
                      : ""}{" "}
                    plan
                  </span>
                  .
                </p>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Premium Member</span>
                <Star className="h-4 w-4 text-yellow-500" />
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/dashboard" className="w-full">
                <Button
                  variant="outline"
                  className="w-full transition-all duration-300 transform hover:scale-105"
                >
                  Back to Dashboard
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upgrade.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(planId);
    console.log(
      `SubscriptionPage: Simulating payment process for plan: ${planId} for user: ${user.uid}`
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          isPlusSubscriber: true,
          subscriptionPlan: planId,
          subscriptionStart: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      console.log(
        `SubscriptionPage: Firestore updated for user ${user.uid}. isPlusSubscriber: true, plan: ${planId}`
      );

      await refreshUserProfile();
      console.log("SubscriptionPage: User profile refreshed in AuthContext.");

      toast({
        title: "Upgrade Successful!",
        description: `Welcome to aiTyaari Plus! You now have unlimited access with the ${
          plans.find((p) => p.id === planId)?.name || "selected plan"
        }.`,
        variant: "default",
        duration: 7000,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Error upgrading to Plus:", error);
      toast({
        title: "Upgrade Failed",
        description:
          "Something went wrong while processing your upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
      console.log("SubscriptionPage: Payment simulation finished.");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto py-12 px-4 space-y-16">
        {/* Header Section */}
        <header className="text-center space-y-6 animate-in fade-in-0 slide-in-from-top-4 duration-1000">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Sparkles className="h-12 w-12 text-primary animate-spin-slow" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Unlock aiTyaari Plus
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Choose the plan that's right for you and supercharge your
              interview preparation.
            </p>
          </div>
        </header>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => {
            const PlanIcon = plan.icon;
            const isPopular = plan.highlight === "Popular";
            const isBestValue = plan.highlight === "Best Value";

            return (
              <div
                key={plan.id}
                className={`relative animate-in fade-in-0 slide-in-from-bottom-4 duration-700`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {/* Highlight Badge */}
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-bold text-primary-foreground shadow-lg animate-bounce ${
                        isBestValue ? "bg-primary" : "bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isBestValue ? (
                          <Crown className="h-4 w-4" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                        {plan.highlight}
                      </div>
                    </div>
                  </div>
                )}

                <Card
                  className={`
                  h-full flex flex-col relative overflow-hidden
                  hover:shadow-xl hover:scale-105 transition-all duration-500
                  
                `}
                >
                  {/* Content */}
                  <div className="relative z-10">
                    <CardHeader className="pb-4 text-center">
                      <div className="space-y-4">
                        {/* Icon */}
                        <div
                          className={`mx-auto w-16 h-16 ${
                            isBestValue
                              ? "bg-primary/20"
                              : isPopular
                              ? "bg-accent/20"
                              : "bg-muted"
                          } rounded-2xl flex items-center justify-center shadow-sm transform hover:rotate-12 transition-transform duration-300`}
                        >
                          <PlanIcon
                            className={`h-8 w-8 ${
                              isBestValue
                                ? "text-primary"
                                : isPopular
                                ? "text-accent"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>

                        {/* Plan Name */}
                        <CardTitle className="text-2xl font-bold">
                          {plan.name}
                        </CardTitle>

                        {/* Description */}
                        <CardDescription className="text-base">
                          {plan.description}
                        </CardDescription>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-grow space-y-6 px-6">
                      {/* Price */}
                      <div className="text-center">
                        <div
                          className={`text-4xl md:text-5xl font-bold ${
                            isBestValue
                              ? "text-primary"
                              : isPopular
                              ? "text-accent"
                              : "text-foreground"
                          }`}
                        >
                          {plan.priceDisplay}
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-3">
                        {plusFeatures.map((feature, featureIndex) => (
                          <div
                            key={featureIndex}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 hover:bg-muted transition-colors duration-300"
                          >
                            <div
                              className={`p-1 rounded-full ${
                                isBestValue
                                  ? "bg-primary/20"
                                  : isPopular
                                  ? "bg-accent/20"
                                  : "bg-muted"
                              }`}
                            >
                              <feature.icon
                                className={`h-4 w-4 ${
                                  isBestValue
                                    ? "text-primary"
                                    : isPopular
                                    ? "text-accent"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground leading-relaxed">
                              {feature.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="mt-auto p-6">
                      <Button
                        size="lg"
                        className={`
                          w-full text-lg py-4 font-semibold
                          hover:shadow-lg hover:scale-105
                          transition-all duration-300
                          ${isProcessing === plan.id ? "animate-pulse" : ""}
                          ${
                            isBestValue
                              ? "bg-primary hover:bg-primary/90"
                              : isPopular
                              ? "bg-accent hover:bg-accent/90"
                              : "bg-accent hover:bg-accent/90"
                          }
                        `}
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={!!isProcessing || isLoading }
                      >
                        {isProcessing === plan.id ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Processing...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5" />
                            Upgrade Securely
                          </div>
                        )}
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Footer Section */}
        <div className="text-center space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-700">
          <div className="p-6 bg-muted/60 backdrop-blur-sm rounded-2xl border border-border shadow-sm max-w-2xl mx-auto">
            <p className="text-muted-foreground leading-relaxed">
              All payments are processed securely. This is a mock payment for
              demonstration purposes. No real transaction will occur.
            </p>
          </div>

          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground transition-all duration-300"
            >
              Maybe Later, Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
