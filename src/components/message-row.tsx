import Chip from '@mui/material/Chip';
import { useSearch } from '@tanstack/react-router';
import classNames from 'classnames';
import { useMemo } from 'react';
import { isNotUndefined } from 'typed-assert';
import { useEmoji } from '../contexts/emoji-context';
import { useUsers } from '../contexts/user-context';
import type { SlackMessage } from '../types';
import { isNotEmpty } from '../utils/is-not-empty';
import { parseSlackMessage } from '../utils/message-parser';
import { toDate } from '../utils/to-date';
import { FilesRenderer } from './file-renderer';
import { getAvatarAndTitleForUserId } from './get-avatar-and-title';
import { getHighlighted } from './get-highlighted';
import { Link } from './link';
import { AttachmentRenderer } from './message-attachments/attachment-renderer';
import { BlockRenderer } from './message-blocks/block-renderer';
import { ReactionsList } from './message-reactions/reactions-list';
import { useHighlightPhrases } from './use-highlight-phrases';

import './message-row.css';

const userLocale = navigator.language;

const formatTime = (ts: string) =>
  new Intl.DateTimeFormat(userLocale, {
    timeStyle: 'short',
  }).format(toDate(ts));

export const MessageRow = ({
  message,
  startOfCombinedMessageBlock,
  endOfCombinedMessageBlock,
  currentSearchResultMessageKind,
  chatId,
  threadPanel,
}: {
  message: SlackMessage;
  chatId: string;
  startOfCombinedMessageBlock: boolean;
  endOfCombinedMessageBlock: boolean;
  currentSearchResultMessageKind: 'message' | 'thread-starter' | 'none';
  threadPanel: boolean;
}) => {
  const { highlightPhrases, mode } = useHighlightPhrases(message.ts);

  const replyCount = message.reply_count ?? 0;
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji();

  const replyCountText = useMemo(() => {
    if (message.replies && message.replies.length > 0) {
      const count = message.replies.length;
      const uniqueUsers = new Set(message.replies.map(reply => reply.user));

      const replyLinkText = `${String(count)} ${count === 1 ? 'reply' : 'replies'}`;
      const avatars = [...uniqueUsers]
        .slice(0, 3)
        .map(
          userId =>
            getAvatarAndTitleForUserId(userId, 'unused', getUserById).element
        )
        .concat(
          uniqueUsers.size > 3 ? (
            <Chip label={`+${String(uniqueUsers.size - 3)}`} size="small" />
          ) : (
            <></>
          )
        );
      return (
        <>
          {...avatars}
          <div>{replyLinkText}</div>
          <span className="text-hint" style={{ textDecoration: 'none' }}>
            latest reply:{' '}
            {message.replies
              .map(reply => reply.ts)
              .toSorted()
              .map(ts => toDate(ts))
              .at(-1)
              ?.toLocaleString()}
          </span>
        </>
      );
    }

    return '';
  }, [getUserById, message.replies]);
  const threadSearchValue = useSearch({
    from: '__root__',
    select: ({ threadTs }) => threadTs,
  });
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
  const search = useSearch({ strict: false });

  return (
    <div
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
          {hasFiles && (
            <FilesRenderer files={message.files ?? []} chatId={chatId} />
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
          {hasReplies && !threadPanel && (
            <div className="thread-indicator">
              <Link
                to="."
                search={{
                  ...search,
                  threadTs:
                    threadSearchValue !== message.ts ? message.ts : undefined,
                }}
                className="thread-indicator-link"
                underline="none"
              >
                {replyCountText}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
