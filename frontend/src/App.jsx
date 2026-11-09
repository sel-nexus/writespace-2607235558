/** Wire completed discovery, account and protected reading routes. */
import { Route, Routes } from 'react-router-dom';
import LandingPage from './pages/public/LandingPage.jsx';
import NotFound from './pages/public/NotFound.jsx';
import LoginPage from './pages/accounts/LoginPage.jsx';
import RegisterPage from './pages/accounts/RegisterPage.jsx';
import Home from './pages/blogs/Home.jsx';
import ReadBlog from './pages/blogs/ReadBlog.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

/** Compose only completed route pages under the existing single router. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<ProtectedRoute guestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/blogs" element={<Home />} />
        <Route path="/blog/:id" element={<ReadBlog />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
