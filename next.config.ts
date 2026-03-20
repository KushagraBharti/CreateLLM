import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-build",
  async redirects() {
    return [
      {
        source: "/benchmark",
        destination: "/arena",
        permanent: true,
      },
      {
        source: "/benchmark/:id",
        destination: "/arena/:id",
        permanent: true,
      },
      {
        source: "/results",
        destination: "/archive",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
