import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Home, ShoppingCart, FileText, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useState } from 'react';

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout } = useApp();
  const location = useLocation();

  const navigationItems = [
    { path: '/', label: 'Tạo đơn hàng', icon: Home },
    { path: '/menu', label: 'Quản lý menu', icon: ShoppingCart },
    { path: '/bills', label: 'Quản lý đơn hàng', icon: FileText },
    { path: '/reports', label: 'Báo cáo', icon: BarChart3 }
  ];

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="bg-white shadow-sm border-b lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Quán Ốc</h1>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-b shadow-sm">
          <nav className="px-4 py-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon size={18} className="mr-3" />
                  {item.label}
                </NavLink>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 w-full text-left"
            >
              <LogOut size={18} className="mr-3" />
              Đăng xuất
            </button>
          </nav>
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
              <div className="px-6 py-4 border-b">
                <h1 className="text-xl font-bold text-gray-900">Quán Ốc</h1>
                <p className="text-sm text-gray-600">Quản lý đơn hàng</p>
              </div>
              
              <nav className="flex-1 px-4 py-4 space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                    >
                      <Icon size={18} className="mr-3" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
              
              <div className="px-4 py-4 border-t">
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 w-full text-left"
                >
                  <LogOut size={18} className="mr-3" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main className="p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout; 