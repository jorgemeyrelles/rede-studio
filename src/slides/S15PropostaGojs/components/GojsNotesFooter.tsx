import type { GojsNotesFooterProps } from '../types';
import { GojsNoteCard } from './GojsNoteCard';

export function GojsNotesFooter({
  notes,
  containerClassName = 'gojs-notes',
  noteClassName,
  titleClassName,
  textClassName,
}: GojsNotesFooterProps) {
  return (
    <div className={containerClassName}>
      {notes.map((note) => (
        <GojsNoteCard
          key={note.title}
          title={note.title}
          text={note.text}
          noteClassName={noteClassName}
          titleClassName={titleClassName}
          textClassName={textClassName}
        />
      ))}
    </div>
  );
}
