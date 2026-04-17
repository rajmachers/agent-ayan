/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['ts', 'tsx'],
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

module.exports = nextConfig
