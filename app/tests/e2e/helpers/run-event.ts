import type { ElectronApplication } from '@playwright/test'

export async function broadcastRunEvent(
  electronApp: ElectronApplication,
  payload: unknown
): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, event) => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 0) {
      throw new Error('No BrowserWindow available for run:event injection')
    }

    for (const targetWindow of windows) {
      targetWindow.webContents.send('run:event', event)
    }
  }, payload)
}
