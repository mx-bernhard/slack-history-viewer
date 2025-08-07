import debounceCollect from 'debounce-collect';
import {
  ComponentType,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useMeasure from 'react-use-measure';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ListChildComponentProps, VariableSizeList } from 'react-window';
import { useMessagesQuery } from '../api/use-queries';
import { useStore } from '../store.js';
import { estimateMessageHeight } from './estimate-message-height';
import { MessageRow } from './message-row';
import { ThreadPanel } from './thread-panel';
import { useIsClient } from './use-is-client';

const ListComponent = VariableSizeList as unknown as ComponentType<{
  className?: string;
  height: number;
  width: number;
  itemCount: number;
  itemSize: (index: number) => number;
  ref: Ref<VariableSizeList>;
  children: (props: ListChildComponentProps) => ReactNode;
}>;

const ClientMessageView = () => {
  const { scrollToId, selectedChatId } = useStore(
    ({
      selectedChatId,
      currentResultIndex,
      searchQuery,
      actions: { getCurrentTargetId, getSearchResults },
    }) => {
      return {
        selectedChatId,
        currentResultIndex,
        searchQuery,
        getSearchResults,
        scrollToId: getCurrentTargetId(),
      };
    }
  );
  const [refCallback, { width }] = useMeasure({ scroll: true });
  const isClient = useIsClient();

  const [list, setList] = useState<VariableSizeList | null>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const rowHeightsRef = useRef<{ [key: string]: number }>({});

  const [activeThreadTs, setActiveThreadTs] = useState<string | null>(null);

  const {
    data: unfilteredMessages,
    isLoading,
    error,
  } = useMessagesQuery(selectedChatId);
  const messages = useMemo(
    () =>
      unfilteredMessages?.filter(
        m => m.thread_ts == null || m.thread_ts === m.ts
      ),
    [unfilteredMessages]
  );

  const getRowHeight = useCallback(
    (index: number) => {
      if (messages?.[index] == null) return 50;

      const ts = messages[index].ts;

      return (
        rowHeightsRef.current[ts] ??
        estimateMessageHeight(messages[index], width)
      );
    },
    [messages, width]
  );

  const measuredImagesRef = useRef<Set<string>>(new Set());
  const resetAfterIndex: (index: number) => void = useMemo(() => {
    return debounceCollect((collectedArgs: [number][]) => {
      if (list == null || collectedArgs.length === 0) {
        return;
      }
      const indices = collectedArgs.map(args => args[0]);
      const minIndex = Math.min(...indices);
      list.resetAfterIndex(minIndex, true);
    }, 300);
  }, [list]) as (index: number) => void;

  const handleImageLoad = useCallback(
    (index: number, imageHeight: number, imageUrl: string) => {
      if (messages?.[index] == null) return;

      const ts = messages[index].ts;

      if (measuredImagesRef.current.has(imageUrl)) {
        return;
      }

      measuredImagesRef.current.add(imageUrl);

      const currentHeight = getRowHeight(index);

      const newHeight = currentHeight + imageHeight;

      if (Math.abs(newHeight - currentHeight) > 20) {
        if (list != null && rowHeightsRef.current[ts] !== newHeight) {
          rowHeightsRef.current[ts] = newHeight;
          resetAfterIndex(index);
        }
      }
    },
    [messages, getRowHeight, list, resetAfterIndex]
  );

  const handleThreadClick = useCallback(
    (threadTs?: string) => {
      if (activeThreadTs != null) {
        setActiveThreadTs(null);
      } else {
        setActiveThreadTs(threadTs ?? null);
      }
    },
    [activeThreadTs]
  );

  const handleSizeMeasured = useCallback(
    (height: number, index: number) => {
      if (!messages?.[index]) return;
      const ts = messages[index].ts;
      if (list != null && rowHeightsRef.current[ts] !== height) {
        rowHeightsRef.current[ts] = height;
        resetAfterIndex(index);
      }
    },
    [messages, list, resetAfterIndex]
  );

  useEffect(() => {
    if (
      isClient &&
      !isLoading &&
      selectedChatId != null &&
      unfilteredMessages != null &&
      messages != null &&
      messages.length > 0 &&
      list != null
    ) {
      const allMessagesIndex = (() => {
        if (scrollToId != null) {
          const targetIndexCandidate = unfilteredMessages.findIndex(
            msg => getId(selectedChatId, msg.ts) === scrollToId
          );
          if (targetIndexCandidate === -1) {
            console.warn(
              `MessageView: Could not find message index for ID: ${scrollToId}`
            );
          }
          return targetIndexCandidate;
        } else {
          return unfilteredMessages.length - 1;
        }
      })();

      if (allMessagesIndex !== -1) {
        const targetMessage = unfilteredMessages[allMessagesIndex];
        const threadTs = targetMessage?.thread_ts;
        if (threadTs != null) {
          setActiveThreadTs(threadTs);
        }
        const mainChatIndex = messages.findIndex(
          message =>
            getId(selectedChatId, message.ts) ===
            `${selectedChatId}_${targetMessage?.thread_ts ?? targetMessage?.ts ?? 'unknown'}`
        );

        setTimeout(() => {
          list.scrollToItem(mainChatIndex, 'smart');
        }, 100);
      }
    }
  }, [
    isClient,
    isLoading,
    list,
    messages,
    scrollToId,
    selectedChatId,
    unfilteredMessages,
  ]);

  useEffect(() => {
    if (prevChatIdRef.current !== selectedChatId) {
      rowHeightsRef.current = {};
      measuredImagesRef.current.clear();
      prevChatIdRef.current = selectedChatId;

      setActiveThreadTs(null);
    }
  }, [selectedChatId]);

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      if (!messages?.[index]) {
        return <div style={style}>Loading...</div>;
      }

      return (
        <MessageRow
          style={style}
          message={messages[index]}
          onImageLoad={handleImageLoad}
          index={index}
          onThreadClick={handleThreadClick}
          onSizeMeasured={handleSizeMeasured}
        />
      );
    },
    [messages, handleImageLoad, handleThreadClick, handleSizeMeasured]
  );

  if (!isClient) {
    return <div className="message-view-container">Loading messages...</div>;
  }

  let content;
  if (isLoading) {
    content = <div className="loading-indicator">Loading messages...</div>;
  } else if (error) {
    content = <div className="error-message">Error loading messages</div>;
  } else if (!messages || messages.length === 0) {
    content = <div className="empty-message">No messages in this chat</div>;
  } else {
    content = (
      <div ref={refCallback} className="message-view-inner">
        <AutoSizer>
          {({ height, width }) => (
            <div
              className="message-list-container"
              style={{
                width: activeThreadTs != null ? 'calc(100% - 350px)' : '100%',
              }}
            >
              <ListComponent
                className="message-list"
                height={height || 400}
                width={width || 800}
                itemCount={messages.length}
                itemSize={getRowHeight}
                ref={setList}
              >
                {Row}
              </ListComponent>
            </div>
          )}
        </AutoSizer>
      </div>
    );
  }

  return (
    <div className="message-view-container">
      {content}
      {activeThreadTs != null && selectedChatId != null && (
        <ThreadPanel
          threadTs={activeThreadTs}
          chatId={selectedChatId}
          onClose={handleThreadClick}
        />
      )}
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
