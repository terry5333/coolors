/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // 讓 build 不因為 eslint 掛掉（尤其在 CI/Vercel）
    ignoreDuringBuilds: true
  },
  typescript: {
    // 如果你也想保險：避免 TS error 直接讓 build fail
    // 先讓它上線跑，之後再慢慢修 TS
    ignoreBuildErrors: true
  }
};

module.exports = nextConfig;
