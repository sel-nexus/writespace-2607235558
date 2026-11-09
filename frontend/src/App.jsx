/** Wire completed public and guest account routes; leave future homes untouched. */
import { Route, Routes } from 'react-router-dom';
import LandingPage from './pages/public/LandingPage.jsx';
import NotFound from './pages/public/NotFound.jsx';
import LoginPage from './pages/accounts/LoginPage.jsx';
import RegisterPage from './pages/accounts/RegisterPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<ProtectedRoute guestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
