import { redirect } from "next/navigation";

/* Legacy email/password login. Clerk is now the only human sign-in path, so
   this route just forwards — old links and bookmarks keep working instead of
   landing on a second, competing login form. */
export default function LegacyLoginPage() {
  redirect("/sign-in");
}
