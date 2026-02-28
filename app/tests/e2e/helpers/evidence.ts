import fs from 'node:fs/promises'
import path from 'node:path'

type Kat101EvidenceInput = {
  testName: string
  stateFilePath: string
  spaceName: string
  preRelaunchCount: number
  postRelaunchCount: number
  persistedSpace: unknown
}

export async function writeKat101Evidence(input: Kat101EvidenceInput): Promise<string> {
  const outputDir = path.resolve(process.cwd(), 'test-results/kat-101')
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
