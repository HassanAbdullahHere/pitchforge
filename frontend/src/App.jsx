import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import JobDetails from './pages/JobDetails'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/new" element={<JobDetails />} />
      </Routes>
    </BrowserRouter>
  )
}
