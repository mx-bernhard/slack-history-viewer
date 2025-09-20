import type { SlackMessage } from '../types.js';

export const canCombineMessages = (
  message1: SlackMessage,
  message2: SlackMessage
) => {
  return (
    message1.user === message2.user &&
    Math.abs(parseFloat(message1.ts) - parseFloat(message2.ts)) < 60
  );
};
