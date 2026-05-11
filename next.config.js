/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Allow remote access from the phone for development
  allowedDevOrigins: [
    'http://192.168.10.8:3000',
    'http://192.168.10.58:3000',
    'http://192.168.10.59:3000',
    'http://192.168.10.59',
    'https://192.168.10.59',
    'https://192.168.10.59:3000',
    'http://192.168.17.32:3000',
    'http://192.168.17.32',
  ],
};

module.exports = nextConfig;
