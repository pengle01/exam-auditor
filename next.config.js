/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Allow remote access from the phone for development
  allowedDevOrigins: ['192.168.10.8'],
};

module.exports = nextConfig;
