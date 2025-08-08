import { QueryClient, skipToken, useQuery } from '@tanstack/react-query';
import { apiClient } from './api-client';

export const useChatsQuery = () => {
  return useQuery({
    queryKey: ['chats'],
    queryFn: apiClient.getChats,
  });
};

export const useMessagesQuery = (
  args:
    | { chatId: string | null; start: number; rows: number }
    | { chatId: string | null; threadTs: string }
    | null
) => {
  return useQuery({
    queryKey: [
      'messages',
      ...(() => {
        if (args == null) return [];

        if ('rows' in args) {
          return [args.start, args.rows, args.chatId];
        }
        if ('threadTs' in args) {
          return [args.chatId, args.threadTs];
        }
        return [];
      })(),
    ],
    queryFn: () => {
      if (args == null) return [];
      if (args.chatId == null) return Promise.resolve([]);
      return apiClient.getMessages(args.chatId, args);
    },
    enabled: args?.chatId != null,
  });
};

export const useUsersQuery = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: apiClient.getUsers,
  });
};

export const useChatInfoQuery = (chatId: string | null) => {
  return useQuery({
    queryKey: ['getChatInfo', chatId],
    queryFn:
      chatId != null
        ? ({ queryKey: [_, chatId] }) => {
            if (chatId == null) return null;
            return apiClient.getChatInfo(chatId);
          }
        : skipToken,
  });
};

export const createSearchQuery =
  (queryClient: QueryClient) => (query: string, limit: number) =>
    queryClient.fetchQuery({
      queryKey: ['search', query, limit],
      queryFn: () => {
        if (query.trim() === '') return Promise.resolve([]);
        return apiClient.searchMessages(query, limit);
      },
    });
