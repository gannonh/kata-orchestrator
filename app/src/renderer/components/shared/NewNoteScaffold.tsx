const NOTE_SCAFFOLD = 'Start drafting a specification for what you want to build. Or brainstorm with an agent <-'

export function NewNoteScaffold() {
  return <p className="pt-6 text-muted-foreground">{NOTE_SCAFFOLD}</p>
}
