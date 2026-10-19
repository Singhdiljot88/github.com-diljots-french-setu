"use client";
import { Bi } from "./bi";

/** Opens the browser's print dialog, which also offers "Save as PDF". */
export function PrintButton({ label }: { label?: string }) {
  return <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 {label ?? <Bi as="span" t={{ en: "Print or save as PDF", hi: "प्रिंट करें या PDF के रूप में सहेजें" }} />}</button>;
}
