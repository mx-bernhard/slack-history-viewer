import { FC, useCallback, useMemo } from 'react';
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
    isCurrentSearchResult,
  } = useStore(
    ({
      actions: { setSelectedThreadTs },
      selectedThreadTs,
      selectedChatId,
      actions: { isCurrentSearchResult },
    }) => {
      return {
        setSelectedThreadTs,
        selectedChatId,
        selectedThreadTs,
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

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <h3>Thread</h3>
        <button className="thread-close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="thread-messages">
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
                isCurrentSearchResult={
                  selectedChatId != null &&
                  isCurrentSearchResult(selectedChatId, message.ts)
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
};
