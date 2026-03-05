export function shouldRenderAgentation(isDev: boolean, disableFlag: string | undefined): boolean {
  return isDev && disableFlag !== '1'
}
