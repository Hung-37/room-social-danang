import type { ReactNode } from "react";

export default function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="ui-field">
      {label}
      {children}
    </label>
  );
}
