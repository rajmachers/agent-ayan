/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'machers.tech',
      },
    ],
  },
};

module.exports = nextConfig;
