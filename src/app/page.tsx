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
          src="/background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60"
          style={{
            objectPosition: "center 38%",
            filter: "contrast(1.1) saturate(1.15)",
          }}
        />
        {/* Warm accent wash — ties image hues to the editorial palette */}
        <div className="absolute inset-0 bg-accent/[0.03]" />
        {/* Radial vignette — bright center, dark edges that melt into bg-deep */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_55%_40%,transparent_0%,rgba(9,9,11,0.35)_50%,rgba(9,9,11,0.82)_100%)]" />
        {/* Bottom fade — hard dissolve so sections below read clean */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_45%,rgba(9,9,11,0.5)_62%,rgba(9,9,11,0.92)_80%,rgb(9,9,11)_100%)]" />
        {/* Top edge — subtle darkening for navbar legibility */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,9,11,0.4)_0%,transparent_12%)]" />
        {/* Left text-protection — ensures headline contrast without killing the image */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(9,9,11,0.45)_0%,rgba(9,9,11,0.15)_35%,transparent_60%)]" />
      </div>

      <Hero />
      <ProcessTimeline />
      <ContendersGrid />
      <DomainsGrid />
      <StatsBar />
    </div>
  );
}
