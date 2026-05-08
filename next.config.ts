import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['reactflow'],
  // Pin the Turbopack root to this app so it doesn't accidentally pick up a
  // stray lockfile from a parent directory during build.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
