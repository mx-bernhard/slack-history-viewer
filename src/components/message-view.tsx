import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useChatInfoQuery, useMessageQuery } from '../api/use-queries';
import { useStore } from '../store.js';
import { MessageRow } from './message-row';
import { ThreadPanel } from './thread-panel';
import { useIsClient } from './use-is-client';
import { MessageRowSkeleton } from './message-row-skeleton.js';

const createRowComponent = ({
  handleThreadClick,
  selectedChatId,
}: {
  handleThreadClick: (threadTs?: string) => void;
  selectedChatId: string | null;
}) => {
  const Component: FC<{ index: number }> = ({ index }: { index: number }) => {
    const { isLoading, data } = useMessageQuery({
      chatId: selectedChatId,
      messageIndex: index,
    });

    const message = data?.message;
    const currentSearchResultMessageKind = useStore(
      ({ actions: { getCurrentSearchResultMessageKind } }) =>
        selectedChatId != null && message != null
          ? getCurrentSearchResultMessageKind(selectedChatId, message.ts)
          : 'none'
    );
    if (isLoading || message == null) {
      return <MessageRowSkeleton />;
    }
    return (
      <MessageRow
        message={message}
        onThreadClick={handleThreadClick}
        currentSearchResultMessageKind={currentSearchResultMessageKind}
        startOfCombinedMessageBlock={
          data?.startOfCombinedMessagesBlock === true
        }
        endOfCombinedMessageBlock={data?.endOfCombinedMessagesBlock === true}
      />
    );
  };
  return (index: number) => <Component index={index} />;
};

const ClientMessageView = () => {
  const {
    selectedChatId,
    selectedThreadTs,
    messageIndex,
    setSelectedThreadTs,
  } = useStore(
    ({
      actions: { setSelectedThreadTs },
      selectedChatId,
      currentResultIndex,
      selectedThreadTs,
      messageIndex,
    }) => {
      return {
        selectedChatId,
        currentResultIndex,
        selectedThreadTs,
        messageIndex,
        setSelectedThreadTs,
      };
    }
  );
  const isClient = useIsClient();

  const { data: countInfo } = useChatInfoQuery(selectedChatId);

  const handleThreadClick = useCallback(
    (threadTs?: string) => {
      if (selectedThreadTs == threadTs) {
        setSelectedThreadTs(null);
      } else {
        setSelectedThreadTs(threadTs ?? null);
      }
    },
    [selectedThreadTs, setSelectedThreadTs]
  );
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const canScrollToItem =
    isClient && selectedChatId != null && virtuosoRef.current != null;
  useEffect(() => {
    if (canScrollToItem) {
      const scrollToMessageIndex = messageIndex ?? (countInfo?.total ?? 1) - 1;
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex(scrollToMessageIndex);
      }, 100);
    }
  }, [canScrollToItem, countInfo?.total, messageIndex]);

  const renderRow = useMemo(
    () =>
      createRowComponent({
        handleThreadClick,
        selectedChatId,
      }),
    [handleThreadClick, selectedChatId]
  );

  if (!isClient) {
    return <div className="message-view-container">Loading messages...</div>;
  }

  const content = (() => {
    if (countInfo == null) {
      return <div className="loading-indicator">Loading messages...</div>;
    } else if (countInfo.total == 0) {
      return <div className="empty-message">No messages in this chat</div>;
    } else {
      return (
        <div className="message-view-inner">
          <div
            className="message-list-container"
            style={{
              width: selectedThreadTs != null ? 'calc(100% - 350px)' : '100%',
            }}
          >
            <Virtuoso
              className="message-list"
              totalCount={countInfo.total}
              itemContent={renderRow}
              ref={virtuosoRef}
            />
          </div>
        </div>
      );
    }
  })();

  return (
    <div className="message-view-container">
      {content}
      {selectedThreadTs != null && selectedChatId != null && <ThreadPanel />}
    </div>
  );
};

export const MessageView = () => {
  const isClient = useIsClient();
  if (isClient) {
    return <ClientMessageView />;
  }
  return null;
};

export function getId(chatId: string, ts: string) {
  return `${chatId}_${ts}`;
}
