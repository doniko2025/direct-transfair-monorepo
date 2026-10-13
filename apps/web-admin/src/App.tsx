// src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/Guards';
import { MODULE_ROUTES } from './modules';
import { BASE_PATH } from './config';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import SsoPage from './pages/SsoPage';
import { AuthProvider } from './providers/AuthProvider';
import { TenantProvider } from './providers/TenantProvider';

export default function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <BrowserRouter basename={BASE_PATH || undefined}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sso" element={<SsoPage />} />

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
