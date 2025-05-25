
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";

interface AuthFormProps {
  formSchema: z.ZodSchema<any>;
  onSubmit: (values: z.infer<AuthFormProps["formSchema"]>) => Promise<void>;
  type: "login" | "signup";
  loading: boolean;
}

export function AuthForm({ formSchema, onSubmit, type, loading }: AuthFormProps) {
  const defaultFormValues: Record<string, string> = { email: "", password: "" };
  if (type === "signup") {
    defaultFormValues.confirmPassword = "";
    // Add phoneNumber to default values if it's part of the signup schema
    // This assumes the schema passed will include phoneNumber for signup type
    if (formSchema.shape && (formSchema.shape as any).phoneNumber) {
      defaultFormValues.phoneNumber = "";
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const cardTitle = type === "login" ? "Welcome Back!" : "Create an Account";
  const cardDescription = type === "login" ? `Sign in to access your ${siteConfig.name} dashboard.` : "Enter your details to get started.";
  const buttonText = type === "login" ? "Login" : "Sign Up";
  const footerLinkHref = type === "login" ? "/signup" : "/login";
  const footerLinkText = type === "login" ? "Don't have an account? Sign Up" : "Already have an account? Login";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">{cardTitle}</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {type === "signup" && (
                <>
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {formSchema.shape && (formSchema.shape as any).phoneNumber && ( // Conditionally render if phoneNumber is in schema
                     <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., +15551234567 or 0123456789" {...field} type="tel" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {buttonText}
              </Button>
              <Link href={footerLinkHref} className="text-sm text-primary hover:underline">
                {footerLinkText}
              </Link>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
