import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
  images: {
    qualities: [75, 90, 100],
    formats: ['image/avif', 'image/webp'],
    // ponytail: avatar remote patterns — add your upload/avatar hostname here
    // shadcn Avatar component uses <AvatarImage> which renders <img>, not next/image,
    // so remotePatterns only apply if avatars are loaded via next/image elsewhere.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },
};

export default nextConfig;
