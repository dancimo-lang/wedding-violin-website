/** Thin gold line with a small diamond, used above section headings on the dark/cream pages. */
export default function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
      <span className="h-px w-12 bg-[#c9a961]/70" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[#c9a961]" />
      <span className="h-px w-12 bg-[#c9a961]/70" />
    </div>
  );
}
