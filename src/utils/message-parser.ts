import { SlackUser } from '../types';

type GetUserByIdFn = (userId: string) => SlackUser | undefined;

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

  processedText = processedText.replace(
    /<@([A-Z0-9]+)>/g,
    (_, userId: string) => {
      const user = getUserById(userId);
      const userName = user?.profile.display_name ?? user?.name ?? userId;
      return `@${userName}`;
    }
  );

  processedText = parseEmoji(processedText);

  return processedText;
};
