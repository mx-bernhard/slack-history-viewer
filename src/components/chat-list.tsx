import { useLocalStorage } from '@uidotdev/usehooks';
import { useChatsQuery } from '../api/use-queries';
import { useStore } from '../store';
import { ChatInfo } from '../types';
import { useUsers } from '../contexts/user-context';
import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { entries, groupBy, isArray, uniq, values } from 'lodash-es';

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
}: {
  chat: ChatInfo;
  avatarTitle: string;
  avatarElement: ReactNode;
}) => {
  const { selectedChatId, setSelectedChatId } = useStore(
    ({ selectedChatId, actions: { setSelectedChatId } }) => ({
      selectedChatId,
      setSelectedChatId,
    })
  );
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (ref.current && chat.id === selectedChatId) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ref, chat.id, selectedChatId]);
  return (
    <li
      ref={ref}
      key={chat.id}
      className={`chat-list-item ${
        chat.id === selectedChatId ? 'selected' : ''
      }`}
      onClick={() => {
        setSelectedChatId(chat.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') setSelectedChatId(chat.id);
      }}
      title={avatarTitle}
    >
      {avatarElement}
      <span className="chat-name">
        {chat.name}
        {chat.isArchived ? ' [Archived]' : ''}
      </span>
    </li>
  );
};

const ChatList = () => {
  const { data: chats = [], isLoading, error } = useChatsQuery();
  const { getUserById } = useUsers();
  const [savedExpandedItems, saveExpandedItems] = useLocalStorage(
    'chat-tree-open',
    values(groupMapping)
  );
  const { searchResultChatIds } = useStore(
    ({ searchResults, searchQuery }) => ({
      searchResultChatIds:
        isArray(searchResults) && searchQuery.trim().length > 0
          ? uniq(searchResults.map(searchResult => searchResult.chatId))
          : null,
    }),
    'deep'
  );

  const chatsForSearchResult = useMemo(
    () =>
      searchResultChatIds != null
        ? chats.filter(chat => searchResultChatIds.includes(chat.id))
        : null,
    [chats, searchResultChatIds]
  );

  const groupedChats = useMemo(
    () => groupBy(chatsForSearchResult ?? chats, chat => chat.type),
    [chats, chatsForSearchResult]
  );

  const expandedItems = useMemo(
    () =>
      chatsForSearchResult != null
        ? uniq(chatsForSearchResult.map(chat => chat.type))
        : savedExpandedItems,
    [chatsForSearchResult, savedExpandedItems]
  );

  const handleExpandedItemsChange = useCallback(
    (_: React.SyntheticEvent | null, itemIds: string[]) => {
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
  const GroupAvatar = () => <div className="chat-avatar group-avatar">👥</div>;

  return (
    <div className="chat-list-container">
      <h2>Chats</h2>
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
                    const { avatarElement, avatarTitle } = (() => {
                      const avatarTitle = chat.name;

                      if (
                        chat.type === 'dm' &&
                        chat.otherMemberIds?.length === 1
                      ) {
                        const otherUserId = chat.otherMemberIds[0];
                        const user =
                          otherUserId != null ? getUserById(otherUserId) : null;
                        const userDisplayName =
                          user?.profile.display_name ?? user?.name ?? 'User';
                        const avatarUrl = user?.profile.image_72;

                        if (
                          typeof avatarUrl === 'string' &&
                          avatarUrl.length > 0
                        ) {
                          return {
                            avatarTitle: userDisplayName,
                            avatarElement: (
                              <img
                                src={avatarUrl}
                                alt={`${userDisplayName} avatar`}
                                className="chat-avatar user-avatar"
                              />
                            ),
                          };
                        } else {
                          return {
                            avatarTitle,
                            avatarElement: (
                              <div className="chat-avatar user-avatar-placeholder">
                                {(userDisplayName || '?')
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            ),
                          };
                        }
                      }
                      return {
                        avatarTitle,
                        avatarElement: <GroupAvatar />,
                      };
                    })();

                    return (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        avatarElement={avatarElement}
                        avatarTitle={avatarTitle}
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

export default ChatList;
