/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed static export - Clerk requires server-side rendering
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
