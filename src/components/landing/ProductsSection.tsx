"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  BarChart3,
  Clock,
  Sparkles,
  BookOpen,
  Video,
  FileText,
  ArrowRight,
} from "lucide-react";

export function ProductsSection() {
  const products = [
    {
      title: "AI Mock Interviews",
      description: "Experience realistic interview scenarios powered by advanced AI that adapts to your responses in real-time.",
      icon: MessageSquare,
      isPrimary: true,
      features: [
        { icon: Sparkles, text: "Real-time AI interviewer" },
        { icon: BarChart3, text: "Instant feedback & scoring" },
        { icon: Clock, text: "Flexible duration (15-45 min)" },
        { icon: MessageSquare, text: "Industry-specific questions" },
      ],
      cta: "Start Interview",
      href: "/signup",
    },
    {
      title: "Study Materials",
      description: "Comprehensive learning resources including articles, video tutorials, and structured courses.",
      icon: BookOpen,
      isPrimary: false,
      comingSoon: true,
      features: [
        { icon: FileText, text: "In-depth articles" },
        { icon: Video, text: "Video tutorials" },
        { icon: BookOpen, text: "Structured courses" },
        { icon: Sparkles, text: "AI-curated content" },
      ],
      cta: "Coming Soon",
      href: "#",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  return (
    <section id="products" className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>
      
      <div className="container relative z-10 mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 text-sm px-4 py-1">Our Products</Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to <span className="text-primary">Succeed</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From AI-powered mock interviews to comprehensive study materials, we've got you covered.
          </p>
        </motion.div>

        {/* Products grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto"
        >
          {products.map((product, index) => {
            const Icon = product.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card
                  className={`h-full relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                    product.isPrimary
                      ? "border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-transparent"
                      : "border-border"
                  }`}
                >
                  {product.isPrimary && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                    </div>
                  )}
                  
                  {product.comingSoon && (
                    <div className="absolute top-4 right-4">
                      <Badge variant="outline" className="border-muted-foreground/50">
                        Coming Soon
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                        product.isPrimary
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl mb-2">{product.title}</CardTitle>
                    <CardDescription className="text-base">
                      {product.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      {product.features.map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                product.isPrimary
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <FeatureIcon className="h-4 w-4" />
                            </div>
                            <span className={product.comingSoon ? "text-muted-foreground" : ""}>
                              {feature.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full group ${
                        product.isPrimary
                          ? "bg-primary hover:bg-primary/90"
                          : ""
                      }`}
                      variant={product.isPrimary ? "default" : "outline"}
                      disabled={product.comingSoon}
                      onClick={() => {
                        if (!product.comingSoon) {
                          window.location.href = product.href;
                        }
                      }}
                    >
                      {product.cta}
                      {!product.comingSoon && (
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

