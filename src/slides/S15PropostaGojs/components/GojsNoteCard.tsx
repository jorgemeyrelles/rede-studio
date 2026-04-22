import type { GojsNoteClassNames, GojsNoteItem } from '../types'

type GojsNoteCardProps = GojsNoteItem & GojsNoteClassNames

export function GojsNoteCard({
  title,
  text,
  noteClassName = 'gojs-note',
  titleClassName = 'gojs-note-title',
  textClassName = 'gojs-note-text',
}: GojsNoteCardProps) {
  return (
    <div className={noteClassName}>
      <div className={titleClassName}>{title}</div>
      <div className={textClassName}>{text}</div>
    </div>
  )
}
