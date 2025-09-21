import type { ChatInfo, SlackUser } from '../types';
import Grid3x3Icon from '@mui/icons-material/Grid3x3';

import './get-avatar-and-title.css';

const GroupAvatar = () => (
  <div className="chat-avatar group-avatar">
    <Grid3x3Icon />
  </div>
);

export const getAvatarAndTitleForUserId = (
  userId: string,
  fallbackName: string,
  getUserById: (userId: string) => SlackUser | undefined
) => {
  const user = getUserById(userId);
  const userDisplayName = [
    user?.profile.display_name,
    user?.name,
    'User',
  ].flatMap(name => (name != null && name.trim().length > 0 ? [name] : []))[0];
  const avatarUrl = user?.profile.image_72;

  if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
    return {
      title: userDisplayName,
      element: (
        <img
          src={avatarUrl}
          alt={`${String(userDisplayName)} avatar`}
          className="chat-avatar user-avatar"
        />
      ),
    };
  } else {
    return {
      title: fallbackName,
      element: (
        <div className="chat-avatar">
          {(String(userDisplayName) || '?').charAt(0).toUpperCase()}
        </div>
      ),
    };
  }
};

export const getAvatarAndTitle = (
  chat: ChatInfo,
  getUserById: (userId: string) => SlackUser | undefined
) => {
  const title = chat.name;

  if (chat.type === 'dm' && chat.otherMemberIds?.length === 1) {
    const otherUserId = chat.otherMemberIds[0];
    if (otherUserId != null) {
      return getAvatarAndTitleForUserId(otherUserId, title, getUserById);
    }
  }
  return {
    title: title,
    element: <GroupAvatar />,
  };
};
