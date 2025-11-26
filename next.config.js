/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'chatbotcdn.socialenable.co',
            },
        ],
    },
    webpack(config) {
        // Remove the CSS minifier (CssMinimizerPlugin) that breaks conic gradients
        config.optimization.minimizer = config.optimization.minimizer.filter((fn) => {
            return !fn.toString().includes('CssMinimizerPlugin');
        });
        return config;
    },
};

module.exports = nextConfig;