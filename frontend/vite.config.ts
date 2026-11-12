import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { agentGuide } from '@tollbooth-dpyc/web/agent-guide'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

function resolveCommit(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [
    react(), tailwindcss(),
    agentGuide({
      name: "Purser",
      summary: "An Organization sponsors its people's use of Tollbooth DPYC Operators: members, Project budgets, a funding ledger and analytics.",
      site: "https://purser.tollbooth-dpyc.com",
      mcpUrl: "https://purser-mcp.fastmcp.app/mcp",
      toolPrefix: "purser",
      source: "https://github.com/lonniev/tollbooth-purser",
      registryName: "io.github.lonniev/tollbooth-purser",
      body: "agent-guide.md",
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(resolveCommit()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    allowedHosts: ['.ts.net'],
    proxy: {
      '/mcp': {
        target: 'https://purser-mcp.fastmcp.app',
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (req) => {
          if (!req.getHeader('authorization')) req.setHeader('authorization', 'Bearer anonymous')
        }),
      },
    },
  },
  build: { outDir: 'dist' },
})
