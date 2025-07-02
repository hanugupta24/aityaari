"use client";

import { useEffect, useState } from "react";
import HeroParallaxDemo from "@/components/hero-parallax-demo";
import Head from "next/head";

export default function Component() {
  // State for staggered animations and mobile menu
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <>
      <Head>
        <link
          rel="preload"
          as="image"
          href="/homepageImages/img8.webp"
          type="image/webp"
        />
      </Head>
      <HeroParallaxDemo />
    </>
  );
}
