import type { NextConfig } from 'next';
import fs from 'fs';

// Polyfill para bug conhecido do Node.js v22/v24 no Windows (EISDIR ao chamar readlink em arquivo comum)
try {
  const origReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function (p: any, options: any) {
    try {
      return origReadlinkSync(p, options);
    } catch (err: any) {
      if (err && err.code === 'EISDIR') {
        const e = new Error(`EINVAL: invalid argument, readlink '${p}'`);
        (e as any).code = 'EINVAL';
        throw e;
      }
      throw err;
    }
  } as any;

  const origReadlink = fs.readlink;
  fs.readlink = function (p: any, options: any, callback?: any) {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? undefined : options;
    return origReadlink(p, opts, (err: any, linkString: any) => {
      if (err && err.code === 'EISDIR') {
        const e = new Error(`EINVAL: invalid argument, readlink '${p}'`);
        (e as any).code = 'EINVAL';
        return cb(e);
      }
      return cb(err, linkString);
    });
  } as any;
} catch {}

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
