import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ScreenTest from './pages/ScreenTest';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/screen-test" element={<ScreenTest />} />
      </Routes>
    </Router>
  );
}

export default App;