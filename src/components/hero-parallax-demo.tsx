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
    // {
    //   name: "About",
    //   link: "/about",
    //   icon: <User className="h-4 w-4 text-neutral-500 dark:text-white" />,
    // },
  ];

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] [background-size:20px_20px]"></div>

      <FloatingNav navItems={navItems} />
      <HeroParallax products={products} />
    </div>
  );
}

export const products = [
  {
    title: "Cursor",
    thumbnail:
      "https://aceternity.com/images/products/thumbnails/new/cursor.png",
  },

  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img3.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img4.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img6.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img5.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img7.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img8.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img9.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img4.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img3.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img4.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img6.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img5.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img7.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img8.png",
  },
  {
    title: "Tailwind Master Kit",
    thumbnail: "./homepageImages/img9.png",
  },
];
