import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_PNL_SETTINGS } from '../utils/pnlCalculations';

const AppContext = createContext();

// Initial state
const initialState = {
  isAuthenticated: sessionStorage.getItem('isAuthenticated') === 'true',
  menuItems: [],
  orderItems: [],
  tables: [],
  expenseCategories: [],
  pnlSettings: DEFAULT_PNL_SETTINGS,
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
    case 'SET_ORDER_ITEMS':
      return { ...state, orderItems: action.payload };
    case 'SET_TABLES':
      return { ...state, tables: action.payload };
    case 'SET_EXPENSE_CATEGORIES':
      return { ...state, expenseCategories: action.payload };
    case 'SET_PNL_SETTINGS':
      return { ...state, pnlSettings: action.payload };
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

  // Load order items from Firestore
  useEffect(() => {
    if (state.isAuthenticated) {
      const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        dispatch({ type: 'SET_ORDER_ITEMS', payload: items });
      }, (error) => {
        console.error('Error loading order items:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Lỗi tải danh sách món đặt hàng' });
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated]);

  // Load tables from Firestore
  useEffect(() => {
    if (state.isAuthenticated) {
      const q = query(collection(db, 'tables'), orderBy('number'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tables = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        dispatch({ type: 'SET_TABLES', payload: tables });
      }, (error) => {
        console.error('Error loading tables:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Lỗi tải danh sách bàn' });
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated]);

  // Load expense categories (cho module Quản lý vốn & P&L)
  useEffect(() => {
    if (state.isAuthenticated) {
      const q = query(collection(db, 'expenseCategories'), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        dispatch({ type: 'SET_EXPENSE_CATEGORIES', payload: items });
      }, (error) => {
        console.error('Error loading expense categories:', error);
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated]);

  // Load P&L settings (single doc: pnlSettings/default)
  useEffect(() => {
    if (state.isAuthenticated) {
      const ref = doc(db, 'pnlSettings', 'default');
      const unsubscribe = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          dispatch({
            type: 'SET_PNL_SETTINGS',
            payload: { ...DEFAULT_PNL_SETTINGS, ...snap.data() }
          });
        } else {
          dispatch({ type: 'SET_PNL_SETTINGS', payload: DEFAULT_PNL_SETTINGS });
        }
      }, (error) => {
        console.error('Error loading P&L settings:', error);
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