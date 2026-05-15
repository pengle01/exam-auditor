/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  allowedDevOrigins: [
    '192.168.10.8',
    '192.168.10.58',
    '192.168.10.59',
    '192.168.17.32',
  ],
};

module.exports = nextConfig;
