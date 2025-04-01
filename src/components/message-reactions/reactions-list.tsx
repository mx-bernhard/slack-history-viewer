import { SlackReaction } from '../../types.js';
import { ReactionRenderer } from './reaction-renderer.js';

// Component to render the list of reactions for a message
export const ReactionsList = ({
  reactions,
}: {
  reactions: SlackReaction[];
}) => {
  // Check array length directly, as the array itself is always truthy
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="reactions-container">
      {reactions.map(reaction => (
        // Convert count to string for the key
        <ReactionRenderer
          key={`${reaction.name}-${String(reaction.count)}`}
          reaction={reaction}
        />
      ))}
    </div>
  );
};
