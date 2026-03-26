import Image from "next/image";
import Hero from "@/components/home/Hero";
import ProcessTimeline from "@/components/home/ProcessTimeline";
import ContendersGrid from "@/components/home/ContendersGrid";
import DomainsGrid from "@/components/home/DomainsGrid";
import StatsBar from "@/components/home/StatsBar";

export default function Home() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Background — let the image breathe naturally against bg-deep */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-bg-deep"
      >
        <Image
          src="/bg-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-[0.72]"
          style={{
            objectPosition: "center 45%",
            filter: "contrast(1.12) saturate(1.25) brightness(1.05)",
          }}
        />
        {/* Warm accent wash */}
        <div className="absolute inset-0 bg-accent/[0.04]" />
        {/* Radial vignette — centered on the image's focal point */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_70%_at_50%_48%,transparent_0%,rgba(9,9,11,0.25)_45%,rgba(9,9,11,0.75)_100%)]" />
        {/* Bottom shelf — darkens the bottom third where all text lives */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_42%,rgba(9,9,11,0.35)_55%,rgba(9,9,11,0.6)_72%,rgba(9,9,11,0.45)_100%)]" />
        {/* Top edge — navbar legibility */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,9,11,0.4)_0%,transparent_8%)]" />
        {/* Bottom-left text zone — protects hero copy area */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(9,9,11,0.5)_0%,rgba(9,9,11,0.25)_28%,transparent_52%)]" />
        {/* Bottom-right contenders zone */}
        <div className="absolute inset-0 bg-[linear-gradient(to_left,rgba(9,9,11,0.4)_0%,rgba(9,9,11,0.15)_20%,transparent_40%)]" />
      </div>

      <Hero />
      <ProcessTimeline />
      <DomainsGrid />
      <StatsBar />
      <ContendersGrid />
    </div>
  );
}
