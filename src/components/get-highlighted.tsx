import { ReactNode } from 'react';

export const getHighlighted = (
  parsedText: string | null | undefined,
  highlightPhrases: string[],
  mode: 'current' | 'any' | 'none'
): string | ReactNode | null => {
  if (parsedText == null) return null;

  const regex = new RegExp(
    `(${highlightPhrases.map(highlightPhrase => highlightPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = parsedText.split(regex);
  return parts.map((part, i) =>
    highlightPhrases.some(
      highlightPhrase => part.toLowerCase() === highlightPhrase.toLowerCase()
    ) ? (
      <mark
        style={
          mode === 'current'
            ? { backgroundColor: '#fff2b3' }
            : mode === 'any'
              ? { backgroundColor: '#rgb(205 191 109)' }
              : {}
        }
        key={i}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};
