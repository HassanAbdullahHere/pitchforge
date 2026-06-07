import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import JobDetails from '../../pages/JobDetails'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

beforeEach(() => {
  useAuth.mockReturnValue({ authHeaders: () => ({}) })
})

function renderJobDetails() {
  return render(
    <MemoryRouter initialEntries={['/new']}>
      <Routes>
        <Route path="/new"          element={<JobDetails />} />
        <Route path="/profile/edit" element={<div data-testid="profile-edit" />} />
        <Route path="/analyze"      element={<div data-testid="analyze" />} />
      </Routes>
    </MemoryRouter>
  )
}

// JobDetails has two submit buttons (desktop + mobile layout)
async function findSubmitBtn() {
  const btns = await screen.findAllByText('Analyze Job →')
  return btns[0]
}

test('redirects to /profile/edit when profile returns 404', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
  renderJobDetails()
  expect(await screen.findByTestId('profile-edit')).toBeInTheDocument()
})

test('renders form when profile check succeeds', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  renderJobDetails()
  expect(await findSubmitBtn()).toBeInTheDocument()
})

test('shows title required error when title is empty on submit', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  renderJobDetails()
  fireEvent.click(await findSubmitBtn())
  expect(await screen.findByText('Job title is required')).toBeInTheDocument()
})

test('shows description too short error', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  renderJobDetails()
  await findSubmitBtn()

  await userEvent.type(screen.getByPlaceholderText(/Full-Stack/i), 'Software Engineer')
  await userEvent.type(screen.getByPlaceholderText(/Paste the full job posting/i), 'Too short')
  fireEvent.click(screen.getAllByText('Analyze Job →')[0])

  expect(await screen.findByText(/at least 50 characters/i)).toBeInTheDocument()
})

test('navigates to /analyze on valid form submit', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  renderJobDetails()
  await findSubmitBtn()

  await userEvent.type(screen.getByPlaceholderText(/Full-Stack/i), 'Software Engineer')
  await userEvent.type(
    screen.getByPlaceholderText(/Paste the full job posting/i),
    'This is a detailed job posting with more than fifty characters total here.'
  )
  fireEvent.click(screen.getAllByText('Analyze Job →')[0])

  expect(await screen.findByTestId('analyze')).toBeInTheDocument()
})
