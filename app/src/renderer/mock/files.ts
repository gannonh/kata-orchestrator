export type MockFileNode = {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  tone?: 'default' | 'accent'
  icon?: 'git' | 'lock' | 'settings' | 'info' | 'file'
  stats?: {
    added?: number
    removed?: number
  }
  children?: MockFileNode[]
}

export const mockFiles: MockFileNode[] = [
  {
    id: 'src',
    name: 'src',
    path: 'src',
    type: 'directory',
    tone: 'accent',
    children: [
      {
        id: 'renderer',
        name: 'renderer',
        path: 'src/renderer',
        type: 'directory',
        children: [
          {
            id: 'components',
            name: 'components',
            path: 'src/renderer/components',
            type: 'directory',
            children: [
              {
                id: 'shared',
                name: 'shared',
                path: 'src/renderer/components/shared',
                type: 'directory',
                children: [
                  {
                    id: 'tabbar',
                    name: 'TabBar.tsx',
                    path: 'src/renderer/components/shared/TabBar.tsx',
                    type: 'file'
                  },
                  {
                    id: 'statusbadge',
                    name: 'StatusBadge.tsx',
                    path: 'src/renderer/components/shared/StatusBadge.tsx',
                    type: 'file'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'target',
    name: 'target',
    path: 'target',
    type: 'directory'
  },
  {
    id: 'dot-gitignore',
    name: '.gitignore',
    path: '.gitignore',
    type: 'file',
    tone: 'accent',
    icon: 'git',
    stats: {
      added: 3,
      removed: 9
    }
  },
  {
    id: 'cargo-lock',
    name: 'Cargo.lock',
    path: 'Cargo.lock',
    type: 'file',
    icon: 'lock'
  },
  {
    id: 'cargo-toml',
    name: 'Cargo.toml',
    path: 'Cargo.toml',
    type: 'file',
    tone: 'accent',
    icon: 'settings',
    stats: {
      added: 12
    }
  },
  {
    id: 'readme',
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    icon: 'info'
  }
]
