import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ProfileForm from '../../pages/ProfileForm'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

beforeEach(() => {
  useAuth.mockReturnValue({ authHeaders: () => ({}) })
  // Default: profile fetch returns 404 so form renders empty without pre-fill
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
})

function renderForm() {
  return render(
    <MemoryRouter>
      <ProfileForm />
    </MemoryRouter>
  )
}

async function waitForForm() {
  return screen.findByText('Drop your resume here or click to upload')
}

function uploadFile(container, file) {
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [file] } })
}

test('shows error for unsupported file type', async () => {
  const { container } = renderForm()
  await waitForForm()

  const file = new File(['dummy'], 'resume.txt', { type: 'text/plain' })
  uploadFile(container, file)

  expect(await screen.findByText('Only PDF and DOCX files are supported.')).toBeInTheDocument()
})

test('shows error when file exceeds 5 MB', async () => {
  const { container } = renderForm()
  await waitForForm()

  const file = new File(['x'], 'resume.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })
  uploadFile(container, file)

  expect(await screen.findByText('File too large. Maximum size is 5 MB.')).toBeInTheDocument()
})

test('pre-fills form from parsed resume on successful API response', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        parsed: {
          title: 'Senior Dev', bio: 'I build things.', skills: ['Python'],
          projects: [], experience: [], niches: [], rates: {},
        },
      }),
    })

  const { container } = renderForm()
  await waitForForm()

  const file = new File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' })
  uploadFile(container, file)

  expect(await screen.findByDisplayValue('Senior Dev')).toBeInTheDocument()
})

test('shows toast on parse-resume API error', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Resume parsing failed. Please try again.' }),
    })

  const { container } = renderForm()
  await waitForForm()

  const file = new File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' })
  uploadFile(container, file)

  expect(await screen.findByText('Resume parsing failed. Please try again.')).toBeInTheDocument()
})
