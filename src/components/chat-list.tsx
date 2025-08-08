import { useChatsQuery } from '../api/use-queries';
import { useStore } from '../store';
import { ChatInfo } from '../types';
import { useUsers } from '../contexts/user-context';
import { ReactNode, useEffect, useRef } from 'react';

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
        {chat.name} ({chat.type}){chat.isArchived ? ' [Archived]' : ''}
      </span>
    </li>
  );
};

const ChatList = () => {
  const { data: chats = [], isLoading, error } = useChatsQuery();
  const { getUserById } = useUsers();

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
          {chats.map((chat: ChatInfo) => {
            let avatarElement = <GroupAvatar />;
            let avatarTitle = chat.name;

            if (chat.type === 'dm' && chat.otherMemberIds?.length === 1) {
              const otherUserId = chat.otherMemberIds[0];
              const user =
                otherUserId != null ? getUserById(otherUserId) : null;
              const userDisplayName =
                user?.profile.display_name ?? user?.name ?? 'User';
              const displayNameForAvatar = userDisplayName || '?';
              avatarTitle = userDisplayName;
              const avatarUrl = user?.profile.image_72;

              if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
                avatarElement = (
                  <img
                    src={avatarUrl}
                    alt={`${userDisplayName} avatar`}
                    className="chat-avatar user-avatar"
                  />
                );
              } else {
                avatarElement = (
                  <div className="chat-avatar user-avatar-placeholder">
                    {displayNameForAvatar.charAt(0).toUpperCase()}
                  </div>
                );
              }
            }

            return (
              <ChatItem
                key={chat.id}
                chat={chat}
                avatarElement={avatarElement}
                avatarTitle={avatarTitle}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ChatList;
