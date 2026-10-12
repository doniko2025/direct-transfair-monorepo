// src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/Guards';
import { MODULE_ROUTES } from './modules';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider } from './providers/AuthProvider';
import { TenantProvider } from './providers/TenantProvider';

export default function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                {MODULE_ROUTES.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={<RequireRole roles={route.roles}>{route.element}</RequireRole>}
                  />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TenantProvider>
  );
}
