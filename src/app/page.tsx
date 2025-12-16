"use client";

import { LandingNavbar } from "@/components/layout/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProductsSection } from "@/components/landing/ProductsSection";
import { SolutionsSection } from "@/components/landing/SolutionsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ResourcesSection } from "@/components/landing/ResourcesSection";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      
      <main>
        <HeroSection />
        <ProductsSection />
        <SolutionsSection />
        <FeaturesSection />
        <ResourcesSection />
      </main>

      <Footer />
    </div>
  );
}
