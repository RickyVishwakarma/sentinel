import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        letterSpacing: "-0.02em",
      }}
      className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-16 text-[#0a0a0a]"
    >
      <Link
        href="/"
        className="mb-10 text-[30px] font-semibold italic tracking-[-0.08em]"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        Sentinel
        <sup
          className="ml-0.5 align-super text-[14px] font-semibold not-italic"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          ®
        </sup>
      </Link>
      <SignIn appearance={clerkAppearance} />
    </div>
  );
}
