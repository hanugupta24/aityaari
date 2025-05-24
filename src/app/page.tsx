
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, Brain, MessageSquareHeart } from "lucide-react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link href="#" className="flex items-center justify-center" prefetch={false}>
          <Rocket className="h-6 w-6 text-primary" />
          <span className="ml-2 text-lg font-semibold">{siteConfig.name}</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
            Login
          </Link>
          <Link href="/signup" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
            Sign Up
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Ace Your Interviews with <span className="text-primary">{siteConfig.name}</span>
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Leverage AI to practice interviews, get real-time feedback, and land your dream job. Personalized questions and conversational practice.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/signup" passHref>
                    <Button size="lg" className="w-full min-[400px]:w-auto">Get Started Free</Button>
                  </Link>
                  <Link href="#features" passHref>
                     <Button size="lg" variant="outline" className="w-full min-[400px]:w-auto">Learn More</Button>
                  </Link>
                </div>
              </div>
              <Image
                src="https://placehold.co/600x400.png?bg=3F51B5&fc=FFFFFF"
                width="600"
                height="400"
                alt="AI Interview Practice"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
                data-ai-hint="interview preparation"
              />
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm text-secondary-foreground">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Everything You Need to Succeed</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  {siteConfig.name} provides cutting-edge tools to help you prepare for any interview scenario.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:gap-16 mt-12">
              <div className="grid gap-1 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                <Brain className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-lg font-bold">AI-Generated Questions</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time, tailored questions based on your profile and the role you're targeting.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                <MessageSquareHeart className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-lg font-bold">Conversational Practice</h3>
                <p className="text-sm text-muted-foreground">
                  Engage in spoken interviews with our AI, just like a real conversation.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                 <Rocket className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-lg font-bold">Detailed Feedback</h3>
                <p className="text-sm text-muted-foreground">
                  Receive comprehensive analysis of your answers, with tips for improvement.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
