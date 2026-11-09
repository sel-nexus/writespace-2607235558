/** Wire only completed discovery routes; unknown destinations remain honest. */
import { Route, Routes } from 'react-router-dom';
import LandingPage from './pages/public/LandingPage.jsx';
import NotFound from './pages/public/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
