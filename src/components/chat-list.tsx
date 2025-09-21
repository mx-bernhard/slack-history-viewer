import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { useLocalStorage } from '@uidotdev/usehooks';
import classNames from 'classnames';
import { entries, groupBy, uniq, values } from 'lodash-es';
import type { ReactNode, SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChatsQuery } from '../api/use-queries';
import { useUsers } from '../contexts/user-context';
import type { ChatInfo } from '../types';
import { Link } from './link';
import { getAvatarAndTitle } from './get-avatar-and-title';

import './chat-list.css';
import { useSearch } from '@tanstack/react-router';

const groupMapping: Record<string, string> = {
  dm: 'direct messages',
  channel: 'public channels',
  mpim: 'chats',
  group: 'private channels',
};

const ChatItem = ({
  chat,
  avatarTitle,
  avatarElement,
  isSelected,
  additionalInfo,
}: {
  chat: ChatInfo;
  avatarTitle: ReactNode;
  avatarElement: ReactNode;
  additionalInfo?: ReactNode;
  isSelected: boolean;
}) => {
  const { limit } = useSearch({
    from: '__root__',
    select: ({ limit }) => ({ limit }),
  });
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (ref.current && isSelected) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ref, chat.id, isSelected]);
  return (
    <li
      ref={ref}
      key={chat.id}
      className={classNames('chat-list-item', {
        selected: isSelected,
      })}
      role="button"
      tabIndex={0}
    >
      <Link
        color="inherit"
        underline="none"
        className="chat-list-item-link"
        to="/main/$chatId"
        params={{ chatId: chat.id }}
        search={{ limit }}
      >
        <div>{avatarElement}</div>
        {avatarTitle}
      </Link>
      {additionalInfo}
    </li>
  );
};

export const ChatList = ({
  selectedChatId,
  filterChat,
  additionalChatInfo,
}: {
  selectedChatId: string | null;
  filterChat: null | ((chatId: string) => boolean);
  additionalChatInfo: null | ((chatId: string) => ReactNode);
}) => {
  const { data: chats = [], isLoading, error } = useChatsQuery();
  const { getUserById } = useUsers();
  const [savedExpandedItems, saveExpandedItems] = useLocalStorage(
    'chat-tree-open',
    values(groupMapping)
  );
  const filteredChats = useMemo(
    () => chats.filter(({ id }) => filterChat == null || filterChat(id)),
    [chats, filterChat]
  );

  const groupedChats = useMemo(
    () => groupBy(filteredChats, chat => chat.type),
    [filteredChats]
  );

  const expandedItems = useMemo(
    () =>
      filterChat != null
        ? uniq(filteredChats.map(chat => chat.type))
        : savedExpandedItems,
    [filterChat, filteredChats, savedExpandedItems]
  );

  const handleExpandedItemsChange = useCallback(
    (_: SyntheticEvent | null, itemIds: string[]) => {
      saveExpandedItems(itemIds);
    },
    [saveExpandedItems]
  );

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading chats...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Error:{' '}
        {error instanceof Error ? error.message : 'Failed to load chat list'}
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      <h2 className="chat-list-container-header">Chats</h2>
      {chats.length === 0 ? (
        <p style={{ padding: '20px' }}>No chats found.</p>
      ) : (
        <ul className="chat-list-ul">
          <SimpleTreeView
            expandedItems={expandedItems}
            onExpandedItemsChange={handleExpandedItemsChange}
          >
            {entries(groupedChats).map(([groupKey, chatsOfGroup]) => {
              return (
                <TreeItem
                  key={groupKey}
                  itemId={groupKey}
                  label={groupMapping[groupKey] ?? groupKey}
                >
                  {chatsOfGroup.map((chat: ChatInfo) => {
                    const additionalInfo = additionalChatInfo?.(chat.id) ?? '';
                    const { element, title } = getAvatarAndTitle(
                      chat,
                      getUserById
                    );

                    return (
                      <ChatItem
                        key={chat.id}
                        isSelected={chat.id === selectedChatId}
                        chat={chat}
                        avatarElement={element}
                        avatarTitle={<div className="chat-name">{title}</div>}
                        additionalInfo={
                          <div className="chat-name-additional-info">
                            {additionalInfo}
                          </div>
                        }
                      />
                    );
                  })}
                </TreeItem>
              );
            })}
          </SimpleTreeView>
        </ul>
      )}
    </div>
  );
};
