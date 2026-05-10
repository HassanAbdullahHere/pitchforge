import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import JobDetails from './pages/JobDetails'
import AnalyzePipeline from './pages/AnalyzePipeline'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/new" element={<JobDetails />} />
        <Route path="/analyze" element={<AnalyzePipeline />} />
      </Routes>
    </BrowserRouter>
  )
}
