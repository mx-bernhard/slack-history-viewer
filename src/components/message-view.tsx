import { FC, useCallback, useEffect, useMemo } from 'react';
import { Virtuoso, VirtuosoProps } from 'react-virtuoso';
import { useChatInfoQuery, useMessageQuery } from '../api/use-queries';
import { useStore } from '../store.js';
import { MessageRow } from './message-row';
import { MessageRowSkeleton } from './message-row-skeleton.js';
import { ThreadPanel } from './thread-panel';
import { useSpecialVirtuosoRef } from './use-special-virtuoso-ref.js';

const createRowComponent = ({
  handleThreadClick,
}: {
  handleThreadClick: (threadTs?: string) => void;
}) => {
  const Component: FC<{ index: number }> = ({ index }: { index: number }) => {
    const selectedChatId = useStore(st => st.selectedChatId);
    const { isLoading, data } = useMessageQuery({
      chatId: selectedChatId,
      messageIndex: index,
    });
    const message = data?.message;
    const currentSearchResultMessageKind = useStore(
      ({ selectedChatId, actions: { getCurrentSearchResultMessageKind } }) =>
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

export const MessageView = () => {
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
  const { virtuosoAvailable, virtuosoRef } = useSpecialVirtuosoRef();
  const canScrollToItem = selectedChatId != null && virtuosoAvailable;

  useEffect(() => {
    if (canScrollToItem) {
      const scrollToMessageIndex = messageIndex ?? (countInfo?.total ?? 1) - 1;
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: scrollToMessageIndex,
          align: 'center',
        });
      }, 100);
    }
  }, [canScrollToItem, countInfo?.total, messageIndex, virtuosoRef]);

  const renderRow = useMemo(
    () =>
      createRowComponent({
        handleThreadClick,
      }),
    [handleThreadClick]
  );
  useEffect(() => {
    console.log('mounted');
    return () => {
      console.log('unmounted');
    };
  }, []);

  const virtuosoProps = (() => {
    if (selectedChatId == null) {
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

  return (
    <div className="message-view-container">
      <div className="message-view-inner">
        <div
          className="message-list-container"
          style={{
            width: selectedThreadTs != null ? 'calc(100% - 350px)' : '100%',
          }}
        >
          <Virtuoso
            className="message-list"
            itemContent={renderRow}
            ref={virtuosoRef}
            {...virtuosoProps}
          />
        </div>
      </div>
      {selectedThreadTs != null && selectedChatId != null && <ThreadPanel />}
    </div>
  );
};

export function getId(chatId: string, ts: string) {
  return `${chatId}_${ts}`;
}
