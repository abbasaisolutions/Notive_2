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
                sans: ["var(--font-inter)", "sans-serif"],
                serif: ["var(--font-serif)", "serif"],
            },
            colors: {
                background: "#18181b",
                foreground: "#fafafa",
                primary: {
                    DEFAULT: "#27272a",
                    light: "#52525b",
                    foreground: "#fafafa"
                },
                secondary: {
                    DEFAULT: "#71717a",
                    foreground: "#fafafa"
                },
                accent: {
                    DEFAULT: "#a1a1aa",
                    foreground: "#18181b"
                },
                glass: "rgba(24, 24, 27, 0.6)",
                cream: "#fafafa",
                neutral: {
                    darkest: "#09090b",
                    dark: "#18181b",
                    DEFAULT: "#27272a",
                    medium: "#52525b",
                    light: "#a1a1aa",
                    lighter: "#d4d4d8",
                    lightest: "#fafafa",
                },
                teal: {
                    dark: "#18181b",
                    DEFAULT: "#27272a",
                    light: "#52525b",
                }
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
