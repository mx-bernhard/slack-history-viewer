import { QueryClient, skipToken, useQuery } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { canCombineMessages } from '../components/can-combine-messages';

export const useChatsQuery = () => {
  return useQuery({
    queryKey: ['chats'],
    queryFn: apiClient.getChats,
  });
};

const batchSize = 100;
const getStartAndRows = (messageIndex: number) => ({
  start: Math.floor(messageIndex / batchSize) * batchSize,
  rows: batchSize,
});

export const useMessagesQuery = (
  args: { chatId: string | null; messageIndex: number } | null
) => {
  const rowsAndStartArg =
    args != null ? getStartAndRows(args.messageIndex) : null;
  return useQuery({
    queryKey: [
      'messages',
      ...(() => {
        if (rowsAndStartArg == null || args == null) return [];
        return [
          'main',
          args.chatId,
          rowsAndStartArg.start,
          rowsAndStartArg.rows,
        ] as const;
      })(),
    ],
    queryFn: async () => {
      if (rowsAndStartArg == null || args == null) return null;
      if (args.chatId == null) return Promise.resolve(null);
      const response = await apiClient.getMessages(
        args.chatId,
        rowsAndStartArg
      );
      return response;
    },
    enabled: args?.chatId != null,
  });
};

export const useMessageQuery = (
  args: { chatId: string | null; messageIndex: number } | null
) => {
  const isStartOfBatch =
    args != null ? args.messageIndex % batchSize === 0 : null;
  const queryResultForMessage = useMessagesQuery(args);

  const previousBatchArgs =
    (isStartOfBatch ?? false) && args?.chatId != null
      ? { chatId: args.chatId, messageIndex: args.messageIndex - 1 }
      : null;
  const queryResultForPreviousBatch = useMessagesQuery(previousBatchArgs);
  const previousMessage = (() => {
    if (isStartOfBatch == null || queryResultForMessage.data == null)
      return null;

    if (isStartOfBatch) {
      return queryResultForPreviousBatch.data?.[batchSize - 1];
    } else {
      return args != null
        ? queryResultForMessage.data[(args.messageIndex - 1) % batchSize]
        : null;
    }
  })();

  const isEndOfBatch =
    args != null ? args.messageIndex % batchSize === batchSize - 1 : null;
  const nextBatchArgs =
    (isEndOfBatch ?? false) && args?.chatId != null
      ? { chatId: args.chatId, messageIndex: args.messageIndex - 1 }
      : null;
  const queryResultForNextBatch = useMessagesQuery(nextBatchArgs);
  const nextMessage = (() => {
    if (isEndOfBatch == null || queryResultForMessage.data == null) return null;

    if (isEndOfBatch) {
      return queryResultForNextBatch.data?.[batchSize - 1];
    } else {
      return args != null
        ? queryResultForMessage.data[(args.messageIndex + 1) % batchSize]
        : null;
    }
  })();

  return {
    ...queryResultForMessage,
    loading:
      queryResultForMessage.isLoading || queryResultForPreviousBatch.isLoading,
    data: (() => {
      if (queryResultForMessage.data == null) {
        return null;
      }
      const message =
        queryResultForMessage.data[(args?.messageIndex ?? 0) % batchSize];
      const isSameUserInPreviousMessage =
        previousMessage?.user != null &&
        message?.user != null &&
        canCombineMessages(previousMessage, message);
      const isSameUserInNextMessage =
        nextMessage?.user != null &&
        message?.user != null &&
        canCombineMessages(nextMessage, message);
      return {
        message: message,
        startOfCombinedMessagesBlock: !isSameUserInPreviousMessage,
        endOfCombinedMessagesBlock: !isSameUserInNextMessage,
      };
    })(),
  };
};

export const useThreadQuery = (
  args: { chatId: string | null; threadTs: string } | null
) => {
  return useQuery({
    queryKey: [
      'messages',
      ...(() => {
        if (args == null) return [];

        if ('threadTs' in args) {
          return ['thread', args.threadTs, args.chatId];
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
