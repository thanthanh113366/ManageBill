import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AppProvider, useApp } from './context/AppContext';
import { initVoiceOrderMetrics } from './utils/voiceOrderMetrics';

import './index.css';

const Layout = lazy(() => import('./components/Layout'));
const PasswordGate = lazy(() => import('./components/PasswordGate'));
const CreateBill = lazy(() => import('./pages/CreateBill'));
const MenuManagement = lazy(() => import('./pages/MenuManagement'));
const BillManagement = lazy(() => import('./pages/BillManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const DishAnalysis = lazy(() => import('./pages/DishAnalysis'));
const QRCodeManager = lazy(() => import('./pages/QRCodeManager'));
const PublicBill = lazy(() => import('./pages/PublicBill'));
const CustomerOrder = lazy(() => import('./pages/CustomerOrder'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const TakeawayOrder = lazy(() => import('./pages/TakeawayOrder'));
const DailyExpenses = lazy(() => import('./pages/DailyExpenses'));
const MonthlyFixedCosts = lazy(() => import('./pages/MonthlyFixedCosts'));
const ExpenseCategories = lazy(() => import('./pages/ExpenseCategories'));

// Init OTLP metrics nếu có env (fire-and-forget)
initVoiceOrderMetrics().catch(() => {});

// Public Routes (không cần authentication)
const PublicRoutes = () => {
  return (
    <Routes>
      <Route path="/bill/:tableNumber" element={<PublicBill />} />
      <Route path="/order/:tableNumber" element={<CustomerOrder />} />
      <Route path="/order-success/:tableNumber" element={<OrderSuccess />} />
      <Route path="/takeaway" element={<TakeawayOrder />} />
    </Routes>
  );
};

// Protected Routes (cần authentication)
const ProtectedRoutes = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <PasswordGate />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CreateBill />} />
        <Route path="/menu" element={<MenuManagement />} />
        <Route path="/bills" element={<BillManagement />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/dish-analysis" element={<DishAnalysis />} />
        <Route path="/expenses" element={<DailyExpenses />} />
        <Route path="/fixed-costs" element={<MonthlyFixedCosts />} />
        <Route path="/expense-categories" element={<ExpenseCategories />} />
        <Route path="/qr" element={<QRCodeManager />} />
      </Routes>
    </Layout>
  );
};

// Main App component with route handling
const App = () => {
  const currentPath = window.location.pathname;
  
  // Check if current path is a public route
  if (currentPath.startsWith('/bill/') || 
      currentPath.startsWith('/order') ||
      currentPath.startsWith('/takeaway')) {
    return <PublicRoutes />;
  }

  // Otherwise, render protected routes
  return <ProtectedRoutes />;
};

// Root component with providers
const Root = () => {
  return (
    <Router>
      <AppProvider>
        <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
          <App />
        </Suspense>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </AppProvider>
    </Router>
  );
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
