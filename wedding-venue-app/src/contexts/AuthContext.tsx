import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { getUsers, setUsers } from '../hooks/useLayoutState';
import {
  canUserAuthenticate,
  clearFailedLoginState,
  clearSession,
  createPasswordRecord,
  createSession,
  isSessionValidForUser,
  isUserLocked,
  loadSession,
  needsPasswordMigration,
  recordFailedLogin,
  saveSession,
  verifyPassword,
} from '../utils/auth';
import {
  restoreSupabaseSession,
  shouldUseSupabaseAuth,
  signInWithSupabase,
  signOutSupabase,
} from '../services/backend/AuthBackend';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isBasicUser: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  continueAsGuest: () => void;
  createUser: (
    username: string,
    password: string,
    name: string,
    role: UserRole,
    email?: string,
  ) => Promise<boolean>;
  updateUser: (userId: string, updates: Partial<User>) => boolean;
  deleteUser: (userId: string) => boolean;
  getAllUsers: () => User[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

function buildGuestUser(): User {
  return {
    id: 'guest',
    username: 'guest',
    email: 'guest@example.local',
    password: '',
    role: 'guest',
    name: 'Guest User',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (shouldUseSupabaseAuth()) {
      void restoreSupabaseSession()
        .then((session) => {
          if (session?.user) {
            setUser(session.user);
          } else {
            clearSession();
          }
        })
        .finally(() => setInitialized(true));
      return;
    }

    const savedSession = loadSession();

    if (!savedSession) {
      clearSession();
      setInitialized(true);
      return;
    }

    if (savedSession.isGuest) {
      const guestUser = buildGuestUser();
      setUser(guestUser);
      saveSession(createSession(guestUser as any, true));
      setInitialized(true);
      return;
    }

    const users = getUsers();
    const foundUser = users.find((u) => u.id === savedSession.userId);

    if (!foundUser || !isSessionValidForUser(savedSession, foundUser as any)) {
      clearSession();
      setInitialized(true);
      return;
    }

    setUser(foundUser);
    saveSession(createSession(foundUser as any, false));
    setInitialized(true);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (shouldUseSupabaseAuth()) {
      const session = await signInWithSupabase(username, password);
      if (!session) return false;
      setUser(session.user);
      return true;
    }

    const users = getUsers();

    const foundUser = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );

    if (!foundUser) {
      return false;
    }

    if (!canUserAuthenticate(foundUser as any) || isUserLocked(foundUser as any)) {
      return false;
    }

    const success = await verifyPassword(foundUser as any, password);
    if (!success) {
      const updatedUsers = users.map((u) =>
        u.id === foundUser.id ? (recordFailedLogin(u as any) as User) : u,
      );
      setUsers(updatedUsers);
      return false;
    }

    const migratedPasswordRecord = needsPasswordMigration(foundUser as any)
      ? await createPasswordRecord(password)
      : null;

    const updatedUsers = users.map((u) => {
      if (u.id !== foundUser.id) return u;

      const cleared = clearFailedLoginState(u as any) as User;
      if (!migratedPasswordRecord) return cleared;

      return {
        ...cleared,
        password: '',
        ...(migratedPasswordRecord as any),
        sessionVersion: ((cleared as any).sessionVersion ?? 1) + 1,
      } as User;
    });
    setUsers(updatedUsers);

    const authenticatedUser =
      updatedUsers.find((u) => u.id === foundUser.id) || foundUser;

    setUser(authenticatedUser);
    saveSession(createSession(authenticatedUser as any, false));
    return true;
  };

  const logout = () => {
    setUser(null);
    clearSession();
    if (shouldUseSupabaseAuth()) {
      void signOutSupabase();
    }
  };

  const continueAsGuest = () => {
    const guestUser = buildGuestUser();
    setUser(guestUser);
    saveSession(createSession(guestUser as any, true));
  };

  const createUser = async (
    username: string,
    password: string,
    name: string,
    role: UserRole,
    email?: string,
  ): Promise<boolean> => {
    const users = getUsers();

    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return false;
    }

    const passwordRecord = await createPasswordRecord(password);

    const newUser: User = {
      id: `user-${Date.now()}`,
      username,
      email: email || username,
      password: '',
      role,
      name,
      contactPhoneNumber: '',
      phoneType: 'Mobile',
      preferredCommunication: [],
      eventRole: '',
      eventName: '',
      userRole: 'shared',
      isMasterUser: false,
      parentUserId: undefined,
      allowSharedAccess: false,
      sharedUserLimit: 0,
      userStatus: 'active',
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: user?.id,
      ...(passwordRecord as any),
      sessionVersion: 1,
    };

    setUsers([...users, newUser]);
    return true;
  };

  const updateUser = (userId: string, updates: Partial<User>): boolean => {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) return false;

    if (updates.role && updates.role !== 'admin') {
      const admins = users.filter((u) => u.role === 'admin');
      if (admins.length === 1 && admins[0].id === userId) {
        return false;
      }
    }

    const shouldBumpSessionVersion =
      updates.password !== undefined ||
      (updates as any).passwordHash !== undefined ||
      (updates as any).passwordSalt !== undefined ||
      updates.userStatus !== undefined ||
      updates.isActive !== undefined;

    const currentVersion = ((users[index] as any).sessionVersion ?? 1) as number;

    users[index] = {
      ...users[index],
      ...updates,
      ...(shouldBumpSessionVersion
        ? { sessionVersion: currentVersion + 1 }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    setUsers(users);

    if (user?.id === userId) {
      setUser(users[index]);
    }

    return true;
  };

  const deleteUser = (userId: string): boolean => {
    const users = getUsers();

    const admins = users.filter((u) => u.role === 'admin');
    const userToDelete = users.find((u) => u.id === userId);

    if (userToDelete?.role === 'admin' && admins.length === 1) {
      return false;
    }

    if (user?.id === userId) {
      return false;
    }

    setUsers(users.filter((u) => u.id !== userId));
    return true;
  };

  const getAllUsers = (): User[] => {
    return getUsers();
  };

  const isAdmin = user?.role === 'admin';
  const isBasicUser = user?.role === 'basic';
  const isGuest = user?.role === 'guest';

  if (!initialized) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isBasicUser,
        isGuest,
        login,
        logout,
        continueAsGuest,
        createUser,
        updateUser,
        deleteUser,
        getAllUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}