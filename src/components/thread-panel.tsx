import { FC, useCallback, useEffect, useState } from 'react';
import { useMessagesQuery } from '../api/use-queries';
import { SlackMessage } from '../types';
import { MessageRow } from './message-row';

interface ThreadPanelProps {
  threadTs: string | null;
  chatId: string;
  onClose: () => void;
}

export const ThreadPanel: FC<ThreadPanelProps> = ({
  threadTs,
  chatId,
  onClose,
}) => {
  const [threadMessages, setThreadMessages] = useState<SlackMessage[]>([]);
  const { data: messages, isLoading, error } = useMessagesQuery(chatId);

  // Extract parent message and thread replies when threadTs changes
  // Wrapped in useCallback to prevent unnecessary re-renders
  const processThreadMessages = useCallback(() => {
    if (threadTs == null || messages == null) {
      setThreadMessages([]);
      return;
    }

    // Find the parent message
    const parentMessage = messages.find(msg => msg.ts === threadTs);

    if (!parentMessage) {
      setThreadMessages([]);
      return;
    }

    // If the parent has a 'replies' array, use it to find reply messages
    const replyMessages: SlackMessage[] = [];

    if (parentMessage.replies && parentMessage.replies.length > 0) {
      // Get all messages that match the ts values in the replies array
      parentMessage.replies.forEach(reply => {
        const replyMessage = messages.find(msg => msg.ts === reply.ts);
        if (replyMessage) {
          replyMessages.push(replyMessage);
        }
      });

      // Sort replies by timestamp (oldest first)
      replyMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    } else {
      // Fallback: Find all replies to this thread by thread_ts (older method)
      const replies = messages.filter(
        msg => msg.thread_ts === threadTs && msg.ts !== threadTs
      );

      // Sort replies by timestamp (oldest first)
      replyMessages.push(
        ...replies.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))
      );
    }

    // Combine parent message with replies
    setThreadMessages([parentMessage, ...replyMessages]);
  }, [threadTs, messages]);

  // Use the callback in useEffect
  useEffect(() => {
    processThreadMessages();
  }, [processThreadMessages]);

  if (threadTs == null) {
    return null;
  }

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
              style={{}} // No absolute positioning needed here
              message={message}
              highlightQuery={null}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
};
