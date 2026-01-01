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
                background: "#1D2F33",
                foreground: "#F2F0E4",
                primary: {
                    DEFAULT: "#26464B",
                    light: "#5F8184",
                    foreground: "#F2F0E4"
                },
                secondary: {
                    DEFAULT: "#5F8184",
                    foreground: "#F2F0E4"
                },
                accent: {
                    DEFAULT: "#5F8184",
                    foreground: "#F2F0E4"
                },
                glass: "rgba(29, 47, 51, 0.6)",
                cream: "#F2F0E4",
                teal: {
                    dark: "#1D2F33",
                    DEFAULT: "#26464B",
                    light: "#5F8184",
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
