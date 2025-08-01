import { QueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from './api-client';

// Chat list query hook
export const useChatsQuery = () => {
  return useQuery({
    queryKey: ['chats'],
    queryFn: apiClient.getChats,
  });
};

// Messages query hook
export const useMessagesQuery = (chatId: string | null) => {
  return useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => {
      if (chatId == null) return Promise.resolve([]);
      return apiClient.getMessages(chatId);
    },
    enabled: chatId != null, // Only run the query if chatId is provided
  });
};

// Users query hook
export const useUsersQuery = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: apiClient.getUsers,
  });
};

// Search query hook
export const createSearchQuery =
  (queryClient: QueryClient) => (query: string, limit: number) =>
    queryClient.fetchQuery({
      queryKey: ['search', query, limit],
      queryFn: () => {
        if (query.trim() === '') return Promise.resolve([]);
        return apiClient.searchMessages(query, limit);
      },
    });
