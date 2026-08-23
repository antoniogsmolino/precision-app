import type { Config } from "tailwindcss";

// Tutta la palette "brand" è pilotata da variabili CSS (vedi src/app/globals.css,
// blocco :root). Per cambiare colore del tema in futuro basta editare quelle
// variabili — non serve toccare questo file né i componenti.
function brandColor(shade: string) {
  return `hsl(var(--brand-${shade}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: brandColor("50"),
          100: brandColor("100"),
          200: brandColor("200"),
          300: brandColor("300"),
          400: brandColor("400"),
          500: brandColor("500"),
          600: brandColor("600"),
          700: brandColor("700"),
          800: brandColor("800"),
          900: brandColor("900"),
          950: brandColor("950"),
        },
        status: {
          futura: "#8B5CF6",
          attiva: "#22C55E",
          scadenza: "#F59E0B",
          scaduta: "#94A3B8",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "card-hover":
          "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-468px 0" },
          "100%": { backgroundPosition: "468px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
