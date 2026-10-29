"use client";

import type { ComponentProps } from "react";

/** A <select> that submits its form when changed (the form still works without JavaScript). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
