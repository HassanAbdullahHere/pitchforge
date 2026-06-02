import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import JobDetails from './pages/JobDetails'
import AnalyzePipeline from './pages/AnalyzePipeline'
import GenerateProposal from './pages/GenerateProposal'
import ProposalHistory from './pages/ProposalHistory'
import ProposalDetail from './pages/ProposalDetail'
import Profile from './pages/Profile'
import ProfileForm from './pages/ProfileForm'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Landing />} />
        <Route path="/new"               element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />
        <Route path="/analyze"           element={<ProtectedRoute><AnalyzePipeline /></ProtectedRoute>} />
        <Route path="/generate"          element={<ProtectedRoute><GenerateProposal /></ProtectedRoute>} />
        <Route path="/proposals"         element={<ProtectedRoute><ProposalHistory /></ProtectedRoute>} />
        <Route path="/proposals/:id"     element={<ProtectedRoute><ProposalDetail /></ProtectedRoute>} />
        <Route path="/profile"           element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/edit"      element={<ProtectedRoute><ProfileForm /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
