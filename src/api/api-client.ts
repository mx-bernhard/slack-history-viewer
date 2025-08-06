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

// Function to handle API errors consistently
const handleApiError = (response: Response) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status.toString()}`);
  }
  return response.json();
};

// API client with methods for each endpoint
export const apiClient = {
  // Get list of chats
  getChats: async (): Promise<ChatInfo[]> => {
    const response = await fetch('/api/chats');
    return handleApiError(response) as Promise<ChatInfo[]>;
  },

  // Get messages for a specific chat
  getMessages: async (chatId: string): Promise<SlackMessage[]> => {
    const response = await fetch(`/api/messages/${chatId}`);
    return handleApiError(response) as Promise<SlackMessage[]>;
  },

  // Get users
  getUsers: async (): Promise<SlackUser[]> => {
    const response = await fetch('/api/users');
    return handleApiError(response) as Promise<SlackUser[]>;
  },

  // Search for messages
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
