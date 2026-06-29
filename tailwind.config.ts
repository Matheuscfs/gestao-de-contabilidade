/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4078E6",
          50: "#EEF3FD",
          100: "#D9E6FB",
          200: "#B4CCF7",
          300: "#8EB3F2",
          400: "#6899EE",
          500: "#4078E6",
          600: "#2860D0",
          700: "#1E4BA3",
          800: "#163677",
          900: "#0E224B",
        },
        positive: {
          DEFAULT: "#12A06B",
          50: "#E8FAF4",
          100: "#C8F2E2",
          500: "#12A06B",
          700: "#0B6E4A",
        },
        negative: {
          DEFAULT: "#D74A45",
          50: "#FDF0EF",
          100: "#FACFCE",
          500: "#D74A45",
          700: "#A03330",
        },
        warning: {
          DEFAULT: "#E8A020",
          50: "#FEF7E8",
          500: "#E8A020",
        },
        ink: {
          DEFAULT: "#0E1116",
          secondary: "#4A5264",
          muted: "#8C95A6",
          placeholder: "#B5BCC9",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F7F8FA",
          raised: "#FFFFFF",
          overlay: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E4E8EF",
          subtle: "#F0F2F5",
          strong: "#C5CDD8",
        },
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        DEFAULT:
          "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        md: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
        lg: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
      },
      spacing: {
        sidebar: "4.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "slide-in-right": "slideInRight 0.2s ease-out",
        "toast-in": "toastIn 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
        "toast-out": "toastOut 0.18s ease-in forwards",
      },
      keyframes: {
        toastIn: {
          "0%": { opacity: "0", transform: "translateX(16px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        toastOut: {
          "0%": { opacity: "1", transform: "translateX(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateX(16px) scale(0.96)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
