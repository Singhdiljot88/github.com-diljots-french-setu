"use client";

/** Opens the browser's print dialog, which also offers "Save as PDF". */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 {label}</button>;
}
