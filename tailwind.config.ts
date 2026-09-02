import type { Config } from "tailwindcss";

// Tutta la palette è pilotata da variabili CSS (vedi src/app/globals.css,
// blocco :root). Per cambiare colore del tema in futuro basta editare quelle
// variabili — non serve toccare questo file né i componenti.
function token(nome: string) {
  return `hsl(var(--${nome}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: token("brand-50"),
          100: token("brand-100"),
          200: token("brand-200"),
          300: token("brand-300"),
          400: token("brand-400"),
          500: token("brand-500"),
          600: token("brand-600"), // #E41F25 — PRIMARY
          700: token("brand-700"), // #C91F12 — PRIMARY HOVER
          800: token("brand-800"),
          900: token("brand-900"),
          950: token("brand-950"),
        },
        ink: token("ink"), // #2B2E34
        growth: {
          50: token("growth-50"),
          500: token("growth-500"), // #65BD7D
          600: token("growth-600"),
          700: token("growth-700"),
        },
        navigation: {
          50: token("navigation-50"),
          500: token("navigation-500"), // #198FD9
          600: token("navigation-600"),
          700: token("navigation-700"),
        },
        ocra: {
          50: token("ocra-50"),
          500: token("ocra-500"), // #E4A858
          600: token("ocra-600"),
          700: token("ocra-700"),
        },
        urgency: {
          50: token("urgency-50"),
          500: token("urgency-500"),
          700: token("urgency-700"),
        },
        surface: {
          DEFAULT: token("surface"),
          alt: token("surface-alt"), // #F9F9FB
          muted: token("surface-muted"), // #F2F3F5
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Poppins",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(43 46 52 / 0.04), 0 1px 3px 0 rgb(43 46 52 / 0.06)",
        "card-hover": "0 8px 20px -4px rgb(43 46 52 / 0.12), 0 3px 8px -3px rgb(43 46 52 / 0.08)",
        glass: "0 8px 30px -12px rgb(43 46 52 / 0.22), 0 1px 1px 0 rgb(255 255 255 / 0.4) inset",
        glow: "0 0 0 1px rgb(255 45 22 / 0.1), 0 8px 24px -8px rgb(255 45 22 / 0.4)",
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
        float: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(2%, -3%) scale(1.05)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.4s ease-in-out infinite",
        float: "float 14s ease-in-out infinite",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
