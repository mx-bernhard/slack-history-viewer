export const isNotEmpty = <T>(value: null | undefined | T[]): value is T[] => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return false;
};

export const isNotEmptyString = (
  value: null | undefined | string
): value is string => {
  if (value == null) return false;
  if (typeof value === 'string') return value.length > 0;
  return false;
};
