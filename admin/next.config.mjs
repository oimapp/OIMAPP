/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } }, // photo uploads
};
export default nextConfig;
