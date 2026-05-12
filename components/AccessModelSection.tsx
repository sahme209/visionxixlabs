type AccessModelSectionProps = {
  title?: string;
  intro?: string;
  weOperateUsing: string[];
  whatWeAreNotTitle?: string;
  whatWeAreNot: string[];
  whatWeFocusOnTitle?: string;
  whatWeFocusOn: string[];
};

export function AccessModelSection({
  title = "How we access your environment",
  intro = "We operate in a way that keeps your environment secure and auditable.",
  weOperateUsing,
  whatWeAreNotTitle = "What we are not",
  whatWeAreNot,
  whatWeFocusOnTitle = "We focus on",
  whatWeFocusOn,
}: AccessModelSectionProps) {
  return (
    <section className="mb-16" aria-labelledby="access-model-heading">
      <h2
        id="access-model-heading"
        className="text-2xl font-bold text-white mb-2"
      >
        {title}
      </h2>
      <p className="text-zinc-400 mb-6 max-w-2xl">
        {intro}
      </p>
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
            We operate using
          </h3>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            {weOperateUsing.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-indigo-500 mr-2 mt-0.5 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
            {whatWeAreNotTitle}
          </h3>
          <ul className="space-y-1.5 text-sm text-zinc-400 mb-4">
            {whatWeAreNot.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-zinc-500 mr-2 mt-0.5">×</span>
                {item}
              </li>
            ))}
          </ul>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2">
            {whatWeFocusOnTitle}
          </h3>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            {whatWeFocusOn.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-indigo-500 mr-2 mt-0.5 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
