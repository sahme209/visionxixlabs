import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type BaseProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
  };

type LinkProps = BaseProps & {
  href: string;
};

type AxiomButtonProps = ButtonProps | LinkProps;

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 disabled:opacity-60";

const primaryClasses =
  "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-2.5 shadow-sm hover:from-slate-800 hover:via-slate-800 hover:to-slate-900 hover:shadow-lg hover:shadow-indigo-300/40 hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-500";

const secondaryClasses =
  "border border-slate-200/80 dark:border-slate-700/80 bg-transparent text-slate-900 dark:text-slate-100 px-4 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:shadow-md hover:shadow-indigo-200/30";

export function AxiomButton(props: AxiomButtonProps) {
  const { children, variant = "primary", className = "" } = props;
  const classes = `${baseClasses} ${
    variant === "primary" ? `axiom-button-primary ${primaryClasses}` : secondaryClasses
  } ${className}`;

  if ("href" in props && props.href) {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { ...buttonProps } = props;
  return (
    // eslint-disable-next-line react/button-has-type
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

