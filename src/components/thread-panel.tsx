import { useEffect, useMemo, useState } from 'react';
import { useThreadQuery } from '../api/use-queries';
import type { SlackMessage } from '../types';
import { canCombineMessages } from './can-combine-messages';
import { MessageRow } from './message-row';
import { getCurrentSearchResultMessageKind } from './search-result-kind';
import { useStore } from '../store';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { logCatch } from '../utils/log-catch';

import './thread-panel.css';

export const ThreadPanel = ({
  chatId,
  threadTs,
}: {
  chatId?: string;
  threadTs?: string;
}) => {
  const {
    data: messages,
    isLoading,
    error,
  } = useThreadQuery(
    threadTs != null
      ? {
          chatId: chatId ?? null,
          threadTs,
        }
      : null
  );

  const { scrollToThreadMessageIndex, searchResultIndex, searchResults } =
    useStore(
      ({
        actions: { getCurrentSearchResult },
        searchResults,
        searchResultIndex,
      }) => {
        return {
          searchResults,
          searchResultIndex: searchResultIndex ?? null,
          scrollToThreadMessageIndex:
            messages?.findIndex(m => m.ts === getCurrentSearchResult()?.ts) ??
            null,
        };
      }
    );

  const threadMessages = useMemo(() => {
    if (messages == null) {
      return [];
    }

    const parentMessage = messages.find(msg => msg.ts === threadTs);

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
        msg => msg.thread_ts === threadTs && msg.ts !== threadTs
      );

      replyMessages.push(
        ...replies.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))
      );
    }
    return [parentMessage, ...replyMessages];
  }, [threadTs, messages]);

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      scrollToThreadMessageIndex != null &&
      scroller != null &&
      threadMessages.length > 0
    ) {
      setTimeout(() => {
        const row = scroller.querySelector(
          '.highlighted-current-search-result-message'
        );
        if (row != null) {
          row.scrollIntoView({ block: 'center' });
        }
      }, 50);
    }
  }, [scrollToThreadMessageIndex, scroller, threadMessages.length]);

  const navigate = useNavigate();
  const currentSearch = useSearch({ strict: false });

  if (chatId == null) return <></>;

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <h5>Thread</h5>
        <button
          className="thread-close-button"
          onClick={() => {
            navigate({
              to: '.',
              search: { ...currentSearch, threadTs: undefined },
            }).catch(logCatch);
          }}
        >
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
                threadPanel
                chatId={chatId}
                key={message.ts}
                message={message}
                startOfCombinedMessageBlock={startOfCombinedMessageBlock}
                endOfCombinedMessageBlock={endOfCombinedMessageBlock}
                currentSearchResultMessageKind={getCurrentSearchResultMessageKind(
                  {
                    chatId,
                    messageTs: message.ts,
                    searchResults,
                    searchResultIndex,
                  }
                )}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
