/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ['"Outfit"', "sans-serif"]
      },
      colors: {
        colombia: {
          yellow: "#FCD116",
          blue: "#003893",
          red: "#CE1126"
        },
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22"
        },
        navy: {
          50: "#f0f6ff",
          100: "#e0edfe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36adf7",
          500: "#0c93eb",
          600: "#0174ca",
          700: "#025ca3",
          800: "#074e86",
          900: "#0c426f",
          950: "#082b4b"
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.08)",
        glow: "0 0 25px rgba(16, 185, 129, 0.25)"
      }
    }
  },
  plugins: []
};
