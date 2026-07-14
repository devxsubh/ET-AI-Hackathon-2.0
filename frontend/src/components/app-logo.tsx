/** Engram wordmark — text logo until brand SVG is replaced. */

type AppLogoProps = {
  variant?: "full" | "mark";
  height?: number;
  className?: string;
};

export function AppLogo({
  variant = "full",
  height = 32,
  className = "",
}: AppLogoProps) {
  if (variant === "mark") {
    const size = height;
    return (
      <span
        className={`inline-flex items-center justify-center rounded-lg bg-slate-900 text-white font-semibold shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.4),
          fontFamily: "var(--font-eb-garamond), Georgia, serif",
        }}
        aria-label="Engram"
      >
        E
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 shrink-0 ${className}`}
      style={{ height }}
      aria-label="Engram"
    >
      <span
        className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white font-semibold"
        style={{
          width: height,
          height: height,
          fontSize: Math.round(height * 0.4),
          fontFamily: "var(--font-eb-garamond), Georgia, serif",
        }}
      >
        E
      </span>
      <span
        className="font-semibold tracking-tight text-slate-900"
        style={{
          fontSize: Math.round(height * 0.55),
          fontFamily: "var(--font-eb-garamond), Georgia, serif",
          lineHeight: 1,
        }}
      >
        Engram
      </span>
    </span>
  );
}
