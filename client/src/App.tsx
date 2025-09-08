import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SnackbarProvider } from 'notistack';
import { HelmetProvider } from 'react-helmet-async';

import { ThemeContextProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { SocketProvider } from './contexts/SocketContext.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { Layout } from './components/layout/Layout.tsx';

// Pages
import { LoginPage } from './pages/auth/LoginPage.tsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { TasksPage } from './pages/tasks/TasksPage.tsx';
import { WorkflowsPage } from './pages/workflows/WorkflowsPage.tsx';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage.tsx';
import { IntegrationsPage } from './pages/integrations/IntegrationsPage.tsx';
import { SettingsPage } from './pages/settings/SettingsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeContextProvider>
            <CssBaseline />
            <SnackbarProvider 
              maxSnack={3}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <SocketProvider>
                <Router>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Protected routes */}
                    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="tasks" element={<TasksPage />} />
                      <Route path="workflows" element={<WorkflowsPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="integrations" element={<IntegrationsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                    </Route>
                    
                    {/* 404 page */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Router>
              </SocketProvider>
            </SnackbarProvider>
          </ThemeContextProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
