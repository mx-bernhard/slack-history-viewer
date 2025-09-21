import { createFileRoute } from '@tanstack/react-router';
import { Chats } from '../-chats';
import { Messages } from '../-messages';

export const Route = createFileRoute('/main/$chatId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { chatId } = Route.useParams();
  const { threadTs } = Route.useSearch({
    select: ({ threadTs }) => ({
      threadTs,
    }),
  });
  return (
    <>
      <Chats selectedChatId={chatId} searchResults={[]} />
      <Messages
        selectedChatId={chatId}
        threadTs={threadTs ?? null}
        scrollToMessageIndex={null}
      />
    </>
  );
}
