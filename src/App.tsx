import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CounterProvider } from './contexts/CounterContext';
import Layout from './components/Layout/Layout';
import MergePDF from './pages/MergePDF';
import SplitPDF from './pages/SplitPDF';
import CompressPDF from './pages/CompressPDF';
import PDFToWord from './pages/PDFToWord';

function App() {
  return (
    <CounterProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<MergePDF />} />
            <Route path="/merge" element={<MergePDF />} />
            <Route path="/split" element={<SplitPDF />} />
            <Route path="/compress" element={<CompressPDF />} />
            <Route path="/word" element={<PDFToWord />} />
          </Routes>
        </Layout>
      </Router>
    </CounterProvider>
  );
}

export default App;
