import { createFileRoute } from '@tanstack/react-router';
import { Chats } from './-chats';
import { Messages } from './-messages';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Chats selectedChatId={null} searchResults={[]} />
      <Messages
        selectedChatId={null}
        threadTs={null}
        scrollToMessageIndex={null}
      />
    </>
  );
}
