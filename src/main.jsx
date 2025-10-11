import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import PasswordGate from './components/PasswordGate';
import CreateBill from './pages/CreateBill';
import MenuManagement from './pages/MenuManagement';
import BillManagement from './pages/BillManagement';
import Reports from './pages/Reports';
import DishAnalysis from './pages/DishAnalysis';
import QRCodeManager from './pages/QRCodeManager';
import PublicBill from './pages/PublicBill';
import CustomerOrder from './pages/CustomerOrder';
import OrderSuccess from './pages/OrderSuccess';

import './index.css';

// Public Routes (không cần authentication)
const PublicRoutes = () => {
  return (
    <Routes>
      <Route path="/bill/:tableNumber" element={<PublicBill />} />
      <Route path="/order/:tableNumber" element={<CustomerOrder />} />
      <Route path="/order-success/:tableNumber" element={<OrderSuccess />} />
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
      currentPath.startsWith('/order')) {
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
        <App />
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