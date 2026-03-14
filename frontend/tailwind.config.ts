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
        },
    },
    plugins: [],
};
export default config;
