import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)", "sans-serif"],
                serif: ["var(--font-serif)", "serif"],
            },
            colors: {
                background: "rgb(var(--bg-canvas))",
                foreground: "rgb(var(--text-primary))",
                primary: {
                    DEFAULT: "rgb(var(--brand))",
                    foreground: "#FFFFFF"
                },
                secondary: {
                    DEFAULT: "rgb(var(--brand-2))",
                    foreground: "#FFFFFF"
                },
                accent: {
                    DEFAULT: "rgb(var(--brand-3))",
                    foreground: "#FFFFFF"
                },
                surface: {
                    1: "rgb(var(--surface-1))",
                    2: "rgb(var(--surface-2))",
                    3: "rgb(var(--surface-3))",
                },
                ink: {
                    DEFAULT: "rgb(var(--text-primary))",
                    secondary: "rgb(var(--text-secondary))",
                    muted: "rgb(var(--text-muted))",
                },
                success: "rgb(var(--success))",
                danger: "rgb(var(--danger))",
                glass: "var(--glass-bg)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
            borderRadius: {
                // Named tokens for the "paper card" radius values that were previously
                // written as one-off arbitrary values (rounded-[1.1rem], etc.) across
                // the app. Each key is named after its rem value so the codemod that
                // introduced these is a pure, value-preserving rename — no visual
                // change. Sizes below (0.5rem, 0.75rem, 1rem, 1.5rem) already have
                // built-in Tailwind equivalents (lg/xl/2xl/3xl) and aren't duplicated
                // here.
                "card-95": "0.95rem",
                "card-105": "1.05rem",
                "card-110": "1.1rem",
                "card-120": "1.2rem",
                "card-125": "1.25rem",
                "card-130": "1.3rem",
                "card-140": "1.4rem",
                "card-160": "1.6rem",
                "card-163": "1.625rem",
                "card-175": "1.75rem",
                "card-180": "1.8rem",
                "card-200": "2rem",
            },
        },
    },
    plugins: [],
};
export default config;
