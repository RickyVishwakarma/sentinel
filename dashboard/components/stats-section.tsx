"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView } from "motion/react";

/* Animated stats band for the homepage. Same black-and-white system as the
   rest of the site (Inter + Source Serif 4 italic accent), rendered as a
   full-bleed black section for contrast. Numbers are what the control plane
   guarantees by design — not usage/traction, which this project doesn't have. */

const SANS = "var(--font-inter), system-ui, sans-serif";
const SERIF = "var(--font-source-serif), Georgia, serif";

// ── animated 0 → value counter, fires when scrolled into view ──────────────

function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(v) {
        if (ref.current) ref.current.textContent = prefix + v.toFixed(decimals) + suffix;
      },
    });
    return () => controls.stop();
  }, [inView, value, prefix, suffix, decimals]);

  return (
    <span ref={ref}>
      {prefix}
      {(0).toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ── character-by-character reveal, fires on scroll into view ────────────────

function Typewriter({
  text,
  delay = 0,
  speed = 0.015,
  className = "",
}: {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10px" });

  return (
    <motion.span
      ref={ref}
      className={className}
      aria-label={text}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 1 },
        visible: { opacity: 1, transition: { staggerChildren: speed, delayChildren: delay } },
      }}
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        >
          {ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ── honest, verifiable numbers about the control plane ──────────────────────

const STATS: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
}[] = [
  { value: 100, suffix: "%", label: "Of agent actions audited" },
  { value: 3, label: "Decision verdicts: allow · deny · hold" },
  { value: 4, label: "Guardrails in the pipeline" },
  { value: 3, suffix: "+", label: "Providers with auto-fallback" },
  { value: 30, suffix: "d", label: "Default trace retention" },
];

// abstract mark used as the mask for the animated visual (from the brief)
const MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='m53.54,45.42c2.19-3.79,7.67-3.79,9.86,0l4.54,7.87c1.17,2.02,1.17,4.51,0,6.54l-8.15,13.81c-1.68,2.91.42,6.55,3.78,6.55h17.81c3.45,0,5.61-3.74,3.89-6.73l-28.76-49.81c-2.95-5.12-10.34-5.12-13.29,0l-28.46,49.3c-1.86,3.22.46,7.24,4.18,7.24h10.23c2.55,0,4.91-1.36,6.19-3.57l18.18-31.19Z'/%3E%3C/svg%3E")`;

export function StatsSection() {
  return (
    <section
      id="stats"
      style={{ fontFamily: SANS, letterSpacing: "-0.02em" }}
      className="w-full overflow-hidden border-t border-white/10 bg-black px-6 py-8 text-white md:px-12 md:py-24 lg:px-[120px]"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="flex flex-col items-stretch gap-16 lg:flex-row lg:gap-[160px]">
          {/* left column */}
          <motion.div
            className="flex flex-1 flex-col justify-start"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
            }}
          >
            <h2 className="mb-6 w-[590px] max-w-full text-[clamp(1.75rem,4vw,3.25rem)] font-medium leading-[1.1] tracking-tight">
              <Typewriter text="Governance, " delay={0} speed={0.012} />
              <span style={{ fontFamily: SERIF }} className="italic">
                <Typewriter text="by the numbers" delay={0.2} speed={0.012} />
              </span>
              <Typewriter text="." delay={0.45} speed={0.012} />
            </h2>

            <p className="mb-16 max-w-lg text-base font-light leading-relaxed text-white/40 md:text-lg">
              <Typewriter
                text="Sentinel is early and open source — these aren't usage stats. They're what the control plane guarantees by design, on every agent, from the first request."
                delay={0.1}
                speed={0.008}
              />
            </p>

            <motion.div
              className="grid grid-cols-2 gap-8 md:grid-cols-[max-content_max-content] md:gap-x-16 lg:gap-x-24"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.06, delayChildren: 0.1 },
                },
              }}
            >
              {STATS.map((s) => (
                <motion.div
                  key={s.label}
                  className="flex flex-col"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: "easeOut" },
                    },
                  }}
                >
                  <div
                    style={{ fontFamily: SERIF }}
                    className="mb-3 text-4xl tracking-tight md:text-5xl lg:text-[56px]"
                  >
                    <AnimatedCounter
                      value={s.value}
                      suffix={s.suffix}
                      prefix={s.prefix}
                      decimals={s.decimals}
                    />
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 md:text-xs">
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* right column — masked, slowly-rotating light (no external asset) */}
          <div className="flex shrink-0 items-center justify-center lg:w-1/2 lg:justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1.15 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative aspect-square w-full max-w-[440px] origin-center lg:w-[110%] lg:max-w-none"
              style={{
                WebkitMaskImage: MASK,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskImage: MASK,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
            >
              <motion.div
                className="absolute inset-[-40%]"
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                style={{
                  background:
                    "conic-gradient(from 0deg, #171717, #ffffff, #3f3f3f, #171717, #a3a3a3, #171717)",
                }}
              />
              <div className="absolute inset-0 bg-black/20" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
