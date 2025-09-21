import type { FC } from 'react';
import { useEffect, useMemo } from 'react';
import type { VirtuosoProps } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import {
  useChatInfoQuery,
  useChatsQuery,
  useMessageQuery,
} from '../api/use-queries';
import { useStore } from '../store';
import { MessageRow } from './message-row';
import { MessageRowSkeleton } from './message-row-skeleton';
import { ThreadPanel } from './thread-panel';
import { useSpecialVirtuosoRef } from './use-special-virtuoso-ref';

import { useUsers } from '../contexts/user-context';
import { getAvatarAndTitle } from './get-avatar-and-title';
import './message-view.css';

const createRowComponent = ({ chatId }: { chatId: string }) => {
  const Component: FC<{ index: number }> = ({ index }: { index: number }) => {
    const { isLoading, data } = useMessageQuery({
      chatId,
      messageIndex: index,
    });
    const { searchResult } = useStore(
      ({ actions: { getCurrentSearchResult } }) => ({
        searchResult: getCurrentSearchResult(),
      })
    );
    const message = data?.message;
    const currentSearchResultMessageKind = useMemo(() => {
      if (searchResult == null || searchResult.chatId != chatId) {
        return 'none';
      }
      return searchResult.ts === data?.message?.ts
        ? 'message'
        : searchResult.threadTs === data?.message?.ts
          ? 'thread-starter'
          : 'none';
    }, [data?.message?.ts, searchResult]);

    if (isLoading || message == null) {
      return <MessageRowSkeleton />;
    }
    return (
      <MessageRow
        threadPanel={false}
        chatId={chatId}
        message={message}
        currentSearchResultMessageKind={currentSearchResultMessageKind}
        startOfCombinedMessageBlock={
          data?.startOfCombinedMessagesBlock === true
        }
        endOfCombinedMessageBlock={data?.endOfCombinedMessagesBlock === true}
      />
    );
  };
  return function RowComponent(index: number) {
    return <Component index={index} />;
  };
};

const baseSingleRowVirtuosoProps = (message: string, className: string) =>
  ({
    itemContent: () => <div className={className}>{message}</div>,
    totalCount: 1,
  }) satisfies Partial<VirtuosoProps<string, object>>;

const loadingMessagesVirtuosoProps = {
  ...baseSingleRowVirtuosoProps('Loading message...', 'loading-indicator'),
} satisfies Partial<VirtuosoProps<string, object>>;
const noMessagesInThisChatVirtuosoProps = {
  ...baseSingleRowVirtuosoProps('No messages in this chat', 'empty-message'),
} satisfies Partial<VirtuosoProps<string, object>>;
const noChatSelectedVirtuosoProps = {
  ...baseSingleRowVirtuosoProps('No chat selected', 'no-chat-selected'),
} satisfies Partial<VirtuosoProps<string, object>>;

export const MessageView = ({
  chatId,
  threadTs,
  scrollToMessageIndex: scrollToMessageIndexProp,
}: {
  chatId: string | null;
  threadTs: string | null;
  scrollToMessageIndex: number | null;
}) => {
  const { data: countInfo } = useChatInfoQuery(chatId ?? null);
  const { data: chats } = useChatsQuery();
  const chatInfo = chats?.find(chat => chat.id === chatId);
  const { virtuosoAvailable, virtuosoRef } = useSpecialVirtuosoRef();
  const canScrollToItem = chatId != null && virtuosoAvailable;

  useEffect(() => {
    if (canScrollToItem) {
      const scrollToMessageIndex =
        scrollToMessageIndexProp ?? (countInfo?.total ?? 1) - 1;
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: scrollToMessageIndex,
          align: 'center',
        });
      }, 100);
    }
  }, [
    canScrollToItem,
    countInfo?.total,
    scrollToMessageIndexProp,
    virtuosoRef,
  ]);

  const renderRow = useMemo(
    () =>
      chatId != null
        ? createRowComponent({
            chatId,
          })
        : () => <></>,
    [chatId]
  );

  const virtuosoProps = (() => {
    if (chatId == null) {
      return noChatSelectedVirtuosoProps;
    } else if (countInfo == null) {
      return loadingMessagesVirtuosoProps;
    } else if (countInfo.total == 0) {
      return noMessagesInThisChatVirtuosoProps;
    } else {
      return { totalCount: countInfo.total } satisfies Partial<
        VirtuosoProps<string, object>
      >;
    }
  })();
  const { getUserById } = useUsers();
  const { element, title } =
    chatInfo != null
      ? getAvatarAndTitle(chatInfo, getUserById)
      : { element: <></>, title: '' };
  return (
    <div className="message-view-container">
      <div className="message-view-header">
        {element}
        <h2>{title}</h2>
      </div>
      <div className="message-view-inner">
        <div
          className="message-list-container"
          style={{
            width: threadTs != null ? 'calc(100% - 350px)' : '100%',
          }}
        >
          <Virtuoso
            className="message-list"
            itemContent={renderRow}
            ref={virtuosoRef}
            {...virtuosoProps}
          />
        </div>
        {threadTs != null && chatId != null && (
          <ThreadPanel chatId={chatId} threadTs={threadTs} />
        )}
      </div>
    </div>
  );
};

export function getId(chatId: string, ts: string) {
  return `${chatId}_${ts}`;
}
