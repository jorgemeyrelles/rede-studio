export type GojsNoteItem = {
  title: string;
  text: string;
};

export type GojsNoteClassNames = {
  noteClassName?: string;
  titleClassName?: string;
  textClassName?: string;
};

export type GojsNotesFooterProps = {
  notes: GojsNoteItem[];
  containerClassName?: string;
} & GojsNoteClassNames;
