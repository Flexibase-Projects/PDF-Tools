import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { CounterProvider } from './contexts/CounterContext';
import Layout from './components/Layout/Layout';
import MergePDF from './pages/MergePDF';
import SplitPDF from './pages/SplitPDF';
import CompressPDF from './pages/CompressPDF';
import PDFToWord from './pages/PDFToWord';
import WordToPDF from './pages/WordToPDF';
import EditPDF from './pages/EditPDF';
import PresentPDF from './pages/PresentPDF';
import WatermarkPDF from './pages/WatermarkPDF';
import SignPDF from './pages/SignPDF';
import RepairPDF from './pages/RepairPDF';
import Ajuda from './pages/Ajuda';

function App() {
  return (
    <ThemeProvider>
      <CounterProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<MergePDF />} />
              <Route path="/merge" element={<MergePDF />} />
              <Route path="/split" element={<SplitPDF />} />
              <Route path="/compress" element={<CompressPDF />} />
              <Route path="/word" element={<PDFToWord />} />
              <Route path="/word-to-pdf" element={<WordToPDF />} />
              <Route path="/edit" element={<EditPDF />} />
              <Route path="/present" element={<PresentPDF />} />
              <Route path="/watermark" element={<WatermarkPDF />} />
              <Route path="/sign" element={<SignPDF />} />
              <Route path="/repair" element={<RepairPDF />} />
              <Route path="/ajuda" element={<Ajuda />} />
            </Routes>
          </Layout>
        </Router>
      </CounterProvider>
    </ThemeProvider>
  );
}

export default App;
