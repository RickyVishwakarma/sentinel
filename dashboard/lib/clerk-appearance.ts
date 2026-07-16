/* Makes Clerk's components speak the same language as the rest of the app:
   white surfaces, near-black ink, Inter, tight tracking, pill controls.
   Typed structurally — @clerk/types isn't a direct dependency. */

export const clerkAppearance = {
  variables: {
    colorPrimary: "#0a0a0a",
    colorText: "#0a0a0a",
    colorTextSecondary: "#6b6b6b",
    colorBackground: "#ffffff",
    colorInputBackground: "#fbfbfb",
    colorInputText: "#0a0a0a",
    colorDanger: "#b42318",
    colorSuccess: "#0a7d3c",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    borderRadius: "999px",
  },
  elements: {
    rootBox: { width: "100%", maxWidth: "400px" },
    card: {
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "24px",
      boxShadow: "none",
      letterSpacing: "-0.02em",
    },
    headerTitle: { fontSize: "24px", fontWeight: 600, letterSpacing: "-0.05em" },
    headerSubtitle: { color: "#6b6b6b" },
    formButtonPrimary: {
      backgroundColor: "#0a0a0a",
      fontSize: "14px",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      textTransform: "none",
      "&:hover": { backgroundColor: "#262626" },
    },
    formFieldInput: { borderColor: "rgba(0,0,0,0.1)" },
    socialButtonsBlockButton: { borderColor: "rgba(0,0,0,0.1)" },
    footerActionLink: { color: "#0a0a0a", fontWeight: 600 },
    // The dev-mode ribbon is noise on a design review.
    logoBox: { display: "none" },
  },
};
