"use client";

import { useEffect, useState } from "react";
import HeroParallaxDemo from "@/components/hero-parallax-demo";

export default function Component() {
  // State for staggered animations and mobile menu
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return <HeroParallaxDemo />;
}
