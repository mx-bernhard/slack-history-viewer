import classNames from 'classnames';
import { Skeleton } from './skeleton.js';
import './message-row-skeleton.css';

export const MessageRowSkeleton = () => {
  return (
    <div className="skeleton-root">
      <Skeleton className={classNames('fill', 'skeleton-avatar')} />
      <Skeleton className={classNames('fill', 'skeleton-message')} />
    </div>
  );
};
