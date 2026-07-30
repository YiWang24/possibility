import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@possibility/shared-types", "@possibility/api-client"],
};

export default nextConfig;
