import { SlackMessage, ChatInfo, SlackUser } from '../types';
import { SearchResultDocument } from '../server/search-indexer';

export interface EmojiData {
  emoji: string;
  description: string;
  category: string;
  aliases: string[];
  tags: string[];
  unicode_version: string;
  ios_version?: string;
  skin_tones?: boolean;
}

const handleApiError = (response: Response) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status.toString()}`);
  }
  return response.json();
};

export const apiClient = {
  getChats: async (): Promise<ChatInfo[]> => {
    const response = await fetch('/api/chats');
    return handleApiError(response) as Promise<ChatInfo[]>;
  },

  getMessages: async (
    chatId: string,
    options?: { start: number; rows: number } | { threadTs: string }
  ): Promise<SlackMessage[]> => {
    const optionsSearch = (() => {
      if (options == null) return '';
      if ('rows' in options) {
        return (
          'rows=' + String(options.rows) + '&start=' + String(options.start)
        );
      } else if ('threadTs' in options) return 'thread_ts=' + options.threadTs;
      return '';
    })();
    const response = await fetch(`/api/messages/${chatId}?${optionsSearch}`);
    return handleApiError(response) as Promise<SlackMessage[]>;
  },

  getChatInfo: async (chatId: string): Promise<{ total: number }> => {
    const response = await fetch(`/api/messages/${chatId}/count`);
    return handleApiError(response) as Promise<{ total: number }>;
  },

  getUsers: async (): Promise<SlackUser[]> => {
    const response = await fetch('/api/users');
    return handleApiError(response) as Promise<SlackUser[]>;
  },

  searchMessages: async (
    query: string,
    limit: number
  ): Promise<SearchResultDocument[]> => {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&limit=${String(limit)}`
    );
    return handleApiError(response) as Promise<SearchResultDocument[]>;
  },
};
