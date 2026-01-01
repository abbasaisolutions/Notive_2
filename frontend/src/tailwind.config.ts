import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./context/**/*.{js,ts,jsx,tsx,mdx}",
        "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
        "./services/**/*.{js,ts,jsx,tsx,mdx}",
        "./utils/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                serif: ["var(--font-serif)", "serif"],
            },
            colors: {
                background: "rgb(var(--background-start))",
                foreground: "rgb(var(--foreground))",
                primary: {
                    DEFAULT: "rgb(var(--primary))",
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "rgb(var(--secondary))",
                    foreground: "#FFFFFF",
                },
                accent: {
                    DEFAULT: "rgb(var(--accent))",
                    foreground: "#FFFFFF",
                },
                glass: "var(--glass-bg)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
        },
    },
    plugins: [],
};

export default config;
