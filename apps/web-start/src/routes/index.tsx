import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import HeroSection from "@web/components/hero-section";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() { return <HeroSection />; }
