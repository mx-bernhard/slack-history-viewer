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

// Define the shape of the context data
interface UserContextType {
  users: Map<string, SlackUser>; // Use a Map for efficient lookup by ID
  loading: boolean;
  error: string | null;
  getUserById: (userId: string) => SlackUser | undefined;
}

// Create the context with a default value (or null)
const UserContext = createContext<UserContextType | null>(null);

// Define props for the provider component
interface UserProviderProps {
  children: ReactNode;
}

// Create the provider component
export const UserProvider: FC<UserProviderProps> = ({ children }) => {
  const { data: usersList = [], isLoading, error } = useUsersQuery();

  // Convert the array to a Map for quick ID lookups
  const users = useMemo(
    () => new Map(usersList.map(user => [user.id, user])),
    [usersList]
  );

  // Function to get a user by ID from the map
  const getUserById = useCallback(
    (userId: string): SlackUser | undefined => {
      return users.get(userId);
    },
    [users]
  );

  // Value object provided by the context
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

// Custom hook to easily consume the UserContext
export const useUsers = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};
