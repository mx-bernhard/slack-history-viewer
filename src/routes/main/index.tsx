import { createFileRoute } from '@tanstack/react-router';
import { Chats } from '../-chats';
import { Messages } from '../-messages';

export const Route = createFileRoute('/main/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { threadTs } = Route.useSearch({
    select: ({ threadTs }) => ({
      threadTs,
    }),
  });
  return (
    <>
      <Chats selectedChatId={null} searchResults={[]} />
      <Messages
        selectedChatId={null}
        threadTs={threadTs ?? null}
        scrollToMessageIndex={null}
      />
    </>
  );
}
