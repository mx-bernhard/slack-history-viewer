import { ReactNode } from 'react';

export const getHighlighted = (
  parsedText: string | null | undefined,
  highlightPhrases: string[],
  isCurrentSearchResult: boolean
): string | ReactNode | null => {
  if (parsedText == null) return null;
  // Apply highlighting if needed
  // Only highlight plain strings for now
  const regex = new RegExp(
    `(${highlightPhrases.map(highlightPhrase => highlightPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  ); // Escape regex chars
  const parts = parsedText.split(regex);
  return parts.map((part, i) =>
    highlightPhrases.some(
      highlightPhrase => part.toLowerCase() === highlightPhrase.toLowerCase()
    ) ? (
      <mark
        style={
          isCurrentSearchResult
            ? { backgroundColor: '#fff2b3' }
            : { backgroundColor: '#rgb(205 191 109)' }
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
