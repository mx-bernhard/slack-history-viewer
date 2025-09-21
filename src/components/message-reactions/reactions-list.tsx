import type { SlackReaction } from '../../types';
import { ReactionRenderer } from './reaction-renderer';

export const ReactionsList = ({
  reactions,
}: {
  reactions: SlackReaction[];
}) => {
  if (reactions.length === 0) {
    return null;
  }
  return (
    <div className="reactions-container">
      {reactions.map(reaction => (
        <ReactionRenderer
          key={`${reaction.name}-${String(reaction.count)}`}
          reaction={reaction}
        />
      ))}
    </div>
  );
};
