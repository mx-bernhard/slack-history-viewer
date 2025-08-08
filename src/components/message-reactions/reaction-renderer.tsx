import { useUsers } from '../../contexts/user-context';
import { SlackReaction } from '../../types';

import { emojiImageMap } from '../emoji-map';

export const ReactionRenderer = ({ reaction }: { reaction: SlackReaction }) => {
  const { getUserById } = useUsers();

  const userNames = reaction.users
    .map(userId => {
      const user = getUserById(userId);

      return (
        user?.profile.display_name ??
        user?.name ??
        user?.profile.real_name ??
        'Unknown User'
      );
    })
    .join(', ');

  const mapKey = `:${reaction.name}:`;
  const imagePath = emojiImageMap[mapKey];
  const tooltipText = `${userNames} reacted with :${reaction.name}:`;

  return (
    <div className="reaction-item" title={tooltipText}>
      <span className="reaction-emoji">
        {typeof imagePath === 'string' && imagePath.length > 0 ? (
          <img
            src={imagePath}
            alt={reaction.name}
            className="emoji-image-reaction"
          />
        ) : (
          `:${reaction.name}:`
        )}
      </span>
      <span className="reaction-count">{reaction.count}</span>
    </div>
  );
};
