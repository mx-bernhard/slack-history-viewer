import { SlackUser } from '../types';

// Type for the function provided by UserContext to look up users
type GetUserByIdFn = (userId: string) => SlackUser | undefined;

// Type for the function provided by EmojiContext to parse emoji codes
type ParseEmojiFn = (text: string) => string;

/**
 * Parses Slack message text to replace mentions, emoji, and potentially basic markdown.
 *
 * @param text The raw message text.
 * @param getUserById Function to look up user details by ID.
 * @param parseEmoji Function to replace emoji codes with unicode characters.
 * @returns The parsed text, potentially as JSX elements for richer formatting.
 */
export const parseSlackMessage = (
  text: string | undefined,
  getUserById: GetUserByIdFn,
  parseEmoji: ParseEmojiFn
): string => {
  if (text == null) return '';

  let processedText = text;

  // 1. Replace user mentions (<@U12345678>)
  processedText = processedText.replace(
    /<@([A-Z0-9]+)>/g,
    (_, userId: string) => {
      const user = getUserById(userId);
      const userName = user?.profile.display_name ?? user?.name ?? userId;
      // For now, just return the @mention text, maybe link later?
      return `@${String(userName)}`;
    }
  );

  // 2. Replace emoji using the provided function
  processedText = parseEmoji(processedText);

  // TODO: Implement basic markdown (bold, italic, strike, code)
  // TODO: Implement channel links (<#C12345678>)

  // For now, return the processed string. Later, we might return JSX.
  return processedText;
};
