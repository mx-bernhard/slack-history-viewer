import type { LinkProps } from '@mui/material';
import MuiLink from '@mui/material/Link';
import type { LinkComponent } from '@tanstack/react-router';
import { createLink } from '@tanstack/react-router';
import { forwardRef } from 'react';

interface MUILinkProps extends LinkProps {
  className?: string;
}

const MUILinkComponent = forwardRef<HTMLAnchorElement, MUILinkProps>(
  function MUILinkComponent(props, ref) {
    return <MuiLink ref={ref} {...props} />;
  }
);

const CreatedLinkComponent = createLink(MUILinkComponent);

export const Link: LinkComponent<typeof MUILinkComponent> = props => {
  return (
    <CreatedLinkComponent preload={'intent'} underline="none" {...props} />
  );
};
