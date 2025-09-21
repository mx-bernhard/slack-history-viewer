import { MessageView } from '../components/message-view';

export const Messages = ({
  selectedChatId,
  scrollToMessageIndex,
  threadTs,
}: {
  scrollToMessageIndex: number | null;
  selectedChatId: string | null;
  threadTs: string | null;
}) => {
  return (
    <div className="content-view">
      <MessageView
        scrollToMessageIndex={scrollToMessageIndex}
        threadTs={threadTs}
        chatId={selectedChatId}
      />
    </div>
  );
};
