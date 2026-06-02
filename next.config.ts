import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/": [
      ".venv/**",
      ".venv-tts/**",
      ".venv-chatterbox/**",
      "fish-speech-repo/**",
      "moss-tts-repo/**",
      "third_party/**",
    ],
  },
};

export default nextConfig;
