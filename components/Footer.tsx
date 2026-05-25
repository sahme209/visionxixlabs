import Link from "next/link";
import Image from "next/image";

/* ── Social icon SVGs ────────────────────────────────────────── */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Footer links data ───────────────────────────────────────── */
const productLinks = [
  { href: "/demo", label: "Try the demo" },
  { href: "/integrations", label: "Integrations" },
  { href: "/operator/onboarding", label: "Run Axiom" },
  { href: "/axiom/releaseops", label: "Axiom ReleaseOps" },
  { href: "/download", label: "Download Desktop" },
  { href: "/plans", label: "Pricing" },
  { href: "/axiom", label: "About Axiom" },
  { href: "/cloud-solutions", label: "Multi-Cloud" },
];

const companyLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/press", label: "Press & Media" },
  { href: "/insights", label: "Insights" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/security", label: "Security" },
];

const resourceLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/aws-setup", label: "AWS Setup Guide" },
  { href: "/docs/security-model", label: "Security Model" },
  { href: "/docs/faq", label: "FAQ" },
  { href: "/cloud-solutions/aws", label: "AWS Intelligence" },
  { href: "/cloud-solutions/azure", label: "Azure Intelligence" },
  { href: "/cloud-solutions/gcp", label: "GCP Intelligence" },
];

export function Footer() {
  return (
    <footer className="py-16 px-4 sm:px-6 lg:px-8">
      {/* Gradient line divider */}
      <div className="gradient-line mb-16" />
      <div className="relative">
        <div className="footer-amber-orb absolute -bottom-20 right-10 orb-drift" aria-hidden />
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          {/* Brand column */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-5">
              <Image
                src="/vision-xix-logo.png"
                alt="Vision XIX Labs"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-gradient">
                Vision XIX Labs
              </span>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
              Cloud infrastructure, AI engineering, and autonomous operations.
              We design, build, and operate systems that scale — with governance,
              security, and full audit trail.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/visionxixlabs"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link card-border-glow-hover"
                aria-label="GitHub"
              >
                <GitHubIcon className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com/company/visionxixlabs"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link card-border-glow-hover"
                aria-label="LinkedIn"
              >
                <LinkedInIcon className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/visionxixlabs"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link card-border-glow-hover"
                aria-label="X (Twitter)"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white nav-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white nav-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Resources</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white nav-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:support@visionxixlabs.com"
                  className="hover:text-white nav-glow transition-colors"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Huly-style CTA */}
        <div className="text-center mb-16 relative">
          <h2 className="text-3xl font-bold mb-3 tracking-[-0.04em]">Join the Movement</h2>
          <p className="text-zinc-500 text-sm mb-6 max-w-md mx-auto">
            Unlock the future of cloud operations with Axiom. This journey is just getting started.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/operator/onboarding"
              className="btn-amber-shimmer inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]"
            >
              Run Axiom
            </Link>
            <a
              href="mailto:support@visionxixlabs.com"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-6 py-3 text-sm font-semibold text-zinc-400 hover:text-white hover:border-white/[0.2] transition-all"
            >
              Contact us
            </a>
          </div>
        </div>

        {/* Made with passion tagline */}
        <div className="text-center mb-8">
          <p className="text-xs text-zinc-600">Made with <span className="text-red-400">♥</span> and passion in NYC</p>
        </div>

        {/* Bottom bar with dot separators */}
        <div className="gradient-line mb-8" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-600 text-sm">
            &copy; {new Date().getFullYear()} Vision XIX Labs LLC. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Link
              href="/privacy"
              className="hover:text-white nav-glow transition-colors"
            >
              Privacy
            </Link>
            <span className="text-zinc-700">&middot;</span>
            <Link href="/terms" className="hover:text-white nav-glow transition-colors">
              Terms
            </Link>
            <span className="text-zinc-700">&middot;</span>
            <Link
              href="/security"
              className="hover:text-white nav-glow transition-colors"
            >
              Security
            </Link>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
}
