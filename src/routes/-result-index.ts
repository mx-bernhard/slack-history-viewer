export const routerToInternalResultIndex = (resultIndex: number | undefined) =>
  resultIndex != null ? resultIndex - 1 : resultIndex;

export const internalToRouterResultIndex = (resultIndex: number | undefined) =>
  resultIndex != null ? resultIndex + 1 : resultIndex;
