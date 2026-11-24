import './index.css';

import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RouteGuard } from './components/RouteGuard';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import ItemForm from './pages/ItemForm';
import ItemDetail from './pages/ItemDetail';
import Movements from './pages/Movements';
import MovementForm from './pages/MovementForm';
import Locations from './pages/Locations';
import Suppliers from './pages/Suppliers';
import AdminUserManagement from './pages/AdminUserManagement';
import Login from './pages/Login';
import StaffProfile from './pages/StaffProfile';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
          <div className="card max-w-lg w-full text-center space-y-4">
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-slate-400 break-words">{this.state.error}</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center space-y-4">
        <p className="text-5xl font-bold text-slate-700">404</p>
        <h1 className="text-xl font-bold">Page not found</h1>
        <Link to="/" className="btn-primary inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RouteGuard roles={['staff', 'admin']} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/items', element: <Items /> },
          { path: '/items/new', element: <ItemForm /> },
          { path: '/items/edit/:id', element: <ItemForm /> },
          { path: '/items/:id', element: <ItemDetail /> },
          { path: '/movements', element: <Movements /> },
          { path: '/movements/new', element: <MovementForm /> },
          { path: '/locations', element: <Locations /> },
          { path: '/suppliers', element: <Suppliers /> },
          { path: '/profile', element: <StaffProfile /> },
          {
            element: <RouteGuard roles={['admin']} />,
            children: [{ path: '/admin/users', element: <AdminUserManagement /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </ErrorBoundary>
);
