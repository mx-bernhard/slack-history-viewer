import { CSSProperties, useCallback, useEffect } from 'react';
import useMeasure from 'react-use-measure';
import { useEmoji } from '../contexts/emoji-context';
import { useUsers } from '../contexts/user-context';
import { SearchResultDocument } from '../server/search-indexer.js';
import { useStore } from '../store';
import { SlackMessage } from '../types.js';
import { isNotEmpty } from '../utils/is-not-empty';
import { parseSlackMessage } from '../utils/message-parser';
import { FilesRenderer } from './file-renderer';
import { getHighlighted } from './get-highlighted';
import { AttachmentRenderer } from './message-attachments/attachment-renderer';
import { BlockRenderer } from './message-blocks/block-renderer';
import { ReactionsList } from './message-reactions/reactions-list';
import { getId } from './message-view.js';

const emptyArray: string[] = [];

export const MessageRow = ({
  style,
  message,
  onImageLoad,
  index,
  onThreadClick,
  onSizeMeasured,
}: {
  style: CSSProperties;
  message: SlackMessage;
  onImageLoad?: (index: number, height: number, imageUrl: string) => void;
  index: number;
  onThreadClick?: (threadTs: string) => void;
  onSizeMeasured: (height: number, messageIndex: number) => void;
}) => {
  const {
    selectedChatId,
    isCurrentSearchResult,
    highlightPhrases,
    messageInSearchResults,
  } = useStore(
    ({
      selectedChatId,
      currentResultIndex,
      actions: { getSearchResults, isCurrentSearchResult },
    }) => {
      const searchResults = getSearchResults();
      const currentSearchResult: SearchResultDocument | undefined =
        searchResults?.[currentResultIndex];

      const messageInSearchResults =
        getSearchResults()?.some(
          ({ id }) => id === getId(selectedChatId ?? '', message.ts)
        ) ?? false;
      return {
        selectedChatId,
        currentResultIndex,
        getSearchResults,
        isCurrentSearchResult,
        messageInSearchResults,
        highlightPhrases: messageInSearchResults
          ? (currentSearchResult?.highlightPhrases ?? emptyArray)
          : emptyArray,
      };
    }
  );

  const reply_count = message.reply_count ?? 0;
  const [ref, { height }] = useMeasure({ debounce: 300 });
  useEffect(() => {
    if (height > 0) {
      onSizeMeasured(height + 8, index);
    }
  }, [height, index, onSizeMeasured]);
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji();

  // Handle image load event to update the row height - wrapped in useCallback
  // This adapted function bridges the gap between what AttachmentRenderer provides (just height)
  // and what our parent expects (index and height)
  const handleAttachmentImageLoad = useCallback(
    (imageHeight: number, imageUrl: string) => {
      if (onImageLoad == null) return;
      onImageLoad(index, imageHeight, imageUrl);
    },
    [onImageLoad, index]
  );

  const handleThreadClick = useCallback(() => {
    if (!onThreadClick || !message.ts) return;
    onThreadClick(message.ts);
  }, [onThreadClick, message]);

  const getReplyCountText = useCallback(() => {
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

    if (reply_count === 0) return '';

    const replyText = `${String(reply_count)} ${reply_count === 1 ? 'reply' : 'replies'}`;
    if (message.reply_users_count === 1) {
      return replyText;
    } else if (message.reply_users_count != null) {
      return `${replyText} from ${String(message.reply_users_count)} people`;
    }

    return replyText;
  }, [message.replies, message.reply_users_count, reply_count]);

  const user = message.user != null ? getUserById(message.user) : undefined;

  const displayName =
    user?.profile.display_name ??
    user?.name ??
    user?.profile.real_name ??
    user?.id ?? // Fallback to user ID if absolutely necessary
    'Unknown User';

  const avatarUrl = user?.profile.image_72;
  const timestamp = message.ts ? new Date(parseFloat(message.ts) * 1000) : null;

  const hasBlocks = isNotEmpty(message.blocks);
  const hasAttachments = isNotEmpty(message.attachments);
  const hasFiles = isNotEmpty(message.files);
  const hasReactions = isNotEmpty(message.reactions);

  // Check for replies using either the 'replies' array or the reply_count
  const hasReplies = isNotEmpty(message.replies) || reply_count > 0;

  return (
    // Apply the style from react-window for positioning, plus our class
    <div style={style} className="message-row">
      {avatarUrl != null && (
        <img
          src={avatarUrl} // Use the avatarUrl from user data
          alt={`${displayName} avatar`}
          className="message-avatar"
          // Add error handler for broken images
          onError={e => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
        />
      )}
      {avatarUrl == null && (
        <div className="message-avatar">{displayName.charAt(0)}</div>
      )}
      <div ref={ref} className="message-content">
        <div className="message-header">
          <span className="message-user-name">{displayName}</span>{' '}
          {timestamp && (
            <span className="message-timestamp">
              {timestamp.toLocaleString()}
            </span>
          )}
        </div>
        {hasBlocks ? (
          <BlockRenderer
            blocks={message.blocks ?? []}
            messageTs={message.ts}
            messageInSearchResults={messageInSearchResults}
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
            onImageLoad={handleAttachmentImageLoad}
            chatId={selectedChatId}
          />
        )}
        {hasAttachments && (
          <AttachmentRenderer
            attachments={message.attachments ?? []}
            onImageLoad={handleAttachmentImageLoad}
          />
        )}
        {hasReactions && <ReactionsList reactions={message.reactions ?? []} />}
        {hasReplies && (
          <div className="thread-indicator" onClick={handleThreadClick}>
            <span className="thread-icon">💬</span> {getReplyCountText()}
          </div>
        )}
      </div>
    </div>
  );
};
