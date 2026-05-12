type ProcessStepProps = {
  step: number;
  title: string;
  description: string;
};

export function ProcessStep({ step, title, description }: ProcessStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 text-sm font-semibold">
        {step}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {title}
        </h3>
        <p className="text-sm text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}
