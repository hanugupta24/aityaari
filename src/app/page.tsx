"use client";

import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Database,
  Mail,
  FileText,
  Sparkles,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Component() {
  // State for staggered animations and mobile menu
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
      },
    },
  };

  const floatVariants = {
    initial: { y: 0 },
    animate: {
      y: [-5, 5, -5],
      transition: {
        duration: 4,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse" as const, // Explicitly type as allowed literal
        ease: "easeInOut",
      },
    },
  };

  const pulseVariants = {
    initial: { scale: 1, opacity: 0.8 },
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8],
      transition: {
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse" as const, // Explicitly type as allowed literal
        ease: "easeInOut",
      },
    },
  };

  const rotateVariants = {
    initial: { rotate: 0 },
    animate: {
      rotate: 360,
      transition: {
        duration: 20,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      },
    },
  };

  const mobileMenuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Green shadows from corners */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-black" />
        {/* Top-right corner */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-green-500/30 via-green-900/20 to-transparent" />
        {/* Bottom-left corner */}
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-green-500/25 via-green-900/15 to-transparent" />
        {/* Bottom-right corner */}
        <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-gradient-to-tl from-green-500/20 via-green-900/10 to-transparent" />
      </div>

      {/* Radial dot pattern - brightest in center */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at center, #10b981 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
            maskImage: `radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%)`,
            WebkitMaskImage: `radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%)`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-2 py-0 lg:px-12 lg:mr-20">
        <div className="flex items-center space-x-2">
          <motion.div
            initial={{ rotate: -45 }}
            animate={{ rotate: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-lg flex items-center justify-center"
          >
            <img
              src="./images/logo_Transparent.svg"
              className="h-30 w-40"
            ></img>
          </motion.div>
          {/* <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-white text-lg sm:text-xl font-semibold"
          >
            aiTyaari
          </motion.span> */}
        </div>

        {/* Desktop Navigation */}

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Desktop Language & CTA */}
          <Link
            href="/login"
            className="text-sm font-medium text-white hover:underline underline-offset-4 hover:text-green-300"
            prefetch={false}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-white hover:underline underline-offset-4 hover:text-green-300"
            prefetch={false}
          >
            Sign Up
          </Link>

          {/* Mobile Menu Button */}
          {/* <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-white p-2"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button> */}
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="lg:hidden absolute top-16 left-0 right-0 z-20 bg-black/95 backdrop-blur-md border-b border-green-500/20"
          >
            <nav className="flex flex-col space-y-4 px-6 py-6">
              <div className="flex items-center justify-between pt-4 border-t border-green-500/20">
                <Link
                  href="/login"
                  className="text-sm font-medium text-white hover:underline underline-offset-4 hover:text-green-300"
                  prefetch={false}
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium text-white hover:underline underline-offset-4 hover:text-green-300"
                  prefetch={false}
                >
                  Sign Up
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promotional banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="relative z-10 flex justify-center mt-4 sm:mt-8 px-4"
      >
        <div
          className="bg-green-600/20 border border-green-500/30 rounded-full px-4 sm:px-6 py-2 flex items-center space-x-2 backdrop-blur-sm hover:cursor-pointer"
          onClick={() => {
            window.location.href = "/signup";
          }}
        >
          <div className="text-green-400 text-xs sm:text-sm font-medium text-center">
            Boost Confidence and get an edge with ai solution
          </div>
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              ease: "easeInOut",
            }}
          >
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
          </motion.div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between px-4 sm:px-6 lg:px-12 mt-8 sm:mt-12 lg:mt-24">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="w-full lg:w-1/2 space-y-4 sm:space-y-6 text-center lg:text-left"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Your AI Powered
            <br />
            Mock Interview
            <br />
            Room
          </h1>

          <p className="text-gray-300 text-base sm:text-lg max-w-md mx-auto lg:mx-0">
            Practice live interview tailored to your dream role - with instant
            scoring, answer analysis, and real time AI interaction
          </p>

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4 justify-center lg:justify-start">
            <Button
              size="lg"
              className="bg-white text-black hover:bg-green-400 hover:text-white px-6 sm:px-8 w-full sm:w-auto"
              onClick={() => {
                window.location.href = "/signup";
              }}
            >
              Get Started Free
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "loop",
                  ease: "easeInOut",
                }}
              >
                <ChevronRight className="w-4 h-4 ml-2 text-green-400 hover:text-white" />
              </motion.div>
            </Button>
          </div>
        </motion.div>

        {/* Floating UI elements */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isLoaded ? "visible" : "hidden"}
          className="w-full lg:w-1/2 relative mt-12 lg:mt-0 flex justify-center"
        >
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96">
            {/* Analysis process notification */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="absolute top-0 right-4 sm:right-8 bg-green-600/20 border border-green-500/30 rounded-full px-3 sm:px-4 py-1 sm:py-2 backdrop-blur-sm"
            >
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate="animate"
                className="flex items-center space-x-1 sm:space-x-2"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 animate-spin" />
                <span className="text-green-400 text-xs sm:text-sm">
                  Analysis process...
                </span>
              </motion.div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="absolute top-10 left-0 sm:right-18 bg-green-600/20 border border-green-500/30 rounded-full px-3 sm:px-4 py-1 sm:py-2 backdrop-blur-sm"
            >
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate="animate"
                className="flex items-center space-x-1 sm:space-x-2"
              >
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-400" />
                <span className="text-green-400 text-xs sm:text-sm">
                  Detailed Feedback
                </span>
              </motion.div>
            </motion.div>

            {/* Central AI icon */}
            <motion.div
              variants={floatVariants}
              initial="initial"
              animate="animate"
              className="absolute bottom-20 left-20 transform -translate-x-1/2 -translate-y-1/2"
            >
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate="animate"
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-green-600/20 border-2 border-green-500/50 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <span className="text-green-400 text-lg sm:text-xl md:text-2xl font-bold">
                  AI
                </span>
              </motion.div>
            </motion.div>

            {/* Connected elements with dotted lines */}
            <motion.div
              variants={itemVariants}
              className="absolute top-12 sm:top-24 right-2 sm:right-4"
            >
              <div className="flex space-x-2 sm:space-x-4">
                <motion.div
                  variants={floatVariants}
                  initial="initial"
                  animate="animate"
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm"
                >
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-400" />
                </motion.div>
                <motion.div
                  variants={floatVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.2 }}
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm"
                >
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-400" />
                </motion.div>
                <motion.div
                  variants={floatVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.4 }}
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm"
                >
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-400" />
                </motion.div>
              </div>
            </motion.div>

            {/* Document icon */}
            <motion.div
              variants={itemVariants}
              className="absolute bottom-16 sm:bottom-20 left-4 sm:left-0"
            >
              <motion.div
                variants={floatVariants}
                initial="initial"
                animate="animate"
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-400" />
              </motion.div>
            </motion.div>

            {/* Sparkle icon */}
            <motion.div
              variants={itemVariants}
              className="absolute bottom-4 sm:bottom-8 right-8 sm:right-12"
            >
              <motion.div
                variants={floatVariants}
                initial="initial"
                animate="animate"
                className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-green-600/20 border border-green-500/30 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <motion.div
                  variants={rotateVariants}
                  initial="initial"
                  animate="animate"
                >
                  <Sparkles className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-400" />
                </motion.div>
              </motion.div>
            </motion.div>

            {/* 48% metric */}
            <motion.div
              variants={itemVariants}
              className="absolute bottom-0 sm:bottom-32 right-0"
            >
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate="animate"
                className="bg-green-600/20 border border-green-500/30 rounded-full w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center backdrop-blur-sm"
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="text-green-400 text-xs sm:text-sm font-bold"
                >
                  90%
                </motion.span>
              </motion.div>
            </motion.div>

            {/* Dotted connection lines - scaled for mobile */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: -1 }}
            >
              <defs>
                <pattern
                  id="dots"
                  x="0"
                  y="0"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="3" cy="3" r="0.8" fill="#10b981" opacity="0.5" />
                </pattern>
              </defs>

              {/* Connection lines with animation - responsive paths */}
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ delay: 1, duration: 1.5 }}
                d="M 160 80 Q 140 110 120 140"
                stroke="url(#dots)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="3 3"
                className="hidden sm:block"
              />
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ delay: 1.2, duration: 1.5 }}
                d="M 90 220 Q 120 190 150 160"
                stroke="url(#dots)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="3 3"
                className="hidden sm:block"
              />
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ delay: 1.4, duration: 1.5 }}
                d="M 220 250 Q 190 220 160 190"
                stroke="url(#dots)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="3 3"
                className="hidden sm:block"
              />

              {/* Simplified mobile paths */}
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.4 }}
                transition={{ delay: 1, duration: 1.5 }}
                d="M 120 60 Q 110 90 100 120"
                stroke="url(#dots)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="2 2"
                className="sm:hidden"
              />
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.4 }}
                transition={{ delay: 1.2, duration: 1.5 }}
                d="M 70 180 Q 90 160 110 140"
                stroke="url(#dots)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="2 2"
                className="sm:hidden"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
