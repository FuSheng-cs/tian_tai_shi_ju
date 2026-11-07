<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type TrackStatus = 'original' | 'selected' | 'loading' | 'ready' | 'error'
interface Track {
  id: string
  title: string
  artist: string
  url: string
  gain: number
  source: string
  license: string
  durationSeconds: number
}

const props = defineProps<{
  setMusicTrack: (url?: string, gain?: number) => Promise<void>
  status: TrackStatus
  selectedMusicTrack?: string
}>()

const trackIds = ['chamomile-tea', 'home', 'late-night-earl-grey', 'peppermint-tea']
const tracks = ref<Track[]>([])
const manifestLoading = ref(true)
const manifestError = ref(false)
const selectionError = ref(false)
const controller = new AbortController()
let mounted = true
const selectedTrack = computed(() =>
  tracks.value.find((track) => track.url === props.selectedMusicTrack),
)
const selectedId = computed(() => selectedTrack.value?.id ?? '')
const statusText = computed(() => {
  if (selectionError.value || props.status === 'error')
    return '曲目未能载入，已回到原创配乐。可以重试，或选择另一首。'
  if (props.status === 'loading') return '正在载入所选曲目……'
  if (props.status === 'selected') return '已选好。点击「开启声音」后试听。'
  if (props.status === 'ready') return '曲目已就绪。音乐与雨声音量仍可分别调整。'
  return '已选择原创配乐。'
})

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseManifest(value: unknown): { defaultTrackId: string; tracks: Track[] } {
  if (
    !record(value) ||
    !Array.isArray(value.tracks) ||
    value.tracks.length !== trackIds.length ||
    typeof value.defaultTrackId !== 'string' ||
    !trackIds.includes(value.defaultTrackId)
  )
    throw new Error('Invalid local music manifest')
  const parsed: Track[] = []
  for (const item of value.tracks) {
    if (
      !record(item) ||
      typeof item.id !== 'string' ||
      !trackIds.includes(item.id) ||
      parsed.some((track) => track.id === item.id) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 100 ||
      item.artist !== 'Chance Thrash' ||
      item.url !== `/__local-audio/${item.id}.mp3` ||
      item.source !== `https://chancethrash.bandcamp.com/track/${item.id}` ||
      typeof item.gain !== 'number' ||
      !Number.isFinite(item.gain) ||
      item.gain < 0 ||
      typeof item.durationSeconds !== 'number' ||
      !Number.isFinite(item.durationSeconds) ||
      item.durationSeconds <= 0 ||
      (item.license !== 'CC BY 4.0' && item.license !== 'all rights reserved')
    )
      throw new Error('Invalid local music track')
    parsed.push({
      id: item.id,
      title: item.title,
      artist: item.artist,
      url: item.url,
      gain: item.gain,
      source: item.source,
      license: item.license,
      durationSeconds: item.durationSeconds,
    })
  }
  return { defaultTrackId: value.defaultTrackId, tracks: parsed }
}

async function choose(id: string) {
  const track = tracks.value.find((item) => item.id === id)
  if (id && !track) return
  selectionError.value = false
  try {
    await props.setMusicTrack(track?.url, track?.gain)
  } catch {
    selectionError.value = true
  }
}

async function loadManifest() {
  manifestLoading.value = true
  manifestError.value = false
  try {
    const response = await fetch('/__local-audio/manifest.json', {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Local music manifest unavailable')
    const manifest = parseManifest(await response.json())
    if (!mounted) return
    tracks.value = manifest.tracks
    await choose(manifest.defaultTrackId)
  } catch {
    if (mounted) manifestError.value = true
  } finally {
    if (mounted) manifestLoading.value = false
  }
}

onMounted(() => {
  void loadManifest()
})
onBeforeUnmount(() => {
  mounted = false
  controller.abort()
})
</script>

<template>
  <section class="local-audition" aria-labelledby="local-audition-label">
    <label id="local-audition-label" for="local-music-track">本地配乐试听</label>
    <p v-if="manifestLoading" class="audition-status" role="status">正在读取本地曲目……</p>
    <div v-else-if="manifestError" class="audition-unavailable">
      <p role="status">本地试听暂不可用，原有声音设置仍可使用。</p>
      <button class="text-button" @click="loadManifest">重新读取曲目</button>
    </div>
    <template v-else>
      <select
        id="local-music-track"
        :value="selectedId"
        @change="choose(($event.target as HTMLSelectElement).value)"
      >
        <option value="">原创配乐 · 没有关严的门</option>
        <option v-for="track in tracks" :key="track.id" :value="track.id">{{ track.title }}</option>
      </select>
      <div v-if="selectedTrack" class="audition-credit">
        <p>
          <strong>{{ selectedTrack.title }}</strong
          ><span> — {{ selectedTrack.artist }}</span>
        </p>
        <div>
          <a :href="selectedTrack.source" target="_blank" rel="noopener noreferrer nofollow"
            >作品原页</a
          >
          <a
            v-if="selectedTrack.license === 'CC BY 4.0'"
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer nofollow"
            >CC BY 4.0</a
          >
          <span v-else>all rights reserved</span>
        </div>
      </div>
      <p class="audition-status" role="status">{{ statusText }}</p>
      <button
        v-if="(status === 'error' || selectionError) && selectedTrack"
        class="text-button"
        @click="choose(selectedTrack.id)"
      >
        重试这首曲目
      </button>
      <p class="audition-note">只在本地试听页生效；刷新后回到默认选曲。选曲不会自动开启声音。</p>
    </template>
  </section>
</template>

<style scoped>
.local-audition {
  margin-top: 25px;
  padding-top: 23px;
  border-top: 1px solid #584562;
}
.local-audition > label {
  display: block;
  color: #dfccea;
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 12px;
}
.local-audition select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  background: #24202d;
  color: #e5d9ec;
  border: 1px solid #80658f;
  font: inherit;
  font-size: 13px;
  border-radius: 0;
}
.local-audition select:focus-visible {
  outline: 2px solid #c8b9e0;
  outline-offset: 4px;
}
.audition-credit {
  margin-top: 14px;
}
.audition-credit p {
  color: #d3c4df;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.audition-credit strong {
  font-weight: 400;
  color: #ecdeef;
}
.audition-credit > div {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 7px;
  color: #b8a6c6;
  font-size: 11px;
  line-height: 1.8;
}
.audition-credit a {
  text-underline-offset: 3px;
}
.audition-status,
.audition-unavailable p {
  color: #c5b3d0;
  font-size: 12px;
  line-height: 1.9;
  margin-top: 14px;
}
.audition-note {
  color: #ac9bb6;
  font-size: 11px;
  line-height: 1.9;
  margin-top: 13px;
}
.local-audition .text-button {
  font-size: 12px;
  min-height: 36px;
  margin-top: 8px;
}
@media (max-width: 520px) {
  .local-audition select {
    font-size: 16px;
  }
}
</style>
