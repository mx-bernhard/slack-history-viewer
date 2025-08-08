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
import {
  ListChildComponentProps,
  ListOnItemsRenderedProps,
  VariableSizeList,
} from 'react-window';
import { useChatInfoQuery, useMessagesQuery } from '../api/use-queries';
import { useStore } from '../store.js';
import { MessageRow } from './message-row';
import { ThreadPanel } from './thread-panel';
import { useIsClient } from './use-is-client';

const batchSize = 100;

const ListComponent = VariableSizeList as unknown as ComponentType<{
  className?: string;
  height: number;
  width: number;
  itemCount: number;
  itemSize: (index: number) => number;
  ref: Ref<VariableSizeList>;
  children: (props: ListChildComponentProps) => ReactNode;
  onItemsRendered?: ((props: ListOnItemsRenderedProps) => unknown) | undefined;
}>;

const createRowComponent = ({
  handleThreadClick,
  onSizeMeasured,
  selectedChatId,
}: {
  handleThreadClick: (threadTs?: string) => void;
  onSizeMeasured: (height: number, index: number) => void;
  selectedChatId: string | null;
}) => {
  const Component = ({ index, style }: ListChildComponentProps) => {
    const startIndex = Math.floor(index / batchSize) * batchSize;
    const { isLoading, data } = useMessagesQuery({
      chatId: selectedChatId,
      rows: batchSize,
      start: startIndex,
    });

    if (isLoading || data == null) {
      return <div style={style}>Loading...</div>;
    }
    const message = data[index % batchSize];
    if (message == null) {
      return <div style={style}>Loading...</div>;
    }
    return (
      <MessageRow
        style={style}
        message={message}
        index={index}
        onThreadClick={handleThreadClick}
        onSizeMeasured={onSizeMeasured}
      />
    );
  };
  return Component;
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
  const [refCallback] = useMeasure({ scroll: true });
  const isClient = useIsClient();

  const [list, setList] = useState<VariableSizeList | null>(null);
  const rowHeightsRef = useRef<{ [key: string]: number }>({});

  const { data: countInfo } = useChatInfoQuery(selectedChatId);

  const getRowHeight = useCallback((index: number) => {
    return rowHeightsRef.current[index] ?? 66;
  }, []);

  const resetAfterIndex = useMemo(() => {
    return debounceCollect((collectedArgs: [number][]) => {
      if (list == null || collectedArgs.length === 0) {
        return;
      }
      const indices = collectedArgs.map(args => args[0]);
      const minIndex = Math.min(...indices);
      list.resetAfterIndex(minIndex - 1, true);
    }, 50);
  }, [list]) as (index: number) => void;

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

  const onSizeMeasured = useCallback(
    (height: number, index: number) => {
      if (list != null && rowHeightsRef.current[index] !== height) {
        rowHeightsRef.current[index] = height;
        resetAfterIndex(index);
      }
    },
    [list, resetAfterIndex]
  );
  const canScrollToItem = isClient && selectedChatId != null && list != null;
  useEffect(() => {
    if (canScrollToItem) {
      const scrollToMessageIndex = messageIndex ?? (countInfo?.total ?? 1) - 1;
      setTimeout(() => {
        list.scrollToItem(scrollToMessageIndex, 'smart');
      }, 100);
    }
  }, [canScrollToItem, countInfo?.total, list, messageIndex]);

  const Row = useMemo(
    () =>
      createRowComponent({
        handleThreadClick,
        onSizeMeasured,
        selectedChatId,
      }),
    [onSizeMeasured, handleThreadClick, selectedChatId]
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
        <div ref={refCallback} className="message-view-inner">
          <AutoSizer>
            {({ height, width }) => (
              <div
                className="message-list-container"
                style={{
                  width:
                    selectedThreadTs != null ? 'calc(100% - 350px)' : '100%',
                }}
              >
                <ListComponent
                  className="message-list"
                  height={height || 400}
                  width={width || 800}
                  itemCount={countInfo.total}
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
