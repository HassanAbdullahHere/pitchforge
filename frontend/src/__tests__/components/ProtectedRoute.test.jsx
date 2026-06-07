import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockUser = { email: 'user@test.com', is_admin: false }

function renderProtected(authState) {
  useAuth.mockReturnValue(authState)
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/" element={<div data-testid="home" />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="child">protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

test('renders nothing while loading', () => {
  const { container } = renderProtected({ user: null, loading: true })
  expect(container).toBeEmptyDOMElement()
})

test('redirects to / when no user', async () => {
  renderProtected({ user: null, loading: false })
  expect(await screen.findByTestId('home')).toBeInTheDocument()
  expect(screen.queryByTestId('child')).not.toBeInTheDocument()
})

test('renders children when user is authenticated', () => {
  renderProtected({ user: mockUser, loading: false })
  expect(screen.getByTestId('child')).toBeInTheDocument()
})
