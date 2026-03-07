import type { SpecArtifactDiagnostic } from '@shared/types/spec-document'

type SpecArtifactDiagnosticsProps = {
  sourcePath: string
  diagnostics: SpecArtifactDiagnostic[]
}

export function SpecArtifactDiagnostics({
  sourcePath,
  diagnostics
}: SpecArtifactDiagnosticsProps) {
  if (diagnostics.length === 0) {
    return null
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Spec artifact issue</p>
      <p className="text-muted-foreground">{sourcePath}</p>
      <ul className="mt-2 list-disc pl-5">
        {diagnostics.map((diagnostic) => (
          <li key={`${diagnostic.code}-${diagnostic.message}`}>
            {diagnostic.code}: {diagnostic.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
