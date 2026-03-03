import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "background-light": "#f8f6f6",
        "background-dark": "#221610"
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem"
      }
    }
  },
  darkMode: "class"
} satisfies Config;
