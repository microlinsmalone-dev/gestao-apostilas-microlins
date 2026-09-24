import type { NextConfig } from 'next';

// Detecta automaticamente o nome do repositório no GitHub Actions para o GitHub Pages
const isGithubActions = process.env.GITHUB_ACTIONS || false;
const repo = isGithubActions && process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: repo,
  assetPrefix: repo ? `${repo}/` : undefined,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
