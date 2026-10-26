import { defineConfig } from '@playwright/test';

// A pre-installed Chromium can be used by setting PW_CHROMIUM_PATH.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5179',
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      executablePath,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    port: 5179,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
