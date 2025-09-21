import type { FC, ReactNode } from 'react';
import { createContext, useCallback, useContext } from 'react';
import { emojiImageMap } from '../components/emoji-map';

interface EmojiContextType {
  parseEmoji: (text: string) => string;
}

const defaultEmojiContextValue: EmojiContextType = {
  parseEmoji: (text: string) => text,
};

const EmojiContext = createContext<EmojiContextType>(defaultEmojiContextValue);

interface EmojiProviderProps {
  children: ReactNode;
}

const emojiRegex = /:([a-zA-Z0-9_+-]+):/g;

export const EmojiProvider: FC<EmojiProviderProps> = ({ children }) => {
  const parseEmoji = useCallback((text: string): string => {
    if (!text) {
      return '';
    }

    return text.replace(emojiRegex, (match, code: string) => {
      const imagePath = emojiImageMap[match];
      if (typeof imagePath === 'string' && imagePath.length > 0) {
        return `<img src="${imagePath}" alt="${code}" class="emoji-image" />`;
      }
      return match;
    });
  }, []);

  const value: EmojiContextType = {
    parseEmoji,
  };

  return (
    <EmojiContext.Provider value={value}>{children}</EmojiContext.Provider>
  );
};

export const useEmoji = (): EmojiContextType => useContext(EmojiContext);
