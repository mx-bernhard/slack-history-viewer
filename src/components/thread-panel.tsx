import { FC, useCallback, useMemo } from 'react';
import { useMessagesQuery } from '../api/use-queries';
import { SlackMessage } from '../types';
import { MessageRow } from './message-row';
import { useStore } from '../store';

export const ThreadPanel: FC = () => {
  const { setSelectedThreadTs, selectedChatId, selectedThreadTs } = useStore(
    ({
      actions: { setSelectedThreadTs },
      selectedThreadTs,
      selectedChatId,
    }) => {
      return {
        setSelectedThreadTs,
        selectedChatId,
        selectedThreadTs,
      };
    }
  );
  const {
    data: messages,
    isLoading,
    error,
  } = useMessagesQuery(
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
          threadMessages.map((message, index) => (
            <MessageRow
              onSizeMeasured={() => {}}
              key={message.ts}
              message={message}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
};
