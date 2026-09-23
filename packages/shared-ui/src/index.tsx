import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly tone?: "primary" | "secondary" | "danger";
}

const toneClass: Record<NonNullable<ActionButtonProps["tone"]>, string> = {
  primary: "orbit-button orbit-button-primary",
  secondary: "orbit-button orbit-button-secondary",
  danger: "orbit-button orbit-button-danger",
};

export function ActionButton({
  children,
  tone = "primary",
  className = "",
  ...props
}: ActionButtonProps): JSX.Element {
  return (
    <button className={toneClass[tone] + " " + className} {...props}>
      {children}
    </button>
  );
}
