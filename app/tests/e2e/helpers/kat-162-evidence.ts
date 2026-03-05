import fs from 'node:fs/promises'
import path from 'node:path'

type Kat162EvidenceInput = {
  testName: string
  stateFilePath: string
  runId: string
  artifacts: string[]
  assertions: Record<string, unknown>
}

export async function writeKat162Evidence(input: Kat162EvidenceInput): Promise<string> {
  const outputDir = path.resolve(process.cwd(), 'test-results/kat-162')
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${input.testName}-${Date.now()}.json`)
  await fs.writeFile(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...input }, null, 2),
    'utf8'
  )
  return outputPath
}
