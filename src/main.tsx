import { hydrateRoot } from 'react-dom/client';
import { Root } from './root';
import { useIsClient } from './components/use-is-client';

const RenderClient = () => {
  const isClient = useIsClient();
  if (isClient) {
    return <Root />;
  }
  return <div />;
};

hydrateRoot(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  document.getElementById('root')!,
  <RenderClient />
);
