import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import JobDetails from './pages/JobDetails'
import AnalyzePipeline from './pages/AnalyzePipeline'
import GenerateProposal from './pages/GenerateProposal'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Protected — redirect to /login if not authenticated */}
        <Route path="/new"      element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />
        <Route path="/analyze"  element={<ProtectedRoute><AnalyzePipeline /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GenerateProposal /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
