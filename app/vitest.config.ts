import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/preload/**/*.d.ts',
        'src/shared/types/spec-document.ts',
        'src/renderer/types/**/*.ts',
        'src/renderer/components/application-shell*.tsx',
        'src/renderer/components/center/primitives/index.ts',
        'src/renderer/components/center/primitives/types.ts',
        'src/renderer/components/right/spec-parser.ts',
        'src/renderer/components/right/spec-task-markdown.ts',
        'src/renderer/components/right/primitives/spec-markdown-types.ts',
        'src/renderer/components/shadcnblocks/**/*.tsx',
        'src/renderer/components/ui/avatar.tsx',
        'src/renderer/components/ui/breadcrumb.tsx',
        'src/renderer/components/ui/command.tsx',
        'src/renderer/components/ui/context-menu.tsx',
        'src/renderer/components/ui/dialog.tsx',
        'src/renderer/components/ui/drawer.tsx',
        'src/renderer/components/ui/dropdown-menu.tsx',
        'src/renderer/components/ui/input-group.tsx',
        'src/renderer/components/ui/sheet.tsx',
        'src/renderer/components/ui/sidebar.tsx',
        'src/renderer/components/ui/skeleton.tsx',
        'src/renderer/components/ui/tooltip.tsx',
        'src/renderer/features/coordinator-session/domain/contracts.ts',
        'src/renderer/features/coordinator-session/domain/index.ts',
        'src/renderer/hooks/use-mobile.ts',
        'src/renderer/lib/utils.ts'
      ],
      perFile: true,
      thresholds: {
        statements: 99,
        branches: 95,
        functions: 99,
        lines: 99
      }
    }
  }
})
