import classNames from 'classnames';
import type { CSSProperties } from 'react';
import { useCallback, useMemo } from 'react';
import { isNotUndefined } from 'typed-assert';
import { useEmoji } from '../contexts/emoji-context.js';
import { useUsers } from '../contexts/user-context.js';
import { useStore } from '../store.js';
import type { SlackMessage } from '../types.js';
import { isNotEmpty } from '../utils/is-not-empty.js';
import { parseSlackMessage } from '../utils/message-parser.js';
import { toDate } from '../utils/to-date.js';
import { FilesRenderer } from './file-renderer.js';
import { getHighlighted } from './get-highlighted.js';
import { AttachmentRenderer } from './message-attachments/attachment-renderer.js';
import { BlockRenderer } from './message-blocks/block-renderer.js';
import { ReactionsList } from './message-reactions/reactions-list.js';
import { useHighlightPhrases } from './use-highlight-phrases.js';

const userLocale = navigator.language;

const formatTime = (ts: string) =>
  new Intl.DateTimeFormat(userLocale, {
    timeStyle: 'short',
  }).format(toDate(ts));

export const MessageRow = ({
  style: reactWindowStyle,
  message,
  onThreadClick,
  startOfCombinedMessageBlock,
  endOfCombinedMessageBlock,
  currentSearchResultMessageKind,
}: {
  style?: CSSProperties;
  message: SlackMessage;
  onThreadClick?: (threadTs: string) => void;
  startOfCombinedMessageBlock: boolean;
  endOfCombinedMessageBlock: boolean;
  currentSearchResultMessageKind: 'message' | 'thread-starter' | 'none';
}) => {
  const { selectedChatId } = useStore(({ selectedChatId }) => {
    return {
      selectedChatId,
    };
  });

  const { highlightPhrases, mode } = useHighlightPhrases(message.ts);

  const replyCount = message.reply_count ?? 0;
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

  const displayName = [
    user?.profile.display_name,
    user?.name,
    user?.profile.real_name,
    user?.id,
    'Unknown User',
  ].find(name => name != null && name.trim().length > 0);
  isNotUndefined(displayName);

  const avatarUrl = user?.profile.image_72;
  const timestamp = toDate(message.ts);

  const hasBlocks = isNotEmpty(message.blocks);
  const hasAttachments = isNotEmpty(message.attachments);
  const hasFiles = isNotEmpty(message.files);
  const hasReactions = isNotEmpty(message.reactions);

  const hasReplies = isNotEmpty(message.replies) || replyCount > 0;

  return (
    <div
      style={reactWindowStyle}
      className={classNames('message-row', {
        'message-row-end': endOfCombinedMessageBlock,
        'message-row-start': startOfCombinedMessageBlock,
        'highlighted-current-search-result-message': mode === 'current',
        'highlighted-current-search-result-thread-starter':
          currentSearchResultMessageKind === 'thread-starter',
        'highlighted-any-search-result-message': mode === 'any',
      })}
    >
      <div className="message-row-content">
        {avatarUrl != null && startOfCombinedMessageBlock && (
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
            className="message-avatar"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
        {avatarUrl == null && startOfCombinedMessageBlock && (
          <div className="message-avatar">{displayName.charAt(0)}</div>
        )}
        {!startOfCombinedMessageBlock && (
          <div className="message-clock">{formatTime(message.ts)}</div>
        )}
        <div
          className={classNames('message-content', {
            'message-content-end': endOfCombinedMessageBlock,
          })}
        >
          {startOfCombinedMessageBlock && (
            <div className="message-header">
              <span className="message-user-name">{displayName}</span>{' '}
              <span className="message-timestamp">
                {timestamp.toLocaleString()}
              </span>
            </div>
          )}
          {hasBlocks ? (
            <BlockRenderer
              blocks={message.blocks ?? []}
              messageTs={message.ts}
            />
          ) : (
            getHighlighted(
              parseSlackMessage(message.text, getUserById, parseEmoji),
              highlightPhrases,
              mode
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
