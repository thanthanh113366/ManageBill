import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

const AppContext = createContext();

// Initial state
const initialState = {
  isAuthenticated: sessionStorage.getItem('isAuthenticated') === 'true',
  menuItems: [],
  tables: [],
  loading: false,
  error: null
};

// Reducer
const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_MENU_ITEMS':
      return { ...state, menuItems: action.payload };
    case 'SET_TABLES':
      return { ...state, tables: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

// Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load menu items from Firestore
  useEffect(() => {
    if (state.isAuthenticated) {
      const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        dispatch({ type: 'SET_MENU_ITEMS', payload: items });
      }, (error) => {
        console.error('Error loading menu items:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Lỗi tải danh sách món ăn' });
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated]);

  // Load tables from Firestore
  useEffect(() => {
    if (state.isAuthenticated) {
      const q = query(collection(db, 'tables'), orderBy('number'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tables = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        dispatch({ type: 'SET_TABLES', payload: tables });
      }, (error) => {
        console.error('Error loading tables:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Lỗi tải danh sách bàn' });
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated]);

  const login = () => {
    sessionStorage.setItem('isAuthenticated', 'true');
    dispatch({ type: 'SET_AUTHENTICATED', payload: true });
  };

  const logout = () => {
    sessionStorage.removeItem('isAuthenticated');
    dispatch({ type: 'SET_AUTHENTICATED', payload: false });
  };

  const value = {
    ...state,
    dispatch,
    login,
    logout
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 