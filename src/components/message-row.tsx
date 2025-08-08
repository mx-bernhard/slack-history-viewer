import { CSSProperties, useCallback, useEffect, useMemo } from 'react';
import useMeasure from 'react-use-measure';
import { useEmoji } from '../contexts/emoji-context';
import { useUsers } from '../contexts/user-context';
import { SearchResultDocument } from '../server/search-indexer.js';
import { useStore } from '../store';
import { SlackMessage } from '../types.js';
import { isNotEmpty } from '../utils/is-not-empty';
import { parseSlackMessage } from '../utils/message-parser';
import { toDate } from '../utils/to-date.js';
import { FilesRenderer } from './file-renderer';
import { getHighlighted } from './get-highlighted';
import { AttachmentRenderer } from './message-attachments/attachment-renderer';
import { BlockRenderer } from './message-blocks/block-renderer';
import { ReactionsList } from './message-reactions/reactions-list';

const emptyArray: string[] = [];

export const MessageRow = ({
  style: reactWindowStyle,
  message,
  index,
  onThreadClick,
  onSizeMeasured,
}: {
  style?: CSSProperties;
  message: SlackMessage;
  index: number;
  onThreadClick?: (threadTs: string) => void;
  onSizeMeasured: (height: number, messageIndex: number) => void;
}) => {
  const { selectedChatId, isCurrentSearchResult, highlightPhrases } = useStore(
    ({
      selectedChatId,
      currentResultIndex,
      actions: {
        getSearchResults,
        isCurrentSearchResult,
        isMessageInSearchResults,
      },
    }) => {
      const searchResults = getSearchResults();
      const currentSearchResult: SearchResultDocument | undefined =
        searchResults[currentResultIndex];

      return {
        selectedChatId,
        isCurrentSearchResult,
        highlightPhrases: isMessageInSearchResults(message.ts)
          ? (currentSearchResult?.highlightPhrases ?? emptyArray)
          : emptyArray,
      };
    }
  );

  const replyCount = message.reply_count ?? 0;
  const [ref, { height }] = useMeasure({ debounce: 300 });
  useEffect(() => {
    if (height > 0) {
      onSizeMeasured(height + 8, index);
    }
  }, [height, index, onSizeMeasured]);
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji();

  const handleThreadClick = useCallback(() => {
    if (!onThreadClick || !message.ts) return;
    onThreadClick(message.ts);
  }, [onThreadClick, message]);

  const replyCountText = useMemo(() => {
    if (message.replies && message.replies.length > 0) {
      const count = message.replies.length;
      const uniqueUsers = new Set(message.replies.map(reply => reply.user))
        .size;

      const replyLinkText = `${String(count)} ${count === 1 ? 'reply' : 'replies'}`;
      if (uniqueUsers === 1) {
        return replyLinkText;
      } else {
        return `${replyLinkText} from ${String(uniqueUsers)} people`;
      }
    }

    if (replyCount === 0) return '';

    const replyText = `${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`;
    if (message.reply_users_count === 1) {
      return replyText;
    } else if (message.reply_users_count != null) {
      return `${replyText} from ${String(message.reply_users_count)} people`;
    }

    return replyText;
  }, [message.replies, message.reply_users_count, replyCount]);

  const user = message.user != null ? getUserById(message.user) : undefined;

  const displayName =
    user?.profile.display_name ??
    user?.name ??
    user?.profile.real_name ??
    user?.id ??
    'Unknown User';

  const avatarUrl = user?.profile.image_72;
  const timestamp = toDate(message.ts);

  const hasBlocks = isNotEmpty(message.blocks);
  const hasAttachments = isNotEmpty(message.attachments);
  const hasFiles = isNotEmpty(message.files);
  const hasReactions = isNotEmpty(message.reactions);

  const hasReplies = isNotEmpty(message.replies) || replyCount > 0;

  return (
    <div style={reactWindowStyle} className="message-row">
      <div className="message-row-content" ref={ref}>
        {avatarUrl != null && (
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
            className="message-avatar"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
        {avatarUrl == null && (
          <div className="message-avatar">{displayName.charAt(0)}</div>
        )}
        <div className="message-content">
          <div className="message-header">
            <span className="message-user-name">{displayName}</span>{' '}
            <span className="message-timestamp">
              {timestamp.toLocaleString()}
            </span>
          </div>
          {hasBlocks ? (
            <BlockRenderer
              blocks={message.blocks ?? []}
              messageTs={message.ts}
            />
          ) : (
            getHighlighted(
              parseSlackMessage(message.text, getUserById, parseEmoji),
              highlightPhrases,
              isCurrentSearchResult(selectedChatId ?? '', message.ts)
            )
          )}
          {hasFiles && selectedChatId != null && (
            <FilesRenderer
              files={message.files ?? []}
              chatId={selectedChatId}
            />
          )}
          {hasAttachments && (
            <AttachmentRenderer
              attachments={message.attachments ?? []}
              messageTs={message.ts}
            />
          )}
          {hasReactions && (
            <ReactionsList reactions={message.reactions ?? []} />
          )}
          {hasReplies && (
            <div className="thread-indicator" onClick={handleThreadClick}>
              <span className="thread-icon">💬</span> {replyCountText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
