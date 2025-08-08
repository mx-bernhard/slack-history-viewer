import { SlackMessage } from '../types';
import { isNotEmptyString } from '../utils/is-not-empty';

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

  const textLines = Math.ceil((message.text?.length ?? 0) / charsPerLine) || 1;
  const textHeight = textLines * lineHeight;

  let attachmentHeight = 0;
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach(attachment => {
      const isServiceUnfurl = Boolean(attachment.service_name);

      if (isServiceUnfurl) {
        attachmentHeight += 300;
        attachmentHeight += 30;
        attachmentHeight += 30;
      } else {
        let height = 40;

        if (isNotEmptyString(attachment.title)) height += 22;
        if (isNotEmptyString(attachment.text)) {
          const textLines =
            Math.ceil((attachment.text.length || 0) / charsPerLine) || 1;
          height += textLines * lineHeight;
        }

        if (attachment.image_url != null) {
          height += 300;
        }

        attachmentHeight += height;
      }
    });
  }

  const threadIndicatorHeight = (message.reply_count ?? 0) > 0 ? 24 : 0;

  const calculatedHeight =
    Math.max(baseHeight + padding, headerHeight + textHeight + padding) +
    attachmentHeight +
    threadIndicatorHeight;

  return calculatedHeight + extraBuffer;
};
