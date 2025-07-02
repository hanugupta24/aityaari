"use client";
import { HeroParallax } from "@/components/ui/hero-parallax";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { Home, User, Mail, Briefcase } from "lucide-react";

export default function HeroParallaxDemo() {
  const navItems = [
    {
      name: "aiTyaari",
      link: "/",
      icon: <Home className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
  ];

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] [background-size:20px_20px]"></div>
      <FloatingNav navItems={navItems} />
      <HeroParallax products={products} />
    </div>
  );
}

export const products = [
  {
    title: "Interview Light",
    thumbnail: "./homepageImages/img3.webp",
  },
  {
    title: "Interview dark",
    thumbnail: "./homepageImages/img4.webp",
  },
  {
    title: "Interview History Light",
    thumbnail: "./homepageImages/img5.webp",
  },
  {
    title: "Interview History dark",
    thumbnail: "./homepageImages/img6.webp",
  },
  {
    title: "Interview Performance Light",
    thumbnail: "./homepageImages/img7.webp",
  },
  {
    title: "Interview Performance dark",
    thumbnail: "./homepageImages/img8.webp",
  },
  {
    title: "Study Materials Light",
    thumbnail: "./homepageImages/img9.webp",
  },
  {
    title: "Study Materials dark",
    thumbnail: "./homepageImages/img10.webp",
  },
  {
    title: "Interview Light",
    thumbnail: "./homepageImages/img3.webp",
  },
  {
    title: "Interview dark",
    thumbnail: "./homepageImages/img4.webp",
  },
  {
    title: "Interview History Light",
    thumbnail: "./homepageImages/img5.webp",
  },
  {
    title: "Interview History dark",
    thumbnail: "./homepageImages/img6.webp",
  },
  {
    title: "Interview Performance Light",
    thumbnail: "./homepageImages/img7.webp",
  },
  {
    title: "Interview Performance dark",
    thumbnail: "./homepageImages/img8.webp",
  },
  {
    title: "Study Materials Light",
    thumbnail: "./homepageImages/img9.webp",
  },
  {
    title: "Study Materials dark",
    thumbnail: "./homepageImages/img10.webp",
  },
];
