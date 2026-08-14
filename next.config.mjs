/** @type {import('next').NextConfig} */
const nextConfig = {
  // discord.js is a heavy native-ish package; keep it out of the bundler.
  serverExternalPackages: ['discord.js'],
  // Participant photos are arbitrary user-supplied URLs, so plain <img> is used
  // everywhere and the optimizer stays out of the way.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
}

export default nextConfig
