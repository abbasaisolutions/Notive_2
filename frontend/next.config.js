/** @type {import('next').NextConfig} */
const outputMode = process.env.NEXT_OUTPUT_MODE === 'export' ? 'export' : undefined;

const nextConfig = {
    ...(outputMode ? { output: outputMode } : {}),
    ...(outputMode
        ? {
            images: {
                unoptimized: true,
            },
        }
        : {}),
};

module.exports = nextConfig;
