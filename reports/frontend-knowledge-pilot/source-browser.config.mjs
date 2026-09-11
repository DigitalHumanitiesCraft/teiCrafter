import { fileURLToPath } from 'node:url';
import base from '../../playwright.config.js';

export default {
  ...base,
  testDir: fileURLToPath(new URL('../../test/e2e/', import.meta.url)),
  outputDir: fileURLToPath(new URL('./browser-results/', import.meta.url)),
  workers: 1,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4175', screenshot: 'on' },
  webServer: {
    command: 'python -m http.server 4175 --bind 127.0.0.1 --directory docs',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:4175/editor.html',
    reuseExistingServer: false,
    timeout: 30000,
  },
};
