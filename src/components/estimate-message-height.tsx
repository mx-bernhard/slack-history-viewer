import { SlackMessage } from '../types';
import { isNotEmptyString } from '../utils/is-not-empty';

// Function to estimate message height - pure function outside component

export const estimateMessageHeight = (
  message: SlackMessage | undefined,
  width: number
): number => {
  if (!message) return 50;

  const baseHeight = 36;
  const padding = 16;
  const headerHeight = 20;
  const lineHeight = 24;
  const charsPerLine = ((width === 0 ? 40 : width) / 913) * 121;
  const extraBuffer = 5;

  // Estimate text height
  const textLines = Math.ceil((message.text?.length ?? 0) / charsPerLine) || 1;
  const textHeight = textLines * lineHeight;

  // Add extra height for attachments if present
  let attachmentHeight = 0;
  if (message.attachments && message.attachments.length > 0) {
    // For each attachment, estimate height
    message.attachments.forEach(attachment => {
      // Check if this is a service unfurl (like YouTube)
      const isServiceUnfurl = Boolean(attachment.service_name);

      if (isServiceUnfurl) {
        // Service unfurls with images (like YouTube) have a more predictable layout
        attachmentHeight += 300; // Default height for the image
        attachmentHeight += 30; // Service header
        attachmentHeight += 30; // Title space
      } else {
        // Base attachment height
        let height = 40; // Base container padding + margins

        // Add height for title and text if present
        if (isNotEmptyString(attachment.title)) height += 22;
        if (isNotEmptyString(attachment.text)) {
          const textLines =
            Math.ceil((attachment.text.length || 0) / charsPerLine) || 1;
          height += textLines * lineHeight;
        }

        // Add height for image if present (estimate or use max cap)
        if (attachment.image_url != null) {
          height += 300; // Max image height as defined in CSS
        }

        attachmentHeight += height;
      }
    });
  }

  // Add height for thread indicator if message has replies
  const threadIndicatorHeight = (message.reply_count ?? 0) > 0 ? 24 : 0;

  const calculatedHeight =
    Math.max(baseHeight + padding, headerHeight + textHeight + padding) +
    attachmentHeight +
    threadIndicatorHeight;

  return calculatedHeight + extraBuffer;
};
