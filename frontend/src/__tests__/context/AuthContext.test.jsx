import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

function TestConsumer() {
  const { user, loading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'null'}</span>
      <button data-testid="logout-btn" onClick={logout} />
    </div>
  )
}

function setup() {
  return render(<AuthProvider><TestConsumer /></AuthProvider>)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

test('loading resolves to false and no fetch called when no token', async () => {
  global.fetch = vi.fn()
  setup()
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
  expect(global.fetch).not.toHaveBeenCalled()
  expect(screen.getByTestId('user')).toHaveTextContent('null')
})

test('session restored from valid localStorage token', async () => {
  localStorage.setItem('pitchforge_token', 'stored-jwt')
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ email: 'restored@test.com', name: 'Restored', is_admin: false }),
  })
  setup()
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('restored@test.com'))
  expect(screen.getByTestId('loading')).toHaveTextContent('false')
})

test('invalid token cleared when /api/auth/me returns error', async () => {
  localStorage.setItem('pitchforge_token', 'expired-jwt')
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
  setup()
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
  expect(screen.getByTestId('user')).toHaveTextContent('null')
  expect(localStorage.getItem('pitchforge_token')).toBeNull()
})

test('login stores token and sets user', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-jwt' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'loggedin@test.com', name: 'User', is_admin: false }),
    })

  let loginFn
  function LoginConsumer() {
    const { user, loading, login } = useAuth()
    loginFn = login
    return (
      <div>
        <span data-testid="loading">{String(loading)}</span>
        <span data-testid="user">{user?.email ?? 'null'}</span>
      </div>
    )
  }
  render(<AuthProvider><LoginConsumer /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

  await act(async () => { await loginFn('fake-google-token') })

  expect(screen.getByTestId('user')).toHaveTextContent('loggedin@test.com')
  expect(localStorage.getItem('pitchforge_token')).toBe('new-jwt')
})

test('login throws account_blocked when detail is account_blocked', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ detail: 'account_blocked' }),
  })

  let caughtMessage = null
  let loginFn
  function BlockedConsumer() {
    const { login } = useAuth()
    loginFn = login
    return null
  }
  render(<AuthProvider><BlockedConsumer /></AuthProvider>)

  await act(async () => {
    try { await loginFn('token') } catch (e) { caughtMessage = e.message }
  })
  expect(caughtMessage).toBe('account_blocked')
})

test('logout clears user and localStorage', async () => {
  localStorage.setItem('pitchforge_token', 'valid-jwt')
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ email: 'user@test.com', name: 'User', is_admin: false }),
  })

  setup()
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@test.com'))

  act(() => { screen.getByTestId('logout-btn').click() })
  expect(screen.getByTestId('user')).toHaveTextContent('null')
  expect(localStorage.getItem('pitchforge_token')).toBeNull()
})
