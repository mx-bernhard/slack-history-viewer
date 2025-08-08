import {
  createContext,
  useContext,
  ReactNode,
  FC,
  useMemo,
  useCallback,
} from 'react';
import { useUsersQuery } from '../api/use-queries';
import { SlackUser } from '../types';

interface UserContextType {
  users: Map<string, SlackUser>;
  loading: boolean;
  error: string | null;
  getUserById: (userId: string) => SlackUser | undefined;
}

const UserContext = createContext<UserContextType | null>(null);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: FC<UserProviderProps> = ({ children }) => {
  const { data: usersList = [], isLoading, error } = useUsersQuery();

  const users = useMemo(
    () => new Map(usersList.map(user => [user.id, user])),
    [usersList]
  );

  const getUserById = useCallback(
    (userId: string): SlackUser | undefined => {
      return users.get(userId);
    },
    [users]
  );

  const value = useMemo(
    () => ({
      users,
      loading: isLoading,
      error: error instanceof Error ? error.message : null,
      getUserById,
    }),
    [error, getUserById, isLoading, users]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUsers = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};
