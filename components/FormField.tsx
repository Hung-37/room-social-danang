import type { ReactNode } from "react";

export default function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ? `ui-field ${className}` : "ui-field"}>
      {label}
      {children}
    </label>
  );
}
