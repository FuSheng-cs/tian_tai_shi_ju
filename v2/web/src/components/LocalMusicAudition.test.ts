import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocalMusicAudition from './LocalMusicAudition.vue'

const ids = ['chamomile-tea', 'home', 'late-night-earl-grey', 'peppermint-tea']
const titles = ['Chamomile Tea', 'Home', 'Late Night Earl Grey', 'Peppermint Tea']
const manifest = {
  defaultTrackId: 'late-night-earl-grey',
  tracks: ids.map((id, index) => ({
    id,
    title: titles[index],
    artist: 'Chance Thrash',
    url: `/__local-audio/${id}.mp3`,
    gain: index === 2 ? 0.7 : 0.8,
    source: `https://chancethrash.bandcamp.com/track/${id}`,
    license: index === 2 ? 'CC BY 4.0' : 'all rights reserved',
    durationSeconds: 140,
  })),
}
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, json: async () => manifest })
})
afterEach(() => vi.unstubAllGlobals())

describe('local music audition', () => {
  it('stages the manifest default without fetching audio and lets the existing audio control decide when to play', async () => {
    const setMusicTrack = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(LocalMusicAudition, { props: { setMusicTrack, status: 'original' } })
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/__local-audio/manifest.json')
    expect(setMusicTrack).toHaveBeenCalledWith('/__local-audio/late-night-earl-grey.mp3', 0.7)
    await wrapper.setProps({
      selectedMusicTrack: '/__local-audio/late-night-earl-grey.mp3',
      status: 'selected',
    })
    expect(wrapper.get('select').element.value).toBe('late-night-earl-grey')
    expect(wrapper.text()).toContain('点击「开启声音」后试听')
    expect(wrapper.get('a[href="https://creativecommons.org/licenses/by/4.0/"]').text()).toBe(
      'CC BY 4.0',
    )
    expect(wrapper.find('audio').exists()).toBe(false)
    wrapper.unmount()
  })

  it('switches back to original and allows retrying an explicitly failed selection', async () => {
    const setMusicTrack = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(LocalMusicAudition, { props: { setMusicTrack, status: 'original' } })
    await flushPromises()
    await wrapper.get('select').setValue('home')
    expect(setMusicTrack).toHaveBeenLastCalledWith('/__local-audio/home.mp3', 0.8)
    await wrapper.setProps({ selectedMusicTrack: '/__local-audio/home.mp3', status: 'error' })
    expect(wrapper.text()).toContain('已回到原创配乐')
    await wrapper.get('button').trigger('click')
    expect(setMusicTrack).toHaveBeenLastCalledWith('/__local-audio/home.mp3', 0.8)
    await wrapper.get('select').setValue('')
    expect(setMusicTrack).toHaveBeenLastCalledWith(undefined, undefined)
    wrapper.unmount()
  })

  it.each(['url', 'source'] as const)(
    'rejects a manifest with an unexpected %s destination',
    async (field) => {
      const changed = structuredClone(manifest)
      changed.tracks[0]![field] = 'https://other.example/music.mp3'
      fetchMock.mockResolvedValue({ ok: true, json: async () => changed })
      const setMusicTrack = vi.fn().mockResolvedValue(undefined)
      const wrapper = mount(LocalMusicAudition, { props: { setMusicTrack, status: 'original' } })
      await flushPromises()
      expect(wrapper.text()).toContain('本地试听暂不可用')
      expect(setMusicTrack).not.toHaveBeenCalled()
      expect(wrapper.find('select').exists()).toBe(false)
      wrapper.unmount()
    },
  )

  it('leaves the existing music intact on manifest failure and offers a local retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const setMusicTrack = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(LocalMusicAudition, { props: { setMusicTrack, status: 'original' } })
    await flushPromises()
    expect(setMusicTrack).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(setMusicTrack).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('option')).toHaveLength(5)
    wrapper.unmount()
  })
})
