import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminRoute from '../../components/AdminRoute'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

function renderAdmin(authState) {
  useAuth.mockReturnValue(authState)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div data-testid="home" />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div data-testid="admin-content">admin panel</div>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

test('renders nothing while loading', () => {
  const { container } = renderAdmin({ user: null, loading: true })
  expect(container).toBeEmptyDOMElement()
})

test('redirects to / when no user', async () => {
  renderAdmin({ user: null, loading: false })
  expect(await screen.findByTestId('home')).toBeInTheDocument()
  expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
})

test('redirects to / when user is not admin', async () => {
  renderAdmin({ user: { email: 'user@test.com', is_admin: false }, loading: false })
  expect(await screen.findByTestId('home')).toBeInTheDocument()
  expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
})

test('renders children when user is admin', () => {
  renderAdmin({ user: { email: 'admin@test.com', is_admin: true }, loading: false })
  expect(screen.getByTestId('admin-content')).toBeInTheDocument()
})
