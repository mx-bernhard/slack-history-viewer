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
  const isClient = useIsClient(); // SSR safety check
  // Use a state variable to store the list instance to get notified when the list becomes available
  const [list, setList] = useState<VariableSizeList | null>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const rowHeightsRef = useRef<{ [key: string]: number }>({});

  // Thread state
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

  // Function to calculate the row height
  const getRowHeight = useCallback(
    (index: number) => {
      if (messages?.[index] == null) return 50; // Default

      // Use message timestamp as key
      const ts = messages[index].ts;
      // Return custom height if it exists, otherwise calculate it
      return (
        rowHeightsRef.current[ts] ??
        estimateMessageHeight(messages[index], width)
      );
    },
    [messages, width]
  );

  // Track which images have already been measured to prevent duplicate additions
  const measuredImagesRef = useRef<Set<string>>(new Set());
  const resetAfterIndex: (index: number) => void = useMemo(() => {
    return debounceCollect(
      (collectedArgs: [number][]) => {
        if (list == null || collectedArgs.length === 0) {
          return;
        }
        const indices = collectedArgs.map(args => args[0]);
        const minIndex = Math.min(...indices);
        list.resetAfterIndex(minIndex, true);
      },
      300 // Debounce time
    );
  }, [list]) as (index: number) => void;

  // Handle image load to recalculate heights
  const handleImageLoad = useCallback(
    (index: number, imageHeight: number, imageUrl: string) => {
      if (messages?.[index] == null) return;

      const ts = messages[index].ts;

      // Use the image URL directly as the cache key
      // Skip if we've already measured this specific image
      if (measuredImagesRef.current.has(imageUrl)) {
        return;
      }

      // Mark this specific image as measured
      measuredImagesRef.current.add(imageUrl);

      // Get initial height (estimated or previously cached)
      const currentHeight = getRowHeight(index);
      // Calculate new height considering the image
      const newHeight = currentHeight + imageHeight;

      // Only update if height has changed significantly
      if (Math.abs(newHeight - currentHeight) > 20) {
        if (list != null && rowHeightsRef.current[ts] !== newHeight) {
          rowHeightsRef.current[ts] = newHeight;
          resetAfterIndex(index);
        }
      }
    },
    [messages, getRowHeight, list, resetAfterIndex]
  );

  // Handle thread click
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

  // Set up scroll to highlighted message (if any)
  useEffect(() => {
    // Use the list state variable directly
    // Check if list is ready (state variable is not null)
    if (
      isClient &&
      !isLoading &&
      selectedChatId != null &&
      unfilteredMessages != null &&
      messages != null &&
      messages.length > 0 &&
      list != null // Check the list state variable
    ) {
      const allMessagesIndex = (() => {
        if (scrollToId != null) {
          // A specific search result is selected, find its index by ID
          const targetIndexCandidate = unfilteredMessages.findIndex(
            msg => getId(selectedChatId, msg.ts) === scrollToId
          );
          if (targetIndexCandidate === -1) {
            // Handle potentially null scrollToId in the log message
            console.warn(
              `MessageView: Could not find message index for ID: ${scrollToId}`
            );
          }
          return targetIndexCandidate;
        } else {
          // No specific search result selected (e.g., initial load, chat changed)
          // Default behavior: Scroll to the bottom (newest message)
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
        // Scroll to the target message
        setTimeout(() => {
          // Use the list state variable from the hook's scope
          // Remove inner null check as outer condition already ensures list is not null
          list.scrollToItem(mainChatIndex, 'smart');
        }, 100); // Keep timeout for potential rendering delays
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

  // Reset cached heights when chat changes
  useEffect(() => {
    if (prevChatIdRef.current !== selectedChatId) {
      rowHeightsRef.current = {};
      measuredImagesRef.current.clear(); // Clear the set of measured images
      prevChatIdRef.current = selectedChatId;
      // Also close any open thread when changing chats
      setActiveThreadTs(null);
    }
  }, [selectedChatId]);

  // Render message row
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

  // No render if not client-side yet
  if (!isClient) {
    return <div className="message-view-container">Loading messages...</div>;
  }

  // Content for the component
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
                height={height || 400} // Fallback height
                width={width || 800} // Fallback width
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
