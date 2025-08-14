import { CSSProperties } from 'react';
import './skeleton.css';
import classNames from 'classnames';

export const Skeleton = ({
  style,
  className,
}: {
  className?: string;
  style?: CSSProperties;
}) => <div className={classNames(className, 'skeleton')} style={style} />;
