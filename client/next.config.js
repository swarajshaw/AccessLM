/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use export output mode for production builds, not development
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true
  },
  experimental: {
    scrollRestoration: true,
  },
  // Only apply these settings for production builds
  ...(process.env.NODE_ENV === 'production' && {
    trailingSlash: true,
    basePath: '',
    assetPrefix: './',
  }),
};

module.exports = nextConfig;