"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  FileText,
  Video,
  HelpCircle,
} from "lucide-react";

export function ResourcesSection() {
  const resources = [
    {
      title: "Learning Hub",
      description: "Access our comprehensive library of interview guides and tips",
      icon: BookOpen,
      items: ["Interview Strategies", "Common Questions", "Industry Insights"],
    },
    {
      title: "Blog & Articles",
      description: "Stay updated with the latest interview trends and techniques",
      icon: FileText,
      items: ["Expert Advice", "Success Stories", "Career Tips"],
    },
    {
      title: "Study Materials",
      description: "Comprehensive learning resources for interview preparation",
      icon: BookOpen,
      items: ["Practice Questions", "Interview Guides", "Career Resources"],
    },
  ];

  const faqs = [
    {
      question: "How does the mock interview work?",
      answer: "Our platform conducts realistic interview sessions tailored to your target role. You'll receive relevant questions, and after each response, you get instant feedback on your performance, helping you identify strengths and areas for improvement.",
    },
    {
      question: "Can I practice for specific companies?",
      answer: "Yes! We offer company-specific interview preparation for major tech companies and startups. Our question bank includes real interview patterns and common questions asked at these companies.",
    },
    {
      question: "How long does each interview session last?",
      answer: "You can choose from 15, 30, or 45-minute interview sessions based on your availability and preparation needs. We recommend starting with shorter sessions and gradually increasing duration as you build confidence.",
    },
    {
      question: "Is my interview data private and secure?",
      answer: "Absolutely. We take privacy seriously. All your interview sessions, recordings, and performance data are encrypted and stored securely. You have full control over your data and can delete it anytime.",
    },
    {
      question: "Do you offer any free trials?",
      answer: "Yes! New users get access to free trial sessions to experience our platform. You can start practicing immediately without any credit card required.",
    },
  ];


  return (
    <section id="resources" className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08)_0%,transparent_50%)]"></div>
      
      <div className="container relative z-10 mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 text-sm px-4 py-1">Resources & Support</Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to <span className="text-primary">Learn & Grow</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access our comprehensive learning resources, get answers to your questions, and learn from success stories.
          </p>
        </motion.div>

        {/* Resource cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid md:grid-cols-3 gap-6 mb-16 max-w-6xl mx-auto"
        >
          {resources.map((resource, index) => {
            const Icon = resource.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {resource.items.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
              Frequently Asked Questions
            </h3>
            <p className="text-muted-foreground">
              Find answers to common questions about our platform
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-lg px-6 bg-card"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

