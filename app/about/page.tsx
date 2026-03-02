import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Content */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Disclaimer - Soft callout */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/80 p-5 sm:p-6 mb-8">
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.6]">
            <span className="font-semibold text-[var(--text-primary)]">Disclaimer:</span> Estimates are from public data and historical patterns; actual times may vary. For official case status and binding information, use USCIS.gov.
          </p>
        </div>

        {/* Two-column intro */}
        <div className="grid gap-8 lg:grid-cols-2 mb-10">
          <section>
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
              Our Mission
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              Our mission is to empower immigrants with clear, data‑driven insights so they can make informed decisions about their future. The U.S. immigration process is often confusing, emotionally draining, and difficult to track.
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We believe that by turning complex data into understandable timelines, explanations, and tools, we can reduce uncertainty and help families feel more in control of their journey.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
              What We Offer
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              VisaNova provides tools designed specifically for family‑based and other common immigration cases:
            </p>
            <ul className="space-y-2.5">
              {[
                "Data‑driven case tracking based on your priority date, form type, and processing path.",
                "Estimated timelines for key milestones—USCIS approval, NVC processing, embassy interview, visa issuance.",
                "Form guides and explanations that break down complex steps into plain language.",
                "Premium tools including expedite guidance, action plans, and analytics.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                  <span className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Sections - Tighter dividers */}
        <section className="pt-8 border-t border-[var(--border-color)]">
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
            Who We Serve
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
            We primarily serve immigrants and their families navigating family‑based petitions such as <strong className="font-semibold text-[var(--text-primary)]">I‑130</strong> and <strong className="font-semibold text-[var(--text-primary)]">I‑129F</strong>, along with related consular processing and adjustment of status paths.
          </p>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
            Whether you are sponsoring a spouse, fiancé(e), parent, or child, our goal is to provide visibility into how cases like yours have moved through the system and what that might mean for your own timeline. We also support <strong className="font-semibold text-[var(--text-primary)]">N‑400</strong> naturalization applicants and those exploring other common immigration paths.
          </p>
        </section>

        <section className="pt-8 mt-8 border-t border-[var(--border-color)]">
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
            Our Story
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
            VisaNova was founded by immigrants and families who have personally gone through the uncertainty, delays, and constant waiting that define much of the U.S. immigration process. After experiencing how difficult it was to get a clear, realistic picture of “where things stand,” we set out to build tools that we wished we had during our own journeys.
          </p>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
            Our approach combines technology, data analysis, and empathy. We spend just as much time listening to real immigrants’ experiences as we do studying processing statistics. The result is a platform designed to be accurate, transparent, and respectful of the emotional weight behind every case.
          </p>
        </section>

        <section className="pt-8 mt-8 border-t border-[var(--border-color)]">
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-3 tracking-tight">
            Where We Are Based
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
            VisaNova is built and operated from <strong className="font-semibold text-[var(--text-primary)]">Georgia, USA</strong>, and serves users across the United States and around the world who are navigating U.S. immigration processes. We are a small team focused on making immigration information more accessible to everyone.
          </p>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mt-3">
            VisaNova is a product of{" "}
            <a href="https://www.visionxixlabs.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:underline font-medium">
              VisionXIX Labs
            </a>
            .
          </p>
        </section>

        {/* Closing - Soft emphasis */}
        <div className="mt-10 rounded-2xl bg-[var(--bg-surface-alt)]/80 border border-[var(--border-color)]/60 p-5 sm:p-6">
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
            Every immigration case represents real people, relationships, and futures. Our commitment is to treat your journey with the seriousness and respect it deserves, and to keep improving VisaNova so that it remains a trustworthy, transparent, and helpful companion throughout your process. Thank you for trusting us with your journey.
          </p>
        </div>

        {/* Footer links */}
        <nav className="mt-10 pt-6 border-t border-[var(--border-color)] flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link href="/terms" className="text-[var(--text-primary)] hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">
            Privacy Policy
          </Link>
          <Link href="/" className="text-[var(--text-primary)] hover:underline">
            Home
          </Link>
        </nav>
      </div>
    </div>
  );
}
