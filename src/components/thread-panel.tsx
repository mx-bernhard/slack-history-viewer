import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useThreadQuery } from '../api/use-queries';
import { useStore } from '../store';
import { SlackMessage } from '../types';
import { MessageRow } from './message-row';
import { canCombineMessages } from './can-combine-messages';

export const ThreadPanel: FC = () => {
  const {
    setSelectedThreadTs,
    selectedChatId,
    selectedThreadTs,
    threadMessageIndex,
    isCurrentSearchResult,
  } = useStore(
    ({
      selectedThreadTs,
      selectedChatId,
      threadMessageIndex,
      actions: {
        setSelectedThreadTs,
        getCurrentSearchResultMessageKind: isCurrentSearchResult,
      },
    }) => {
      return {
        selectedChatId,
        selectedThreadTs,
        threadMessageIndex,
        setSelectedThreadTs,
        isCurrentSearchResult,
      };
    }
  );
  const {
    data: messages,
    isLoading,
    error,
  } = useThreadQuery(
    selectedThreadTs != null
      ? {
          chatId: selectedChatId,
          threadTs: selectedThreadTs,
        }
      : null
  );

  const onClose = useCallback(() => {
    setSelectedThreadTs(null);
  }, [setSelectedThreadTs]);

  const threadMessages = useMemo(() => {
    if (messages == null) {
      return [];
    }

    const parentMessage = messages.find(msg => msg.ts === selectedThreadTs);

    if (parentMessage == null) {
      return [];
    }

    const replyMessages: SlackMessage[] = [];

    if (parentMessage.replies && parentMessage.replies.length > 0) {
      parentMessage.replies.forEach(reply => {
        const replyMessage = messages.find(msg => msg.ts === reply.ts);
        if (replyMessage) {
          replyMessages.push(replyMessage);
        }
      });

      replyMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    } else {
      const replies = messages.filter(
        msg => msg.thread_ts === selectedThreadTs && msg.ts !== selectedThreadTs
      );

      replyMessages.push(
        ...replies.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))
      );
    }
    return [parentMessage, ...replyMessages];
  }, [selectedThreadTs, messages]);

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (
      threadMessageIndex !== null &&
      scroller != null &&
      threadMessages.length > 0
    ) {
      const row = scroller.querySelector('.highlighted-search-result-message');
      if (row != null) {
        row.scrollIntoView();
      }
    }
  }, [scroller, threadMessageIndex, threadMessages.length]);

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <h3>Thread</h3>
        <button className="thread-close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div ref={setScroller} className="thread-messages">
        {isLoading ? (
          <div className="loading-indicator">Loading thread...</div>
        ) : error ? (
          <div className="error-message">Error loading thread</div>
        ) : threadMessages.length === 0 ? (
          <div className="empty-thread">No thread messages found</div>
        ) : (
          threadMessages.map((message, index) => {
            const previousMessage = threadMessages[index - 1];
            const nextMessage = threadMessages[index + 1];
            const startOfCombinedMessageBlock =
              previousMessage == null ||
              !canCombineMessages(previousMessage, message);
            const endOfCombinedMessageBlock =
              nextMessage != null && !canCombineMessages(nextMessage, message);
            return (
              <MessageRow
                key={message.ts}
                message={message}
                startOfCombinedMessageBlock={startOfCombinedMessageBlock}
                endOfCombinedMessageBlock={endOfCombinedMessageBlock}
                currentSearchResultMessageKind={
                  selectedChatId != null
                    ? isCurrentSearchResult(selectedChatId, message.ts)
                    : 'none'
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
};
