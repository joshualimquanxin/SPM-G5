import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth, RequirePermission } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { VenueFormPage } from './venues/VenueFormPage'
import { VenueManagePage } from './venues/VenueManagePage'
import './App.css'

/**
 * Route map. Add a feature's routes under the guard that matches its permission - see
 * backend/app/auth/permissions.py for the codes. Pages inside <RequireAuth> render within
 * <AppLayout> (header + navigation).
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route element={<RequirePermission permission="venues:manage" />}>
                <Route path="/venues/manage" element={<VenueManagePage />} />
                <Route path="/venues/new" element={<VenueFormPage />} />
                <Route path="/venues/:id/edit" element={<VenueFormPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
