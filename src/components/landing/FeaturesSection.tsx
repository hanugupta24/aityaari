"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Zap,
  LineChart,
  Target,
  BookOpen,
  Mic,
} from "lucide-react";
import Image from "next/image";

export function FeaturesSection() {
  const features = [
    {
      title: "AI-Powered Questions",
      description: "Our advanced AI generates personalized interview questions based on your target role, experience level, and industry. Each session is unique and tailored to your needs.",
      icon: Brain,
      image: "/homepageImages/img5.webp",
      highlights: [
        "Role-specific questions",
        "Adaptive difficulty",
        "Industry standards",
      ],
    },
    {
      title: "Real-time Feedback",
      description: "Get instant, actionable feedback on your answers. Our AI analyzes your response quality, communication skills, and technical accuracy to help you improve immediately.",
      icon: Zap,
      image: "/homepageImages/img6.webp",
      highlights: [
        "Instant scoring",
        "Detailed analysis",
        "Improvement tips",
      ],
    },
    {
      title: "Performance Tracking",
      description: "Monitor your progress over time with comprehensive analytics. Track your improvement across different interview types and identify areas that need more practice.",
      icon: LineChart,
      image: "/homepageImages/img7.webp",
      highlights: [
        "Progress dashboard",
        "Skill breakdown",
        "Trend analysis",
      ],
    },
    {
      title: "Comprehensive Analytics",
      description: "Deep dive into your interview performance with detailed metrics. Understand your strengths, weaknesses, and receive personalized recommendations for improvement.",
      icon: Target,
      image: "/homepageImages/img8.webp",
      highlights: [
        "Detailed reports",
        "Strength analysis",
        "Custom recommendations",
      ],
    },
    {
      title: "Personalized Learning",
      description: "Follow customized learning paths designed specifically for your goals. Our AI creates a structured preparation plan based on your performance and target role.",
      icon: BookOpen,
      image: "/homepageImages/img9.webp",
      highlights: [
        "Custom study plans",
        "Adaptive learning",
        "Goal tracking",
      ],
    },
    {
      title: "Multi-format Support",
      description: "Practice with voice, video, or text-based interviews. Choose the format that best matches your target interview style and comfort level.",
      icon: Mic,
      image: "/homepageImages/img10.webp",
      highlights: [
        "Voice interviews",
        "Video sessions",
        "Text-based practice",
      ],
    },
  ];

  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent"></div>
      
      <div className="container relative z-10 mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 text-sm px-4 py-1">Platform Features</Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Powerful Features for <span className="text-primary">Interview Success</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to prepare, practice, and excel in your interviews, all in one comprehensive platform.
          </p>
        </motion.div>

        {/* Features list */}
        <div className="max-w-7xl mx-auto space-y-32">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isEven = index % 2 === 0;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  isEven ? "" : "lg:grid-flow-dense"
                }`}
              >
                {/* Content */}
                <div className={isEven ? "" : "lg:col-start-2"}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Feature {index + 1}
                    </Badge>
                  </div>

                  <h3 className="text-3xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Highlights */}
                  <div className="grid grid-cols-1 gap-3">
                    {feature.highlights.map((highlight, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + idx * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="font-medium">{highlight}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Image */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className={`${isEven ? "" : "lg:col-start-1 lg:row-start-1"}`}
                >
                  <div className="relative group">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-3xl group-hover:bg-primary/30 transition-colors duration-500"></div>
                    
                    {/* Image container */}
                    <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl bg-card">
                      <div className="aspect-[4/3] relative">
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

