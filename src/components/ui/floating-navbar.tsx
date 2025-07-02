"use client";
import { useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { cn } from "@/lib/utils";
import type { JSX } from "react/jsx-runtime";
import Link from "next/link";

export const FloatingNav = ({
  navItems,
  className,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: JSX.Element;
  }[];
  className?: string;
}) => {
  const { scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(true); // Start as visible

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      const direction = current - (scrollYProgress.getPrevious() ?? 0);

      if (scrollYProgress.get() < 0.05) {
        setVisible(true); // Always show at top
      } else {
        if (direction < 0) {
          setVisible(true); // Show when scrolling up
        } else {
          setVisible(false); // Hide when scrolling down
        }
      }
    }
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: 0,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.2,
        }}
        className={cn(
          "flex max-w-fit fixed top-10 inset-x-0 mx-auto border border-gray-200 rounded-full bg-white/90 backdrop-blur-md shadow-lg z-[5000] pr-2 pl-4 py-2 items-center justify-center space-x-4",
          className
        )}
      >
        {navItems.map((navItem: any, idx: number) => (
          <a
            key={`link=${idx}`}
            href={navItem.link}
            className={cn(
              "text-sm font-medium text-gray-600 hover:text-emerald-600 py-2 rounded-full transition-colors duration-200"
            )}
          >
            {/* <span className="block sm:hidden">{navItem.icon}</span> */}
            <span className="text-sm font-medium bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-full hover:from-emerald-600 hover:to-green-700 transition-all duration-200 shadow-md">
              {navItem.name}
            </span>
          </a>
        ))}

        <div className="flex items-center space-x-2">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-emerald-600 px-3 py-2 rounded-full transition-colors duration-200"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-gray-600 hover:text-emerald-600 px-3 py-2 rounded-full transition-colors duration-200"
          >
            Sign Up
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
