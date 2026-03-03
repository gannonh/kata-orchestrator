import fs from 'node:fs/promises'
import path from 'node:path'

type Kat161EvidenceInput = {
  testName: string
  stateFilePath: string
  activeSpaceId: string | null
  activeSessionId: string | null
  details: Record<string, unknown>
}

export async function writeKat161Evidence(input: Kat161EvidenceInput): Promise<string> {
  const outputDir = path.resolve(process.cwd(), 'test-results/kat-161')
  await fs.mkdir(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, `${input.testName}-${Date.now()}.json`)
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...input
      },
      null,
      2
    ),
    'utf8'
  )

  return outputPath
}
