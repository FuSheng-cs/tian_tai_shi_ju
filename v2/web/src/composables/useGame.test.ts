import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api'
import type { Session } from '../domain'
import { useGame } from './useGame'

vi.mock('../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api')>()
  return {
    ...original,
    api: {
      health: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      turn: vi.fn(),
      ending: vi.fn(),
      observe: vi.fn(),
    },
  }
})

function makeSession(revision = 0): Session {
  return {
    id: 'night-123',
    revision,
    mode: 'rehearsal',
    turn: revision,
    status: 'active',
    phase: 'arrival',
    messages: [{ id: 'opening', role: 'character', text: '门别关。' }],
    observations: [],
    memories: [],
    ending: null,
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T00:00:00Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(api.create).mockResolvedValue(makeSession())
})

describe('recoverable conversation requests', () => {
  it('retains the exact command and request ID on network retry without storing dialogue in localStorage', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn)
      .mockRejectedValueOnce(new ApiError('断线', 'NETWORK_ERROR', true))
      .mockResolvedValueOnce(makeSession(1))
    expect(await game.send('我把门留着。', 'door')).toBe(false)
    const firstCommand = vi.mocked(api.turn).mock.calls[0]?.[1]
    expect(game.pendingTurn.value).toEqual(firstCommand)
    expect(await game.send('不应发送新的输入', 'rain')).toBe(true)
    expect(vi.mocked(api.turn).mock.calls[1]?.[1]).toEqual(firstCommand)
    expect(game.pendingTurn.value).toBeNull()
    expect(game.session.value?.turn).toBe(1)
    expect(localStorage.getItem('tiantai:v2:session')).toBe('night-123')
    expect(localStorage.length).toBe(1)
  })

  it('keeps the request while the original turn is still in flight', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn)
      .mockRejectedValueOnce(new ApiError('还在听', 'turn_in_progress', true, 409))
      .mockResolvedValueOnce(makeSession(1))
    await game.send('我在这儿等。')
    const command = game.pendingTurn.value
    expect(command).not.toBeNull()
    expect(api.restore).not.toHaveBeenCalled()
    await game.send('我在这儿等。')
    expect(vi.mocked(api.turn).mock.calls[1]?.[1]).toEqual(command)
  })

  it('clears a lost-response command after resume finds it committed', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn).mockRejectedValue(new ApiError('断线', 'NETWORK_ERROR', true))
    await game.send('我把门留着。')
    vi.mocked(api.restore).mockResolvedValue(makeSession(1))
    expect(await game.resume()).toBe(true)
    expect(game.session.value?.revision).toBe(1)
    expect(game.pendingTurn.value).toBeNull()
  })

  it('preserves the pending request when resume still sees the original revision', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn).mockRejectedValue(new ApiError('断线', 'NETWORK_ERROR', true))
    await game.send('我在这里。')
    const command = game.pendingTurn.value
    vi.mocked(api.restore).mockResolvedValue(makeSession())
    await game.resume()
    expect(game.pendingTurn.value).toEqual(command)
  })

  it('loads server state after a revision conflict and allows reviewing before resubmission', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn).mockRejectedValue(new ApiError('新进度', 'revision_conflict', true, 409))
    vi.mocked(api.restore).mockResolvedValue(makeSession(2))
    expect(await game.send('我刚才想说……')).toBe(false)
    expect(game.session.value?.revision).toBe(2)
    expect(game.pendingTurn.value).toBeNull()
    expect(game.error.value).toContain('已同步')
  })

  it('keeps the draft request if conflict synchronisation also fails', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn).mockRejectedValue(new ApiError('新进度', 'revision_conflict', true, 409))
    vi.mocked(api.restore).mockRejectedValue(new ApiError('断线', 'NETWORK_ERROR', true))
    await game.send('原话留着。')
    expect(game.pendingTurn.value?.text).toBe('原话留着。')
    expect(game.error.value).toContain('仍已保留')
  })

  it('removes a stale session without treating temporary network errors as missing progress', async () => {
    localStorage.setItem('tiantai:v2:session', 'old-night')
    const game = useGame()
    vi.mocked(api.restore)
      .mockRejectedValueOnce(new ApiError('断线', 'NETWORK_ERROR', true))
      .mockRejectedValueOnce(new ApiError('不存在', 'not_found', false, 404))
    await game.resume()
    expect(game.savedId.value).toBe('old-night')
    await game.resume()
    expect(game.savedId.value).toBeNull()
    expect(localStorage.getItem('tiantai:v2:session')).toBeNull()
  })

  it('retains the exact ending choice and request ID after a failed response', async () => {
    const game = useGame()
    vi.mocked(api.create).mockResolvedValue({ ...makeSession(10), status: 'choosing' })
    await game.start('rehearsal')
    vi.mocked(api.ending)
      .mockRejectedValueOnce(new ApiError('断线', 'NETWORK_ERROR', true))
      .mockResolvedValueOnce({ ...makeSession(11), status: 'ended', turn: 10 })
    await game.end('separate', '3-player')
    const command = game.pendingEnding.value
    await game.end('correspondence', '6-player')
    expect(vi.mocked(api.ending).mock.calls[1]?.[1]).toEqual(command)
    expect(command?.echoMessageId).toBe('3-player')
    expect(game.pendingEnding.value).toBeNull()
  })

  it('persists a free observation, reuses its request after loss and submits the next sentence at the new revision', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.observe)
      .mockRejectedValueOnce(new ApiError('断线', 'NETWORK_ERROR', true))
      .mockResolvedValueOnce({ ...makeSession(1), turn: 0, observations: ['door'] })
    expect(await game.observe('door')).toBe(false)
    const original = game.pendingObservation.value
    expect(await game.send('门还开着。')).toBe(false)
    expect(api.turn).not.toHaveBeenCalled()
    expect(await game.observe('rain')).toBe(true)
    expect(vi.mocked(api.observe).mock.calls[1]?.[1]).toEqual(original)
    expect(game.session.value?.turn).toBe(0)
    expect(game.session.value?.revision).toBe(1)
    expect(await game.observe('door')).toBe(true)
    expect(api.observe).toHaveBeenCalledTimes(2)
    vi.mocked(api.turn).mockResolvedValue({ ...makeSession(2), turn: 1, observations: ['door'] })
    await game.send('门还开着。')
    expect(vi.mocked(api.turn).mock.calls[0]?.[1].expectedRevision).toBe(1)
  })

  it('represents a deliberate silence as an action and retries that action without turning it into new speech', async () => {
    const game = useGame()
    await game.start('rehearsal')
    vi.mocked(api.turn)
      .mockRejectedValueOnce(new ApiError('断线', 'NETWORK_ERROR', true))
      .mockResolvedValueOnce(makeSession(1))
    await game.silence()
    const original = game.pendingTurn.value
    expect(original).toMatchObject({ text: '让这一刻安静一会儿。', intent: 'silence' })
    await game.send('还没送出的草稿')
    expect(vi.mocked(api.turn).mock.calls[1]?.[1]).toEqual(original)
  })

  it('leaves the keepsake blank when the player has not chosen a quote', async () => {
    const game = useGame()
    vi.mocked(api.create).mockResolvedValue({ ...makeSession(10), status: 'choosing' })
    vi.mocked(api.ending).mockResolvedValue({ ...makeSession(11), turn: 10, status: 'ended' })
    await game.start('rehearsal')
    await game.end('separate')
    expect(vi.mocked(api.ending).mock.calls[0]?.[1].echoMessageId).toBe('')
  })
})
