"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Linkedin,
  Twitter,
  Github,
  Mail,
  Instagram
} from "lucide-react";

export function Footer() {

  const footerLinks = {
    products: [
      { name: "AI Mock Interviews", href: "#products" },
      { name: "Study Materials", href: "#products" },
      { name: "Performance Analytics", href: "#features" },
      { name: "Pricing", href: "/signup" },
    ],
    solutions: [
      { name: "For Job Seekers", href: "#solutions" },
      { name: "For Students", href: "#solutions" },
      { name: "For Career Switchers", href: "#solutions" },
      { name: "Interview Preparation", href: "#solutions" },
    ],
    resources: [
      { name: "Blog", href: "#resources" },
      { name: "FAQs", href: "#resources" },
      { name: "Documentation", href: "#resources" },
      { name: "Success Stories", href: "#resources" },
    ],
    company: [
      { name: "About Us", href: "#" },
      { name: "Support", href: "mailto:contact@aityaari.com" },
      { name: "Sitemap", href: "/sitemap-page" },
    ],
    legal: [
      // { name: "Privacy Policy", href: "#" },
      // { name: "Terms of Service", href: "#" },
      // { name: "Cookie Policy", href: "#" },
      // { name: "Sitemap", href: "/sitemap-page" },
    ],
  };

  const socialLinks = [
    { icon: Linkedin, href: "https://www.linkedin.com/company/aityaari", label: "LinkedIn", color: "hover:text-blue-500" },
    { icon: Instagram, href: "https://www.instagram.com/aityaari", label: "Instagram", color: "hover:text-foreground" },
    { icon: Mail, href: "mailto:contact@aityaari.com", label: "Email", color: "hover:text-primary" },
  ];

  return (
    <footer className="bg-card border-t border-border relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>
      
      <div className="container relative z-10 mx-auto px-4">
        {/* Main footer content */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          {/* Brand and newsletter */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">aT</span>
              </div>
              <span className="text-xl font-bold">aiTyaari</span>
            </Link>
            
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Your AI-powered partner for interview success. Practice, improve, and ace your next interview with confidence.
            </p>

            {/* Social links */}
            <div className="flex gap-3">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                return (
                  <motion.a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-all ${social.color}`}
                    aria-label={social.label}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.a>
                );
              })}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold mb-4">Products</h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="font-semibold mb-4">Solutions</h4>
            <ul className="space-y-3">
              {footerLinks.solutions.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {new Date().getFullYear()} aiTyaari. All rights reserved. Built with ❤️ in India.
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              {footerLinks.legal.map((link, index) => (
                <Link
                  key={index}
                  href={link?.href}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {link?.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

