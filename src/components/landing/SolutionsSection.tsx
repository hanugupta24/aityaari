"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  GraduationCap,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Award,
  Zap,
} from "lucide-react";

export function SolutionsSection() {
  const solutions = [
    {
      title: "Job Seekers",
      description: "Land your dream job with confidence through targeted interview practice and personalized feedback.",
      icon: Briefcase,
      color: "from-blue-500/20 to-cyan-500/20",
      borderColor: "border-blue-500/30",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      stats: { label: "Success Rate", value: "94%" },
      benefits: [
        "Role-specific questions",
        "Company-specific prep",
        "Salary negotiation tips",
      ],
    },
    {
      title: "Students",
      description: "Prepare for campus placements and internships with comprehensive practice and guidance.",
      icon: GraduationCap,
      color: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      stats: { label: "Students Helped", value: "5K+" },
      benefits: [
        "Campus placement focus",
        "Internship preparation",
        "Resume building tips",
      ],
    },
    {
      title: "Career Switchers",
      description: "Transition smoothly to new roles with industry-specific interview scenarios and expert insights.",
      icon: RefreshCw,
      color: "from-orange-500/20 to-red-500/20",
      borderColor: "border-orange-500/30",
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-500",
      stats: { label: "Successful Switches", value: "2K+" },
      benefits: [
        "Industry transition guide",
        "Skill gap analysis",
        "Portfolio preparation",
      ],
    },
    {
      title: "Interview Mastery",
      description: "Master both behavioral and technical interviews with comprehensive practice and expert strategies.",
      icon: Target,
      color: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/30",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
      stats: { label: "Questions Practiced", value: "50K+" },
      benefits: [
        "Behavioral interviews",
        "Technical assessments",
        "System design prep",
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
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
    <section id="solutions" className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.05)_0%,transparent_70%)]"></div>
      
      <div className="container relative z-10 mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 text-sm px-4 py-1">Solutions for Everyone</Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Built for <span className="text-primary">Your Journey</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're a student, job seeker, or career switcher, we have the perfect solution for your interview preparation needs.
          </p>
        </motion.div>

        {/* Solutions grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
        >
          {solutions.map((solution, index) => {
            const Icon = solution.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card
                  className={`h-full group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br ${solution.color} border ${solution.borderColor} relative overflow-hidden`}
                >
                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <CardHeader className="relative">
                    <div className={`w-14 h-14 rounded-2xl ${solution.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`h-7 w-7 ${solution.iconColor}`} />
                    </div>
                    <CardTitle className="text-xl mb-2">{solution.title}</CardTitle>
                    <CardDescription>{solution.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    {/* Stats badge */}
                    <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg backdrop-blur-sm">
                      <span className="text-sm text-muted-foreground">{solution.stats.label}</span>
                      <span className={`text-lg font-bold ${solution.iconColor}`}>
                        {solution.stats.value}
                      </span>
                    </div>

                    {/* Benefits list */}
                    <div className="space-y-2">
                      {solution.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className={`w-1.5 h-1.5 rounded-full ${solution.iconColor.replace('text-', 'bg-')}`}></div>
                          <span className="text-muted-foreground">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-muted-foreground mb-4">Ready to get started?</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => (window.location.href = "/signup")}
          >
            Start Your Free Trial
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

