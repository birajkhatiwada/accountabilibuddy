import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { Pencil, X, Camera } from 'lucide-react'
import GoalBuilder from '../components/GoalBuilder'
import DailyNote from '../components/DailyNote'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import confetti from 'canvas-confetti'
import catAtlasOrange from '../assets/cat-atlas.png'
import catAtlasDark   from '../assets/cat-atlas-dark.png'
import catAtlasWhite  from '../assets/cat-atlas-white.png'

export const CAT_ATLASES = [catAtlasOrange, catAtlasDark, catAtlasWhite]
export const CAT_LABELS  = ['Orange', 'Dark', 'White']

// Atlas: 1056×1248px (11 cols × 13 rows), built at 3× source (96px per cell).
// Displayed at SCALE=½ → 48×48 per frame.
const SCALE   = 1 / 2
const ATLAS_W = Math.round(1056 * SCALE)  // 528
const ATLAS_H = Math.round(1248 * SCALE)  // 624
const FRAME_W = Math.round(96 * SCALE)    // 48
const FRAME_H = Math.round(96 * SCALE)    // 48

// Atlas row layout:
// 0=walk-right  1=walk-left
// 2=sleep4-L    3=sleep4-R   (flat, directional)  ← sleep behaviors (idx 0-1)
// 4=sleep1-L    5=sleep1-R   (curl, directional)
// 6=meow-sit    7=yawn-sit   8=wash-sit            ← active rest (idx 2+)
// 9=yawn-lie    10=wash-lie
// 11=scratch-L  12=scratch-R (directional)
const WALK_FRAME_COUNT = 8
const REST_BEHAVIORS = [
  { rows: [2, 3],   frames: 2,  frameMs: 700, zzz: true  }, // 0 sleep flat
  { rows: [4, 5],   frames: 2,  frameMs: 700, zzz: true  }, // 1 sleep curl
  { rows: [6],      frames: 3,  frameMs: 220, zzz: false }, // 2 meow
  { rows: [7],      frames: 8,  frameMs: 150, zzz: false }, // 3 yawn sitting
  { rows: [8],      frames: 9,  frameMs: 130, zzz: false }, // 4 wash sitting
  { rows: [9],      frames: 8,  frameMs: 150, zzz: false }, // 5 yawn lying
  { rows: [10],     frames: 7,  frameMs: 130, zzz: false }, // 6 wash lying
  { rows: [11, 12], frames: 11, frameMs: 100, zzz: false }, // 7 scratch (directional)
]
const SLEEP_COUNT = 2 // first N behaviors are sleep

function CatProgressBar({ pct, atlasUrl, sheetOpen, compact = false, gaming = false }) {
  const [displayedPct, setDisplayedPct] = useState(pct)
  const [isWalking, setIsWalking]       = useState(false)
  const [facingRight, setFacingRight]   = useState(true)
  const [frame, setFrame]               = useState(0)
  const [behaviorIdx, setBehaviorIdx]   = useState(0)
  const prevRef  = useRef(pct)
  const timerRef = useRef(null)

  // Hold progress updates while a logging sheet is open; flush when it closes
  useEffect(() => {
    if (!sheetOpen) setDisplayedPct(pct)
  }, [pct, sheetOpen])

  useEffect(() => {
    if (displayedPct !== prevRef.current) {
      setFacingRight(displayedPct > prevRef.current)
      setIsWalking(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setBehaviorIdx(SLEEP_COUNT + Math.floor(Math.random() * (REST_BEHAVIORS.length - SLEEP_COUNT)))
        setIsWalking(false)
      }, 6500)
      prevRef.current = displayedPct
    }
    return () => clearTimeout(timerRef.current)
  }, [displayedPct])

  useEffect(() => {
    setFrame(0)
    if (isWalking) {
      const id = setInterval(() => setFrame(f => (f + 1) % WALK_FRAME_COUNT), 150)
      return () => clearInterval(id)
    }
    const b = REST_BEHAVIORS[behaviorIdx]
    if (b.zzz) {
      const id = setInterval(() => setFrame(f => (f + 1) % b.frames), b.frameMs)
      return () => clearInterval(id)
    }
    const targetCycles = 2 + Math.floor(Math.random() * 2)
    let localFrame = 0, cycles = 0
    const id = setInterval(() => {
      localFrame = (localFrame + 1) % b.frames
      setFrame(localFrame)
      if (localFrame === 0) {
        cycles++
        if (cycles >= targetCycles) {
          clearInterval(id)
          setBehaviorIdx(Math.floor(Math.random() * SLEEP_COUNT))
        }
      }
    }, b.frameMs)
    return () => clearInterval(id)
  }, [isWalking, behaviorIdx])

  const pctRound = Math.round(displayedPct * 100)
  const clampedLeft = Math.min(Math.max(pctRound, 9), 91)

  const trackColor = displayedPct >= 0.65
    ? 'linear-gradient(to right,#22c55e,#4ade80)'
    : displayedPct >= 0.35
      ? 'linear-gradient(to right,#f97316,#fb923c)'
      : 'linear-gradient(to right,#ef4444,#f87171)'
  const glowColor = displayedPct >= 0.65 ? '#22c55e55' : displayedPct >= 0.35 ? '#f9731655' : '#ef444455'
  const dotColor  = displayedPct >= 0.65 ? '#22c55e'   : displayedPct >= 0.35 ? '#f97316'   : '#ef4444'

  const behavior = REST_BEHAVIORS[behaviorIdx]
  const bgRow = isWalking
    ? (facingRight ? 0 : 1)
    : behavior.rows.length > 1 ? behavior.rows[facingRight ? 0 : 1] : behavior.rows[0]
  const bgX = frame * FRAME_W
  const bgY = bgRow * FRAME_H
  const showZzz = !isWalking && behavior.zzz

  if (compact) {
    const s = 2 / 3  // 48px → 32px
    return (
      <div className="w-full relative" style={{ height: 46 }}>
        {/* Track: border + gap + fill */}
        <div className="absolute bottom-0 w-full"
          style={{ height: 11, borderWidth: '1.5px', borderStyle: 'solid', borderRadius: gaming ? 2 : 3,
            borderColor: gaming ? dotColor : 'white',
            boxShadow: gaming ? `0 0 6px ${glowColor}` : 'none',
            padding: 2, boxSizing: 'border-box' }}>
          <div className="relative h-full overflow-hidden" style={{ borderRadius: 1 }}>
            <div className={`absolute inset-0 ${gaming ? '' : 'bg-zinc-100 dark:bg-zinc-800'}`} style={gaming ? { background: '#050505' } : undefined} />
            <div className="absolute inset-y-0 left-0 h-full cat-bar-fill"
              style={{ width: `${pctRound}%`, background: trackColor, transition: 'width 2s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 6px ${glowColor}` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent cat-bar-shimmer" />
            </div>
          </div>
        </div>
        {/* Cat (32px) on top of track */}
        <div className="absolute select-none"
          style={{ left: `${clampedLeft}%`, bottom: 11, transform: 'translateX(-50%)', transition: 'left 2s cubic-bezier(0.4,0,0.2,1)' }}>
          {showZzz && (
            <div className="absolute pointer-events-none" style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)' }}>
              <span className="zzz-1 absolute text-[8px] font-black text-zinc-400 dark:text-zinc-500">z</span>
              <span className="zzz-2 absolute text-[7px] font-black text-zinc-300 dark:text-zinc-600" style={{ left: '6px', top: '-3px' }}>z</span>
            </div>
          )}
          <div style={{
            width: 32, height: 32,
            backgroundImage: `url(${atlasUrl})`,
            backgroundSize: `${Math.round(ATLAS_W * s)}px ${Math.round(ATLAS_H * s)}px`,
            backgroundPosition: `-${Math.round(bgX * s)}px -${Math.round(bgY * s)}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }} />
        </div>
      </div>
    )
  }

  const gamingLevel = Math.min(10, Math.floor(pctRound / 10) + (pctRound > 0 ? 1 : 0))
  const gamingBorderColor = dotColor
  const gamingGlow = `0 0 8px ${glowColor}, 0 0 20px ${glowColor}`

  return (
    <div className="w-full mt-3">
      <div className="flex items-center justify-between mb-1.5">
        {gaming ? (
          <>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: dotColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.15em' }}>⚡ XP BAR</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: dotColor }}>LVL {gamingLevel}</span>
          </>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">This week</span>
        )}
      </div>

      <div className="relative h-16">
        {/* Ruler watermark */}
        {(() => {
          const W = 340, midY = 22
          const labelX = Math.max(22, Math.min(W - 22, (pctRound / 100) * W))
          return (
            <svg width="100%" height="100%" viewBox={`0 0 ${W} 64`} preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 0, opacity: 0.11,
                color: gaming ? '#00ff88' : 'currentColor',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 28%, black 72%, transparent 100%)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 28%, black 72%, transparent 100%)',
              }}>
              <line x1="0" y1={midY} x2={W} y2={midY} stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
              {Array.from({ length: 51 }, (_, i) => i * 2).map(p => {
                const x = (p / 100) * W
                const isMajor = p % 25 === 0
                const isMid = p % 10 === 0
                const h = isMajor ? 12 : isMid ? 7 : 4
                return <line key={p} x1={x} y1={midY - h / 2} x2={x} y2={midY + h / 2}
                  stroke="currentColor" strokeWidth={isMajor ? 1.4 : isMid ? 0.9 : 0.6}
                  opacity={isMajor ? 1 : isMid ? 0.7 : 0.45} />
              })}
              <rect x={labelX - 40} y={midY - 18} width="80" height="36"
                fill={gaming ? '#020202' : document.documentElement.classList.contains('dark') ? '#09090b' : '#fafafa'} />
              <text x={labelX} y={midY + 13} textAnchor="middle" fontSize="32" fontWeight="900"
                fill="currentColor" letterSpacing="-0.5">{pctRound}%</text>
            </svg>
          )
        })()}
        {/* Cover for the progress bar area only */}
        <div className="absolute bottom-0 w-full bg-white dark:bg-zinc-900"
          style={{ height: 14, zIndex: 3 }} />
        {/* Cover hides sign posts behind the bar; cat (zIndex 4) still shows above */}
        <div className="absolute bottom-0 w-full bg-white dark:bg-zinc-900"
          style={{ height: 14, zIndex: 3 }} />
        {/* Track: outer border + inner gap + fill */}
        <div className="absolute bottom-0 w-full"
          style={{
            height: 14, borderWidth: '1.5px', borderStyle: 'solid', borderRadius: gaming ? 2 : 3,
            borderColor: gaming ? gamingBorderColor : 'rgba(255,255,255,0.45)',
            boxShadow: gaming ? gamingGlow : 'none',
            padding: 2, boxSizing: 'border-box', zIndex: 5,
          }}>
          <div className="relative h-full overflow-hidden" style={{ borderRadius: 1 }}>
            <div className={`absolute inset-0 ${gaming ? '' : 'bg-zinc-100 dark:bg-zinc-800'}`} style={gaming ? { background: '#050505' } : undefined} />
            <div className="absolute inset-y-0 left-0 h-full cat-bar-fill"
              style={{ width: `${pctRound}%`, background: trackColor, transition: 'width 2s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 8px ${glowColor}` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent cat-bar-shimmer" />
              {gaming && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.4) 3px,rgba(0,0,0,0.4) 4px)' }} />}
            </div>
          </div>
        </div>

        {/* Post signs at zone boundaries and finish */}
        {[
          { at: 35, signColor: '#f97316', postColor: '#c2410c', label: gaming ? '▶' : null },
          { at: 65, signColor: '#22c55e', postColor: '#15803d', label: gaming ? '▶' : null },
          { at: 100, signColor: null,     postColor: gaming ? dotColor : '#27272a', label: gaming ? 'MAX' : null },
        ].map(({ at, signColor, postColor, label }) => (
          <div key={at} className="absolute pointer-events-none select-none flex flex-col items-center"
            style={{ left: `${at}%`, bottom: 11, transform: 'translateX(-50%)', zIndex: 2 }}>
            {signColor ? (
              <div style={{ width: gaming ? 14 : 11, height: gaming ? 8 : 7, background: signColor, borderRadius: gaming ? 1 : 1,
                marginBottom: 1, boxShadow: gaming ? `0 0 6px ${signColor}` : `0 0 4px ${signColor}88`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {label && <span style={{ fontSize: 5, color: '#fff', fontWeight: 900 }}>{label}</span>}
              </div>
            ) : (
              gaming ? (
                <div style={{ width: 16, height: 8, borderRadius: 1, marginBottom: 1,
                  background: '#000', border: `1px solid ${dotColor}`,
                  boxShadow: `0 0 6px ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 5, fontWeight: 900, color: dotColor, letterSpacing: 1 }}>MAX</span>
                </div>
              ) : (
                <div style={{ width: 12, height: 8, borderRadius: 1, marginBottom: 1, overflow: 'hidden',
                  background: 'repeating-conic-gradient(#1c1c1e 0% 25%, #e4e4e7 0% 50%) 0 0 / 4px 4px',
                  border: '1px solid #3f3f46' }} />
              )
            )}
            <div style={{ width: 1.5, height: 12, background: postColor,
              boxShadow: gaming ? `0 0 4px ${postColor}` : 'none' }} />
          </div>
        ))}

        {/* Cat */}
        <div className="absolute select-none"
          style={{ left: `${clampedLeft}%`, bottom: 2, transform: `translateX(-50%) translateY(${!isWalking && behaviorIdx === 1 ? 7 : 0}px)`, transition: 'left 6s linear, transform 0.3s ease', zIndex: 4 }}>
          {showZzz && (
            <div className="absolute pointer-events-none" style={{ top: '-14px', left: '50%', transform: 'translateX(-50%)' }}>
              <span className="zzz-1 absolute text-[10px] font-black text-zinc-400 dark:text-zinc-500">z</span>
              <span className="zzz-2 absolute text-[8px] font-black text-zinc-300 dark:text-zinc-600" style={{ left: '9px', top: '-5px' }}>z</span>
            </div>
          )}
          <div style={{
            width: FRAME_W, height: FRAME_H,
            backgroundImage: `url(${atlasUrl})`,
            backgroundSize: `${ATLAS_W}px ${ATLAS_H}px`,
            backgroundPosition: `-${bgX}px -${bgY}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }} />
        </div>
      </div>
    </div>
  )
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const GOAL_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6']

const AVATAR_EMOJIS = [
  '🐨','🦊','🐸','🐼','🦁','🐯','🐻','🐰','🐹','🐶',
  '🐱','🐺','🦋','🐧','🦜','🐙','🦄','🐳','🦈','🦕',
  '🌸','⭐','🔥','💎','🌈','🍕','🧁','🍩','🎸','🚀',
  '🌙','🍀','🎯','💫','🎃','🦩','🐝','🦔','🐠','🌵',
]
const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]

const BANNER_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-violet-600',
  'from-red-500 to-orange-500',
  'from-teal-400 to-cyan-600',
  'from-fuchsia-500 to-pink-500',
  'from-slate-600 to-zinc-700',
]

const BANNER_COLOR_PREVIEWS = [
  '#8b5cf6','#3b82f6','#10b981','#f97316',
  '#ec4899','#6366f1','#ef4444','#14b8a6',
  '#d946ef','#475569',
]

const AVATAR_HEX = [
  '#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#6366f1','#14b8a6','#d946ef',
]

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}


function Counter({ value, onChange, unit }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onChange(Math.max(0, value - 1))}
        className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-sm flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        −
      </button>
      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 w-5 text-center tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(999, value + 1))}
        className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-sm flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        +
      </button>
      {unit && <span className="text-[10px] text-zinc-400 ml-0.5">{unit}</span>}
    </div>
  )
}


export default function MemberProfile() {
  const { name, sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setUiTheme: setGlobalUiTheme } = useTheme()
  const isOwner = user?.displayName?.toLowerCase() === name?.toLowerCase()
  const weekId = getCurrentWeekId()
  const todayKey = dateKey(new Date())

  const [memberGoals, setMemberGoals] = useState(undefined) // undefined = loading, null = none set
  const [members, setMembers] = useState([])
  const [entry, setEntry] = useState(undefined)
  const [allEntries, setAllEntries] = useState([])
  const [logs, setLogs] = useState({})
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [avatars, setAvatars] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [goalsInput, setGoalsInput] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const [goalBuilderKey, setGoalBuilderKey] = useState(0)
  const [carryOverGoals, setCarryOverGoals] = useState(null)
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [localCounts, setLocalCounts] = useState({})
  const [localTotals, setLocalTotals] = useState({})
  const [localHabits, setLocalHabits] = useState({})
  const [proofOpen, setProofOpen] = useState({})
  const [proofNoteInputs, setProofNoteInputs] = useState({})
  const [editingProof, setEditingProof] = useState({})
  const [activeGoalSheet, setActiveGoalSheet] = useState(null)
  const [activeClosing, setActiveClosing]     = useState(false)
  const [loggingSheet, setLoggingSheet]       = useState(null)
  const [shakingGoals, setShakingGoals]       = useState(new Set())
  const triggerShake = (key) => {
    setShakingGoals(s => new Set(s).add(key))
    setTimeout(() => setShakingGoals(s => { const n = new Set(s); n.delete(key); return n }), 400)
  }
  const [pressedZone, setPressedZone] = useState({})
  const [jiggleZone, setJiggleZone] = useState({})
  const pressZone = (key, side) => setPressedZone(p => ({ ...p, [key]: side }))
  const releaseZone = (key, side) => setPressedZone(p => {
    if (!p[key]) return p
    setJiggleZone(j => ({ ...j, [key]: side ?? p[key] }))
    return { ...p, [key]: null }
  })
  const [loggingClosing, setLoggingClosing]   = useState(false)
  const [catBarEl, setCatBarEl] = useState(null)
  const [catBarInView, setCatBarInView] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null)
  const longPressTimer = useRef(null)
  const [justChecked, setJustChecked] = useState({})
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState('')
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')
  const [nickname, setNickname] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [uiTheme, setUiTheme] = useState('default')
  const [editBannerOpen, setEditBannerOpen] = useState(false)
  const saveTimers = useRef({})
  const confettiFired = useRef(false)

  const sessionDoc = doc(db, 'sessions', sessionId)

  useEffect(() => {
    setProofNoteInputs({})
    setProofOpen({})
  }, [selectedDay])

  // Auto-complete when all goals hit 100%
  useEffect(() => {
    if (!entry || entry.status !== 'active' || !entry.goalItems?.length) return
    const allDone = entry.goalItems.every(g => {
      if (g.type === 'habit') return weekDays.filter(d => logs[dateKey(d)]?.habits?.[g.text]).length >= 7
      if (g.subGoals?.length > 0) return g.subGoals.every(sg => {
        const k = `${g.text}::${sg.text}`
        const total = weekDays.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[k]) || 0), 0)
        return total >= (Number(sg.target) || 1)
      })
      const total = weekDays.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[g.text]) || 0) + (Number(logs[dateKey(d)]?.totals?.[g.text]) || 0), 0)
      return total >= (Number(g.target) || 1)
    })
    if (allDone) updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  }, [logs, entry?.id])

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(sessionDoc, snap => {
      if (snap.exists()) {
        const d = snap.data()
        setMembers(d.names || [])
        setAvatars(d.avatars || {})
        setPenalty(d.penalty ?? 15)
        setBio(d.bios?.[name] || '')
        setStatus(d.statuses?.[name] || '')
        setBannerColorIdx(d.bannerColors?.[name] ?? null)
        setAvatarPhotoUrl(d.avatarPhotos?.[name] || '')
        setBannerImageUrl(d.bannerImages?.[name] || '')
        setNickname(d.nicknames?.[name] || '')
        const savedTheme = d.memberThemes?.[name] || 'default'
        setUiTheme(savedTheme)
        if (isOwner) setGlobalUiTheme(savedTheme)
        const mg = d.memberGoals?.[name]
        setMemberGoals(mg?.length ? mg : null)
      }
    })
  }, [sessionId])

  // Single query — filter weekId + name client-side to avoid composite index requirement
  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllEntries(all)
      const mine = all.find(e =>
        e.weekId === weekId && (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase()
      )
      setEntry(mine || null)
    })
  }, [sessionId, weekId, name])

  useEffect(() => {
    if (!entry?.id) return
    return onSnapshot(collection(db, 'entries', entry.id, 'dailyLogs'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
      setLogsLoaded(true)
    })
  }, [entry?.id])

  useEffect(() => {
    const open = !!(loggingSheet || activeGoalSheet)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [loggingSheet, activeGoalSheet])

  useEffect(() => {
    if (entry?.status !== 'completed' || confettiFired.current) return
    confettiFired.current = true
    const colors = ['#10b981','#3b82f6','#8b5cf6','#f97316','#ec4899','#fbbf24']
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors })
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 60 }), 250)
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 120 }), 400)
  }, [entry?.status])

  // ── derived ──────────────────────────────────────────────────────────────────

  const colorIdx = members.indexOf(name) % AVATAR_COLORS.length
  const color = bannerColorIdx !== null ? BANNER_COLORS[bannerColorIdx] : (AVATAR_COLORS[colorIdx < 0 ? 0 : colorIdx] || AVATAR_COLORS[0])
  const colorHex = AVATAR_HEX[colorIdx < 0 ? 0 : colorIdx] || AVATAR_HEX[0]


  const prevEntry = allEntries
    .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
    .sort((a, b) => b.weekId.localeCompare(a.weekId))[0]

  const streak = (() => {
    const past = allEntries
      .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
    let s = 0
    for (const e of past) { if (e.status === 'completed') s++; else break }
    return s
  })()

  const weekDays = useMemo(() => {
    const [y, m, d] = weekId.split('-').map(Number)
    const monday = new Date(y, m - 1, d) // local midnight — no UTC shift
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      return day
    })
  }, [weekId])

  // ── sheet close helpers (animate out, then unmount) ───────────────────────
  const closeLoggingSheet = () => {
    setLoggingClosing(true)
    setTimeout(() => { setLoggingSheet(null); setLoggingClosing(false) }, 280)
  }
  const closeActiveSheet = () => {
    setActiveClosing(true)
    setTimeout(() => { setActiveGoalSheet(null); setEditingProof({}); setReactionPickerOpen(null); setActiveClosing(false) }, 280)
  }

  // ── logging helpers ────────────────────────────────────────────────────────

  const getDayLog = (key) => logs[key] || {}

  const setHabitDone = (goalText, val) => {
    if (!entry?.id) return
    const localKey = `${selectedDay}__habit__${goalText}`
    setLocalHabits(p => ({ ...p, [localKey]: val }))
    const current = getDayLog(selectedDay)
    const habits = { ...(current.habits || {}), [goalText]: val }
    setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), { ...current, habits })
  }

  const setDayCount = (key, value) => {
    if (!entry?.id) return
    const localKey = `${selectedDay}__count__${key}`
    const newVal = Math.max(0, Math.min(999, value))
    setLocalCounts(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current, counts: { ...(current.counts || {}), [key]: newVal },
      })
    }, 300)
  }

  const setDayTotal = (key, value) => {
    if (!entry?.id) return
    const localKey = `${selectedDay}__total__${key}`
    const newVal = Math.max(0, Math.min(9999, value))
    setLocalTotals(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current, totals: { ...(current.totals || {}), [key]: newVal },
      })
    }, 300)
  }

  const getCountVal = (key) => {
    const localKey = `${selectedDay}__count__${key}`
    return localCounts[localKey] ?? (Number(logs[selectedDay]?.counts?.[key]) || 0)
  }

  const getTotalVal = (key) => {
    const localKey = `${selectedDay}__total__${key}`
    return localTotals[localKey] ?? (Number(logs[selectedDay]?.totals?.[key]) || 0)
  }

  const weeklyCount = (key) => weekDays.reduce((sum, d) => {
    const dk = dateKey(d)
    const localKey = `${dk}__count__${key}`
    return sum + (localCounts[localKey] ?? (Number(logs[dk]?.counts?.[key]) || 0))
  }, 0)

  const weeklyTotal = (key) => weekDays.reduce((sum, d) => {
    const dk = dateKey(d)
    const localKey = `${dk}__total__${key}`
    return sum + (localTotals[localKey] ?? (Number(logs[dk]?.totals?.[key]) || 0))
  }, 0)

  const weeklyHabitDays = (text) =>
    weekDays.filter(d => {
      const dk = dateKey(d)
      const localKey = `${dk}__habit__${text}`
      return localHabits[localKey] ?? logs[dk]?.habits?.[text]
    }).length

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (log.notes?.length > 0) || (log.photos?.length > 0) ||
      Object.values(log.habits || {}).some(Boolean) ||
      Object.values(log.counts || {}).some(v => v > 0) ||
      Object.values(log.totals || {}).some(v => v > 0)
  }

  // ── badges ────────────────────────────────────────────────────────────────
  const badges = []
  const completedWeeks = allEntries.filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.status === 'completed').length
  const daysThisWeek = weekDays.filter(d => dateKey(d) <= todayKey && dayHasActivity(dateKey(d))).length
  if (daysThisWeek >= 7) badges.push({ emoji: '💯', label: 'Perfect week' })
  if (streak >= 5) badges.push({ emoji: '👑', label: 'Streak king' })
  if (completedWeeks >= 4) badges.push({ emoji: '🏆', label: 'Veteran' })
  if (completedWeeks >= 1 && entry?.status === 'active' && allEntries.find(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.status === 'failed')) badges.push({ emoji: '💪', label: 'Comeback' })

  // ── per-goal proof helpers ────────────────────────────────────────────────

  const getGoalProof = (goalText) => logs[selectedDay]?.proof?.[goalText] || {}

  const setGoalProofNote = (goalText, text) => {
    setProofNoteInputs(p => ({ ...p, [goalText]: text }))
    clearTimeout(saveTimers.current[`proof__${goalText}`])
    saveTimers.current[`proof__${goalText}`] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current,
        proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), note: text } }
      })
    }, 500)
  }

  const uploadGoalPhoto = async (goalText, file) => {
    setUploadingPhoto(p => ({ ...p, [goalText]: true }))
    const storageRef = ref(storage, `proofs/${entry.id}/${selectedDay}/${goalText.replace(/[^a-z0-9]/gi, '_')}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    const current = getDayLog(selectedDay)
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), photoUrl: url } }
    })
    setUploadingPhoto(p => ({ ...p, [goalText]: false }))
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleCarryOver = () => {
    const goals = prevEntry?.goalItems || []
    setCarryOverGoals(goals); setGoalsInput(goals); setGoalBuilderKey(k => k + 1)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  // Goals source of truth lives on the session doc; entries are log containers only
  const myGoals = memberGoals || entry?.goalItems || []

  const goalsSummary = (items) => items.map(g =>
    g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
  ).join(', ')

  const persistGoals = async (valid) => {
    // Save to session as persistent goals
    await setDoc(sessionDoc, { memberGoals: { [name]: valid } }, { merge: true })
    // Keep entry's goalItems in sync for history / log context
    if (entry) {
      await updateDoc(doc(db, 'entries', entry.id), { goals: goalsSummary(valid), goalItems: valid })
    } else {
      // Create this week's entry so logging can start immediately
      await addDoc(collection(db, 'entries'), {
        name, nameLower: name.toLowerCase(), weekId, sessionId,
        goals: goalsSummary(valid), goalItems: valid, status: 'active',
        updates: [], createdAt: Timestamp.now(),
      })
    }
  }

  const isGoalTargetValid = (g) => g.type !== 'weekly' ? true
    : g.subGoals?.length > 0 ? g.subGoals.every(sg => Number(sg.target) > 0)
    : Number(g.target) > 0

  const submitGoals = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length || !valid.every(isGoalTargetValid)) return
    setSubmitting(true)
    await persistGoals(valid)
    setSubmitting(false)
  }


  const reorderGoals = async (newItems) => {
    await persistGoals(newItems)
  }

  const QUICK_REACTIONS = ['💪','🔥','👏','❤️','🎉','😤']

  const toggleReaction = async (goalText, emoji) => {
    if (!user) return
    const current = getDayLog(selectedDay)
    const existing = current.proof?.[goalText]?.reactions || []
    const arr = Array.isArray(existing) ? existing : []
    const i = arr.findIndex(r => r.e === emoji)
    let updated
    if (i >= 0) {
      const alreadyReacted = arr[i].users?.includes(user.uid)
      if (alreadyReacted) {
        const users = arr[i].users.filter(u => u !== user.uid)
        updated = users.length === 0
          ? arr.filter((_, j) => j !== i)
          : arr.map((r, j) => j === i ? { ...r, users } : r)
      } else {
        updated = arr.map((r, j) => j === i ? { ...r, users: [...(r.users || []), user.uid] } : r)
      }
    } else {
      updated = [...arr, { e: emoji, users: [user.uid] }]
    }
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), reactions: updated } }
    })
  }

  const sendProofNote = async (goalText) => {
    const text = (proofNoteInputs[goalText] ?? '').trim()
    if (!text) return
    const current = getDayLog(selectedDay)
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), note: text } }
    })
    setProofNoteInputs(p => ({ ...p, [goalText]: '' }))
  }


  const saveDailyColor = async (color) => {
    const current = getDayLog(selectedDay)
    const existing = current.proof?.['daily'] || {}
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), daily: { ...existing, color } }
    })
  }

  const saveDailyNote = async (content, plainText) => {
    const current = getDayLog(selectedDay)
    const existing = current.proof?.['daily'] || {}
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), daily: { ...existing, content, note: plainText } }
    })
  }

  const renderProofSection = (goalText, isFutureDay) => {
    if (isFutureDay || !entry || entry.status === 'failed') return null
    const saved = getGoalProof(goalText)
    const inputVal = proofNoteInputs[goalText] ?? ''
    const uploading = uploadingPhoto[goalText]
    const reactions = Array.isArray(saved.reactions) ? saved.reactions : []
    const hasProof = !!(saved.note || saved.photoUrl)
    const isEditing = !!editingProof[goalText]

    return (
      <div className="mt-3 space-y-2">
        {/* Posted proof card */}
        {hasProof && !isEditing && (
          <div>
            {saved.photoUrl && (
              <div className="relative rounded-xl overflow-hidden mb-2">
                <img src={saved.photoUrl} alt="proof" className="w-full object-cover max-h-52" />
                {isOwner && (
                  <label className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 cursor-pointer transition-colors">
                    {uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={13} />}
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
                  </label>
                )}
              </div>
            )}
            {saved.note && (
              <div className="flex items-start gap-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1">{saved.note}</p>
                {isOwner && (
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <button onClick={() => { setEditingProof(p => ({ ...p, [goalText]: true })); setProofNoteInputs(p => ({ ...p, [goalText]: saved.note || '' })) }}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors">
                      <Pencil size={12} />
                    </button>
                    <label className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors cursor-pointer">
                      {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Camera size={12} />}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
                    </label>
                  </div>
                )}
              </div>
            )}
            {/* Reactions */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {reactions.map(({ e, users: us = [] }) => {
                const reacted = us.includes(user?.uid)
                return (
                  <button key={e} onClick={() => toggleReaction(goalText, e)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                      reacted
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-500 hover:border-emerald-400'
                    }`}>
                    {e}<span className="font-semibold ml-0.5">{us.length}</span>
                  </button>
                )
              })}
              <div className="relative">
                <button onClick={() => setReactionPickerOpen(reactionPickerOpen === goalText ? null : goalText)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border border-dashed border-white text-zinc-400 hover:text-emerald-500 hover:border-emerald-400 transition-all">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  +
                </button>
                {reactionPickerOpen === goalText && (
                  <div className="absolute bottom-7 left-0 flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-1.5 shadow-xl z-20">
                    {QUICK_REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => { toggleReaction(goalText, emoji); setReactionPickerOpen(null) }}
                        className="text-lg hover:scale-125 active:scale-125 transition-transform px-0.5">
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div className="border border-emerald-500 rounded-xl overflow-hidden">
            <textarea
              autoFocus
              value={proofNoteInputs[goalText] ?? ''}
              onChange={e => setProofNoteInputs(p => ({ ...p, [goalText]: e.target.value }))}
              placeholder="What did you do?"
              rows={3}
              style={{ fontSize: 16 }}
              className="w-full bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <button onClick={() => setEditingProof(p => ({ ...p, [goalText]: false }))}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
              <button onClick={() => { sendProofNote(goalText); setEditingProof(p => ({ ...p, [goalText]: false })) }}
                disabled={!(proofNoteInputs[goalText] ?? '').trim()}
                className="text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 px-3 py-1 rounded-lg transition-colors">
                Save
              </button>
            </div>
          </div>
        )}

        {/* Empty state — owner only */}
        {isOwner && !hasProof && !isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingProof(p => ({ ...p, [goalText]: true })); setProofNoteInputs(p => ({ ...p, [goalText]: '' })) }}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <Pencil size={12} /> Add note
            </button>
            <span className="text-zinc-200 dark:text-zinc-700">·</span>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer">
              {uploading
                ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                : <Camera size={12} />
              }
              Add photo
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
            </label>
          </div>
        )}
      </div>
    )
  }


  const saveAvatar = async (emoji) => { await setDoc(sessionDoc, { avatars: { ...avatars, [name]: emoji } }, { merge: true }); setPickingAvatar(false) }
  const saveBio = async (val) => { await setDoc(sessionDoc, { bios: { [name]: val.trim() } }, { merge: true }) }
  const saveStatus = async (val) => { await setDoc(sessionDoc, { statuses: { [name]: val.trim() } }, { merge: true }) }
  const saveNickname = async (val) => { setNickname(val.trim()); await setDoc(sessionDoc, { nicknames: { [name]: val.trim() } }, { merge: true }) }
  const saveBannerColor = async (idx) => { setBannerColorIdx(idx); await setDoc(sessionDoc, { bannerColors: { [name]: idx } }, { merge: true }) }
  const saveUiTheme    = async (t)   => { setUiTheme(t); setGlobalUiTheme(t); await setDoc(sessionDoc, { memberThemes: { [name]: t } }, { merge: true }) }

  const uploadAvatarPhoto = async (file) => {
    setUploadingAvatar(true)
    const storageRef = ref(storage, `avatars/${sessionId}/${name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    setAvatarPhotoUrl(url)
    await setDoc(sessionDoc, { avatarPhotos: { [name]: url } }, { merge: true })
    setUploadingAvatar(false)
  }

  const uploadBannerImage = async (file) => {
    setUploadingBanner(true)
    const storageRef = ref(storage, `banners/${sessionId}/${name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    setBannerImageUrl(url)
    await setDoc(sessionDoc, { bannerImages: { [name]: url } }, { merge: true })
    setUploadingBanner(false)
  }

  // ── chart ─────────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(23, 59, 59, 0)
  const elapsed = weekDays.filter(d => d <= today)
  const chartCategories = DAY_LABELS.slice(0, elapsed.length)

  const getGoalDailyPct = (goal) =>
    elapsed.map((_, dayIdx) => {
      const daysUpTo = weekDays.slice(0, dayIdx + 1)
      if (goal.type === 'habit') {
        const checked = daysUpTo.filter(d => logs[dateKey(d)]?.habits?.[goal.text]).length
        return Math.round(checked / 7 * 100)
      }
      const done = daysUpTo.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[goal.text]) || 0), 0)
      return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
    })

  const getSubGoalDailyPct = (goalText, sg) =>
    elapsed.map((_, dayIdx) => {
      const daysUpTo = weekDays.slice(0, dayIdx + 1)
      const k = `${goalText}::${sg.text}`
      const done = daysUpTo.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[k]) || 0), 0)
      return Math.round(Math.min(1, done / (Number(sg.target) || 1)) * 100)
    })

  const chartSeries = useMemo(() => {
    let colorIdx = 0
    return myGoals.flatMap(g => {
      if (g.subGoals?.length > 0) {
        return g.subGoals.map(sg => ({
          name: sg.text,
          color: GOAL_COLORS[colorIdx++ % GOAL_COLORS.length],
          data: getSubGoalDailyPct(g.text, sg),
        }))
      }
      return [{ name: g.text, color: GOAL_COLORS[colorIdx++ % GOAL_COLORS.length], data: getGoalDailyPct(g) }]
    })
  }, [logs, myGoals])

  const chartOptions = useMemo(() => ({
    chart: { type: 'areaspline', backgroundColor: 'transparent', height: 160, spacing: [8,8,8,0], style: { fontFamily: 'inherit' } },
    title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
    xAxis: { categories: chartCategories, labels: { style: { color: '#71717a', fontSize: '10px' } }, lineColor: '#27272a', tickColor: 'transparent', gridLineColor: 'transparent' },
    yAxis: { min: 0, max: 100, title: { text: null }, labels: { format: '{value}%', style: { color: '#71717a', fontSize: '10px' } }, gridLineColor: '#27272a', tickPositions: [0, 50, 100] },
    // followTouchMove:false lets a tap show the tooltip but stops the chart
    // from capturing touch-drag, which otherwise blocks page scroll on mobile
    tooltip: { shared: true, followTouchMove: false, backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 12, style: { color: '#e4e4e7', fontSize: '11px' }, pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}%</b><br/>' },
    plotOptions: { areaspline: { fillOpacity: 0.12, lineWidth: 2, marker: { enabled: true, radius: 3, lineWidth: 0 } } },
    series: chartSeries,
  }), [chartSeries, chartCategories])

  // ── cat bar shared state (used by main bar + sticky strip) ──────────────
  const catPct = useMemo(() => {
    if (!myGoals.length || !logsLoaded) return 0
    return myGoals.reduce((sum, g) => {
      if (g.type === 'habit') return sum + Object.values(logs).filter(d => d.habits?.[g.text]).length / 7
      if (g.subGoals?.length > 0) {
        const r = g.subGoals.map(sg => {
          const k = `${g.text}::${sg.text}`
          const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[k]) || 0), 0)
          return Math.min(1, done / (Number(sg.target) || 1))
        })
        return sum + r.reduce((s, v) => s + v, 0) / r.length
      }
      const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[g.text]) || 0), 0)
      return sum + Math.min(1, done / (Number(g.target) || 1))
    }, 0) / myGoals.length
  }, [myGoals, logs, logsLoaded])

  const catAtlasUrl = useMemo(() =>
    CAT_ATLASES[typeof entry?.catColor === 'number' ? entry.catColor : 0],
  [entry?.catColor])

  useEffect(() => {
    if (!catBarEl) return
    const obs = new IntersectionObserver(([e]) => setCatBarInView(e.isIntersecting), { threshold: 0.1 })
    obs.observe(catBarEl)
    return () => obs.disconnect()
  }, [catBarEl])

  // ── loading skeleton ──────────────────────────────────────────────────────

  if (entry === undefined) return (
    <div className="flex flex-col space-y-4 animate-pulse">
      <div className="h-5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
      <div className="h-40 -mx-4 bg-zinc-100 dark:bg-zinc-800 rounded-none" />
      <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />)}</div>
      <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
    </div>
  )

  const daysLogged = Object.values(logs).filter(log =>
    Object.values(log?.habits || {}).some(Boolean) ||
    Object.values(log?.counts || {}).some(v => v > 0) ||
    Object.values(log?.totals || {}).some(v => v > 0)
  ).length

  const selectedDayDate = weekDays.find(d => dateKey(d) === selectedDay)
  const selectedDayLabel = selectedDayDate
    ? selectedDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  return (
    <div className="flex flex-col space-y-4 -mx-4 px-4 -mt-5 pb-4">

      {/* Banner */}
      <div className="-mx-4">
        {/* Cover image */}
        <div className={`bg-gradient-to-br ${color} h-28 relative overflow-hidden`}>
          {bannerImageUrl && <img src={bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

          {/* Owner actions — bottom-right of banner */}
          {isOwner && (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
              {myGoals.length > 0 && (
                <button onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}/goals`)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95">
                  🎯 Goals
                </button>
              )}
              <button onClick={() => { setStatusInput(status); setBioInput(bio); setNicknameInput(nickname); setEditBannerOpen(true) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95">
                <Pencil size={11} /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Profile info — avatar overlaps banner */}
        <div className="px-4 pb-3">
          <div className="flex items-end justify-between -mt-7 mb-3">
            {/* Avatar */}
            <button onClick={() => setPickingAvatar(v => !v)}
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} ring-4 ring-zinc-50 dark:ring-zinc-950 flex items-center justify-center relative group transition-all hover:scale-105 active:scale-95 shrink-0 shadow-lg overflow-hidden`}>
              {avatarPhotoUrl
                ? <img src={avatarPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : avatars[name]
                  ? <span className="text-3xl">{avatars[name]}</span>
                  : <span className="text-white font-black text-3xl leading-none">{name[0].toUpperCase()}</span>}
              <span className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Pencil size={11} className="text-white" />
              </span>
            </button>

            {/* Badges top-right */}
            <div className="flex items-center gap-1 pb-1 flex-wrap justify-end">
              {entry?.status === 'completed' && <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-full">✅ Done!</span>}
              {entry?.status === 'failed'    && <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded-full">❌ Failed</span>}
              {streak >= 2 && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-full">🔥 {streak}w streak</span>}
              {badges.map((b, i) => <span key={i} title={b.label} className="text-sm cursor-default">{b.emoji}</span>)}
            </div>
          </div>

          <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-none">{nickname || name}</h2>
          {status && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-snug">{status}</p>}
          {bio && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 leading-snug">{bio}</p>}
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">{formatWeekLabel(weekId)}</p>

          <div ref={setCatBarEl}>
            {myGoals.length > 0 && logsLoaded && (
              <CatProgressBar pct={catPct} atlasUrl={catAtlasUrl} sheetOpen={!!(loggingSheet || activeGoalSheet)} gaming={uiTheme === 'gaming'} />
            )}
          </div>
        </div>
      </div>




      {/* No goals yet */}
      {!myGoals.length && isOwner && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Lock in your goals for this week 🔒</p>
            {prevEntry?.goalItems?.length > 0 && (
              <button onClick={handleCarryOver} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors">
                ↩ Last week's
              </button>
            )}
          </div>
          <GoalBuilder key={goalBuilderKey} initialGoals={carryOverGoals} onChange={setGoalsInput} />
          {goalsInput.some(g => g.text.trim() && !isGoalTargetValid(g)) && (
            <p className="text-xs text-amber-500 -mt-2">Give every count goal a target of at least 1 before locking in</p>
          )}
          <button onClick={submitGoals}
            disabled={submitting || !goalsInput.some(g => g.text.trim()) || !goalsInput.filter(g => g.text.trim()).every(isGoalTargetValid)}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 transition-all">
            {submitting ? 'Locking in...' : 'Lock in goals 🔒'}
          </button>
        </div>
      )}

      {(entry || myGoals.length > 0) && (
        <>
          {/* Day strip */}
          <div className="flex items-stretch bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden">
            {weekDays.map((day, i) => {
              const key = dateKey(day)
              const isToday    = key === todayKey
              const isSelected = key === selectedDay
              const isFuture   = key > todayKey
              const hasActivity = dayHasActivity(key)
              return (
                <button key={key} onClick={() => !isFuture && setSelectedDay(key)}
                  disabled={isFuture}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all disabled:opacity-30 ${
                    isSelected
                      ? 'bg-zinc-800 dark:bg-white'
                      : isToday
                        ? 'bg-zinc-200 dark:bg-zinc-700'
                        : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                  }`}>
                  <span className={`text-[10px] font-bold uppercase leading-none ${
                    isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {DAY_LABELS[i][0]}
                  </span>
                  <span className={`text-xs font-black leading-none ${
                    isSelected ? 'text-white dark:text-zinc-900' : isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-300'
                  }`}>
                    {day.getDate()}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${hasActivity ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>

          {/* Chart */}
          {myGoals.length > 0 && (
            <div className="bg-zinc-100/40 dark:bg-zinc-800/40 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Progress this week</p>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {chartSeries.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goal rows */}
          {myGoals.length > 0 && (() => {
            const goalDone = (goal) => {
              const habitLocalKey = `${selectedDay}__habit__${goal.text}`
              const checked = goal.type === 'habit'
                ? !!(localHabits[habitLocalKey] ?? logs[selectedDay]?.habits?.[goal.text])
                : false
              const wv = goal.type !== 'habit' && !goal.subGoals?.length ? weeklyCount(goal.text) : 0
              const tgt = Number(goal.target) || 0
              return goal.type === 'habit' ? checked
                : goal.subGoals?.length > 0
                  ? goal.subGoals.every(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) })
                  : tgt > 0 && wv >= tgt
            }
            return (
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${uiTheme === 'gaming' ? '' : 'text-zinc-400 dark:text-zinc-500'}`}
                  style={uiTheme === 'gaming' ? { color: '#00ff88', letterSpacing: '0.18em' } : undefined}>
                  {uiTheme === 'gaming' ? '⚡ ' : ''}{selectedDay === todayKey ? (uiTheme === 'gaming' ? 'ACTIVE MISSIONS' : 'Today') : selectedDayLabel}
                </p>

                <div className="space-y-1.5">
                  {myGoals.map((goal) => {
                    const isFutureDay = selectedDay > todayKey
                    const done = goalDone(goal)
                    const weekVal = goal.type !== 'habit' && !goal.subGoals?.length ? weeklyCount(goal.text) : 0
                    const tgt = Number(goal.target) || 0

                    const rightLabel = goal.type === 'habit'
                      ? `${weeklyHabitDays(goal.text)}/7`
                      : goal.subGoals?.length > 0
                        ? `${goal.subGoals.filter(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) }).length}/${goal.subGoals.length}`
                        : tgt > 0 ? `${weekVal}/${tgt}${goal.unit ? ` ${goal.unit}` : ''}` : null

                    const barPct = goal.type === 'habit'
                      ? weeklyHabitDays(goal.text) / 7
                      : goal.subGoals?.length > 0
                        ? goal.subGoals.filter(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) }).length / goal.subGoals.length
                        : tgt > 0 ? Math.min(1, weekVal / tgt) : 0

                    const isBreakdown = goal.subGoals?.length > 0
                    const todayVal = !isBreakdown && goal.type !== 'habit' ? getCountVal(goal.text) : 0
                    const breakdownTodayVal = isBreakdown ? goal.subGoals.reduce((s, sg) => s + getCountVal(`${goal.text}::${sg.text}`), 0) : 0

                    // Only green (or neutral, pre-completion) — no red/amber/gold tiers.
                    // Fill gradients match the design exactly: a muted green while in
                    // progress, brightening once the goal is complete.
                    const stateColors = (pct, isDone) => {
                      if (isDone || pct >= 1) return {
                        fill: 'linear-gradient(90deg, oklch(0.68 0.18 152), oklch(0.78 0.19 150))',
                        text: 'text-emerald-800 dark:text-emerald-300',
                        label: 'text-emerald-600 dark:text-emerald-400',
                        chevron: 'text-emerald-300 dark:text-emerald-700',
                        todayPill: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15',
                        checkFull: 'bg-emerald-500 border-emerald-500',
                        checkOutline: 'border-emerald-400 dark:border-emerald-500',
                        checkStroke: '#10b981',
                        accent: '#10b981',
                      }
                      return {
                        fill: 'linear-gradient(90deg, oklch(0.5 0.12 152), oklch(0.62 0.16 152))',
                        text: 'text-zinc-800 dark:text-zinc-200',
                        label: 'text-zinc-500 dark:text-zinc-400',
                        chevron: 'text-zinc-300 dark:text-zinc-600',
                        todayPill: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                        checkFull: 'bg-emerald-500 border-emerald-500',
                        checkOutline: 'border-emerald-400 dark:border-emerald-500',
                        checkStroke: '#10b981',
                        accent: '#71717a',
                      }
                    }

                    const isDoneForColor = goal.type === 'habit' ? barPct >= 1 : done
                    const isGoalMet = isDoneForColor
                    const c = stateColors(barPct, isDoneForColor)

                    const canLog = isOwner && !isFutureDay

                    const isCounter = canLog && goal.type !== 'habit' && !isBreakdown
                    const isHabitLoggable = canLog && goal.type === 'habit' && !isFutureDay

                    if (isBreakdown) return (
                      <div key={goal.text} className="space-y-1 pb-[2px]">
                        {/* Minimal label — not itself a button, just names the group below */}
                        <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 truncate">{goal.text}</p>

                        {/* Sub-goal rows — same size/style as every other goal button */}
                        <div className="space-y-1">
                          {goal.subGoals.map((sg, si) => {
                              const k = `${goal.text}::${sg.text}`
                              const sv = weeklyCount(k)
                              const todayV = getCountVal(k)
                              const st = Number(sg.target) || 0
                              const sp = st ? Math.min(1, sv / st) : 0
                              const sdone = st > 0 && sv >= st
                              const sc = stateColors(sp, sdone)
                              return (
                                <div key={si} className={`relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${shakingGoals.has(k) ? 'row-shake' : ''}`}>
                                  <div className="absolute inset-y-0 left-0 rounded-xl"
                                    style={{ width: `${sp * 100}%`, background: sc.fill, transition: 'width 420ms cubic-bezier(0.34, 1.25, 0.64, 1), background 0.3s ease' }} />
                                  {canLog && (
                                    <>
                                      <button aria-label="subtract"
                                        onClick={() => setDayCount(k, Math.max(0, todayV - 1))}
                                        onPointerDown={() => pressZone(k, 'left')}
                                        onPointerUp={() => releaseZone(k)}
                                        onPointerLeave={() => releaseZone(k)}
                                        className="absolute inset-y-0 left-0 w-1/2 z-10 rounded-l-xl" />
                                      <button aria-label="add"
                                        onClick={() => {
                                          if (st > 0 && sv >= st) triggerShake(k)
                                          setDayCount(k, Math.min(999, todayV + 1))
                                        }}
                                        onPointerDown={() => pressZone(k, 'right')}
                                        onPointerUp={() => releaseZone(k)}
                                        onPointerLeave={() => releaseZone(k)}
                                        className="absolute inset-y-0 right-0 w-1/2 z-10 rounded-r-xl" />
                                    </>
                                  )}
                                  <div className="relative w-full flex items-center justify-between gap-2 px-3 py-2.5 pointer-events-none">
                                    <span className="flex items-center gap-2.5 min-w-0">
                                      {canLog && (
                                        <span
                                          onAnimationEnd={() => setJiggleZone(j => ({ ...j, [k]: null }))}
                                          className={`w-7 h-7 shrink-0 rounded-full bg-zinc-900/10 dark:bg-white/10 text-zinc-600 dark:text-white/75 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[k] === 'left' ? 'badge-squash' : jiggleZone[k] === 'left' ? 'badge-slime-pop' : ''}`}>−</span>
                                      )}
                                      <span className={`text-sm truncate ${sc.text}`}>{sg.text}</span>
                                    </span>
                                    <span className="flex items-center gap-2.5 shrink-0">
                                      {todayV > 0 && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${sc.todayPill}`}>+{todayV} today</span>
                                      )}
                                      <span className={`font-mono text-sm font-bold tabular-nums shrink-0 ${sc.label}`}>{sv}{st ? `/${st}` : ''}{sg.unit ? ` ${sg.unit}` : ''}</span>
                                      {canLog && (
                                        <span
                                          onAnimationEnd={() => setJiggleZone(j => ({ ...j, [k]: null }))}
                                          className={`w-7 h-7 shrink-0 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[k] === 'right' ? 'badge-squash' : jiggleZone[k] === 'right' ? 'badge-slime-pop' : ''}`}>+</span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )

                    return (
                      <div key={goal.text} className="relative space-y-1 pb-[2px]">
                        {/* Parent card */}
                        <div className={`relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${shakingGoals.has(goal.text) ? 'row-shake' : ''}`}>
                          <div className="absolute inset-y-0 left-0 rounded-xl"
                            style={{ width: `${Math.min(1, barPct) * 100}%`, background: c.fill, transition: 'width 420ms cubic-bezier(0.34, 1.25, 0.64, 1), background 0.3s ease' }} />

                          {/* Split tap zones — each half presses in like a real button when tapped */}
                          {isCounter && (
                            <>
                              <button aria-label="subtract"
                                onClick={() => setDayCount(goal.text, Math.max(0, todayVal - 1))}
                                onPointerDown={() => pressZone(goal.text, 'left')}
                                onPointerUp={() => releaseZone(goal.text)}
                                onPointerLeave={() => releaseZone(goal.text)}
                                className="absolute inset-y-0 left-0 w-1/2 z-10 rounded-l-xl" />
                              <button aria-label="add"
                                onClick={() => {
                                  if (tgt > 0 && weekVal >= tgt) triggerShake(goal.text)
                                  setDayCount(goal.text, Math.min(999, todayVal + 1))
                                }}
                                onPointerDown={() => pressZone(goal.text, 'right')}
                                onPointerUp={() => releaseZone(goal.text)}
                                onPointerLeave={() => releaseZone(goal.text)}
                                className="absolute inset-y-0 right-0 w-1/2 z-10 rounded-r-xl" />
                            </>
                          )}
                          {isHabitLoggable && (
                            <>
                              <button aria-label="mark not done"
                                onClick={() => setHabitDone(goal.text, false)}
                                onPointerDown={() => done && pressZone(goal.text, 'left')}
                                onPointerUp={() => releaseZone(goal.text)}
                                onPointerLeave={() => releaseZone(goal.text)}
                                className="absolute inset-y-0 left-0 w-1/2 z-10 rounded-l-xl" />
                              <button aria-label="mark done"
                                onClick={() => setHabitDone(goal.text, true)}
                                onPointerDown={() => !done && pressZone(goal.text, 'right')}
                                onPointerUp={() => releaseZone(goal.text)}
                                onPointerLeave={() => releaseZone(goal.text)}
                                className="absolute inset-y-0 right-0 w-1/2 z-10 rounded-r-xl" />
                            </>
                          )}

                          {/* Visual content */}
                          {isCounter ? (
                            <div className="relative w-full flex items-center justify-between gap-2 px-3 py-2.5 pointer-events-none">
                              <span className="flex items-center gap-2.5 min-w-0">
                                <span
                                  onAnimationEnd={() => setJiggleZone(j => ({ ...j, [goal.text]: null }))}
                                  className={`w-7 h-7 shrink-0 rounded-full bg-zinc-900/10 dark:bg-white/10 text-zinc-600 dark:text-white/75 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[goal.text] === 'left' ? 'badge-squash' : jiggleZone[goal.text] === 'left' ? 'badge-slime-pop' : ''}`}>−</span>
                                <span className={`text-sm truncate ${c.text}`}>{goal.text}</span>
                              </span>
                              <span className="flex items-center gap-2.5 shrink-0">
                                {todayVal > 0 && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${c.todayPill}`}>+{todayVal} today</span>
                                )}
                                {rightLabel && <span className={`font-mono text-sm font-bold tabular-nums ${c.label}`}>{rightLabel}</span>}
                                <span
                                  onAnimationEnd={() => setJiggleZone(j => ({ ...j, [goal.text]: null }))}
                                  className={`w-7 h-7 shrink-0 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[goal.text] === 'right' ? 'badge-squash' : jiggleZone[goal.text] === 'right' ? 'badge-slime-pop' : ''}`}>+</span>
                              </span>
                            </div>
                          ) : (
                            <div className="relative w-full flex items-center gap-2.5 px-3 py-2.5 pointer-events-none">
                              {isHabitLoggable && (
                                <span
                                  onAnimationEnd={() => setJiggleZone(j => ({ ...j, [goal.text]: null }))}
                                  className={`w-7 h-7 shrink-0 rounded-full bg-zinc-900/10 dark:bg-white/10 text-zinc-600 dark:text-white/75 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[goal.text] === 'left' ? 'badge-squash' : jiggleZone[goal.text] === 'left' ? 'badge-slime-pop' : `${done ? 'opacity-100' : 'opacity-30'}`}`}>−</span>
                              )}
                              <span className={`flex-1 text-sm truncate ${c.text}`}>{goal.text}</span>
                              {done && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${c.todayPill}`}>+1 today</span>
                              )}
                              {rightLabel && <span className={`text-[11px] tabular-nums shrink-0 ${c.label}`}>{rightLabel}</span>}
                              {isHabitLoggable && (
                                <span
                                  onAnimationEnd={() => setJiggleZone(j => ({ ...j, [goal.text]: null }))}
                                  className={`w-7 h-7 shrink-0 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-semibold leading-none ${pressedZone[goal.text] === 'right' ? 'badge-squash' : jiggleZone[goal.text] === 'right' ? 'badge-slime-pop' : `${done ? 'opacity-30' : 'opacity-100'}`}`}>+</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <DailyNote
                  daily={getGoalProof('daily')}
                  canEdit={isOwner && selectedDay <= todayKey}
                  dayLabel={selectedDay === todayKey ? 'Today' : selectedDayLabel}
                  onSave={saveDailyNote}
                  onColorSave={saveDailyColor}
                  uploadingPhoto={!!uploadingPhoto['daily']}
                  onPhotoUpload={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto('daily', f); e.target.value = '' }}
                />
              </div>
            )
          })()}

          {/* Logging bottom sheet */}
          {loggingSheet && (() => {
            const goal = loggingSheet
            const isFutureDay = selectedDay > todayKey
            const close = closeLoggingSheet
            const sheetClass = "fixed inset-0 z-50 flex items-end justify-center"
            const innerClass = `relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg flex flex-col shadow-2xl ${loggingClosing ? 'slide-down' : 'slide-up'}`
            const sheetHeader = (label, title) => (
              <div className="px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-black text-zinc-900 dark:text-white">{title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
                  </div>
                  <button onClick={close} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors -mt-0.5"><X size={16} /></button>
                </div>
              </div>
            )

            // ── breakdown ──────────────────────────────────────────────────
            if (goal.subGoals?.length > 0) {
              return createPortal(
                <div className={sheetClass} onClick={close}>
                  <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-[280ms] ${loggingClosing ? 'opacity-0' : ''}`} />
                  <div className={innerClass} style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                    {sheetHeader('Breakdown', goal.text)}
                    <div className="px-5 pb-8 pt-4 flex-1 overflow-y-auto overscroll-contain space-y-3">
                      {goal.subGoals.map((sg, si) => {
                        const k = `${goal.text}::${sg.text}`
                        const weekVal = weeklyCount(k)
                        const todayVal = getCountVal(k)
                        const tgt = Number(sg.target) || 0
                        const pct = tgt ? Math.min(1, weekVal / tgt) : 0
                        const done = tgt > 0 && weekVal >= tgt
                        return (
                          <div key={si} className={`rounded-2xl p-4 border ${done ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-100 dark:border-zinc-800'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-bold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-800 dark:text-zinc-100'}`}>{sg.text}</span>
                              <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                                {weekVal}{tgt ? `/${tgt}` : ''}{sg.unit ? ` ${sg.unit}` : ''} wk
                              </span>
                            </div>
                            {tgt > 0 && <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3"><div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-500'}`} style={{ width: `${pct * 100}%` }} /></div>}
                            {isOwner && !isFutureDay && (
                              <div className="flex items-center gap-3">
                                <button onClick={() => setDayCount(k, Math.max(0, todayVal - 1))}
                                  className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-bold flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 active:scale-90 transition-all select-none">−</button>
                                <div className="flex-1 text-center">
                                  <span className="text-xl font-black tabular-nums text-zinc-900 dark:text-white">{todayVal}</span>
                                  {sg.unit && <span className="text-xs text-zinc-400 ml-1.5">{sg.unit}</span>}
                                </div>
                                <button onClick={() => setDayCount(k, Math.min(999, todayVal + 1))}
                                  className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold flex items-center justify-center active:scale-90 transition-all select-none">+</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              , document.body)
            }

            // ── count ──────────────────────────────────────────────────────
            const weekVal = weeklyCount(goal.text)
            const tgt = Number(goal.target) || 0
            const pct = tgt ? Math.min(1, weekVal / tgt) : 0
            const done = tgt > 0 && weekVal >= tgt
            const todayCount = getCountVal(goal.text)
            return createPortal(
              <div className={sheetClass} onClick={close}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className={innerClass} style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                  {sheetHeader('Log progress', goal.text)}
                  {tgt > 0 && (
                    <div className="px-5 pt-2 pb-3">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Weekly total</span>
                        <span className={`text-sm font-black tabular-nums ${done ? 'text-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {weekVal} <span className="font-normal text-zinc-400">/ {tgt}{goal.unit ? ` ${goal.unit}` : ''}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-500'}`} style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5" />
                  {isOwner && !isFutureDay ? (
                    <div className="px-5 py-6 flex items-center gap-4">
                      <button onClick={() => setDayCount(goal.text, Math.max(0, todayCount - 1))}
                        className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-lg font-bold flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">−</button>
                      <div className="flex-1 text-center">
                        <p className="text-4xl font-black tabular-nums text-zinc-900 dark:text-white leading-none">{todayCount}</p>
                        <p className="text-xs text-zinc-400 mt-1.5">{goal.unit ? `${goal.unit} today` : 'today'}</p>
                      </div>
                      <button onClick={() => setDayCount(goal.text, Math.min(999, todayCount + 1))}
                        className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-all select-none">+</button>
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center text-sm text-zinc-400">{isFutureDay ? "Can't log a future day" : 'View only'}</div>
                  )}
                </div>
              </div>
            , document.body)
          })()}

          {/* Goal bottom sheet */}
          {activeGoalSheet && (() => {
            const goal = activeGoalSheet
            const proof = getGoalProof(goal.text)
            const uploading = uploadingPhoto[goal.text]
            const isEditing = !!editingProof[goal.text]
            const closeProof = closeActiveSheet

            return createPortal(
              <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={closeProof}>
                <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-[280ms] ${activeClosing ? 'opacity-0' : ''}`} />
                <div className={`relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto ${activeClosing ? 'slide-down' : 'slide-up'}`} onClick={e => e.stopPropagation()}>
                  <div className="flex justify-center pt-3"><div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" /></div>

                  <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Add proof</p>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">{goal.text}</h2>
                    </div>
                    <button onClick={closeProof} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-0.5"><X size={16} /></button>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5 mt-3" />

                  <div className="px-5 py-4 pb-8">
                    {isEditing ? (
                      <div className="border border-emerald-500/50 dark:border-emerald-500/30 rounded-2xl overflow-hidden">
                        <textarea autoFocus value={proofNoteInputs[goal.text] ?? ''} onChange={e => setProofNoteInputs(p => ({ ...p, [goal.text]: e.target.value }))}
                          placeholder="What did you do?" rows={4} style={{ fontSize: 16 }}
                          className="w-full bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none resize-none" />
                        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
                          <button onClick={() => setEditingProof(p => ({ ...p, [goal.text]: false }))} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-3 py-1.5">Cancel</button>
                          <button onClick={() => { sendProofNote(goal.text); setEditingProof(p => ({ ...p, [goal.text]: false })); setActiveGoalSheet(null) }}
                            disabled={!(proofNoteInputs[goal.text] ?? '').trim()}
                            className="text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 px-4 py-1.5 rounded-xl transition-colors">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <button onClick={() => { setEditingProof(p => ({ ...p, [goal.text]: true })); setProofNoteInputs(p => ({ ...p, [goal.text]: proof.note || '' })) }}
                          className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-100 dark:border-zinc-800 transition-colors text-left">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                            <Pencil size={13} className="text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Add a note</p>
                            {proof.note && <p className="text-xs text-zinc-400 truncate mt-0.5">{proof.note}</p>}
                          </div>
                        </button>
                        <label className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                            {uploading ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Camera size={13} className="text-zinc-500 dark:text-zinc-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{proof.photoUrl ? 'Replace photo' : 'Add a photo'}</p>
                          </div>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { uploadGoalPhoto(goal.text, f); setActiveGoalSheet(null) } e.target.value = '' }} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            , document.body)
          })()}

          {/* Proof log */}
          {entry?.updates?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Progress log</p>
              {entry.updates.map((u, i) => {
                const reactions = u.reactions || {}
                const toggleReaction = async (emoji) => {
                  const snap = await getDoc(doc(db, 'entries', entry.id))
                  const updates = snap.data().updates || []
                  updates[i] = { ...updates[i], reactions: { ...(updates[i].reactions || {}), [emoji]: ((updates[i].reactions?.[emoji] || 0) + 1) % 99 } }
                  await updateDoc(doc(db, 'entries', entry.id), { updates })
                }
                return (
                  <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex gap-3">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{u.text}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">{formatTimestamp(u.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 pl-5">
                      {['🔥','💪','👏','❤️'].map(emoji => {
                        const count = reactions[emoji] || 0
                        return (
                          <button key={emoji} onClick={() => toggleReaction(emoji)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-sm transition-all active:scale-95 ${
                              count > 0 ? 'bg-zinc-100 dark:bg-zinc-800 border-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}>
                            {emoji}
                            {count > 0 && <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}


        </>
      )}

      {/* Sticky cat strip — shown when main bar is scrolled out of view */}
      {!catBarInView && myGoals.length > 0 && logsLoaded && createPortal(
        (() => {
          const sheetOpen = !!(loggingSheet || activeGoalSheet)
          const dc = catPct >= 1 ? '#2dd4bf' : catPct >= 0.5 ? '#f97316' : '#8b5cf6'
          const r  = Math.round(catPct * 100)
          return (
            <div className="fixed top-0 left-0 right-0 z-40 cat-sticky-strip bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800">
              <div className="max-w-lg mx-auto flex items-center gap-2 px-4"
                style={{ paddingTop: 'max(8px, env(safe-area-inset-top))', paddingBottom: 8 }}>
                <div className="flex-1">
                  <CatProgressBar pct={catPct} atlasUrl={catAtlasUrl} sheetOpen={sheetOpen} compact gaming={uiTheme === 'gaming'} />
                </div>
                <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: dc }}>{r}%</span>
              </div>
            </div>
          )
        })(),
        document.body
      )}

      {/* Edit Banner sheet */}
      {editBannerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditBannerOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg slide-up pb-safe" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">Edit Profile</h3>
                <button onClick={() => setEditBannerOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={16} /></button>
              </div>

              {/* Name + Status row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Name</label>
                  <input value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
                    maxLength={30} placeholder={name} style={{ fontSize: 16 }}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Status</label>
                  <input value={statusInput} onChange={e => setStatusInput(e.target.value)}
                    maxLength={40} placeholder="Vibe this week…" style={{ fontSize: 16 }}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all" />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Bio</label>
                <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                  maxLength={120} rows={2} placeholder="Short bio…" style={{ fontSize: 16 }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none" />
              </div>

              {/* Banner image */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Banner Image</label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${bannerImageUrl ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800'}`}>
                  {uploadingBanner
                    ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    : <Camera size={13} className="text-zinc-400 shrink-0" />}
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 flex-1">{bannerImageUrl ? 'Change photo' : 'Upload photo'}</span>
                  {bannerImageUrl && <button type="button" onClick={e => { e.preventDefault(); setBannerImageUrl(''); setDoc(sessionDoc, { bannerImages: { [name]: '' } }, { merge: true }) }} className="text-xs text-zinc-400 hover:text-red-400 transition-colors">Remove</button>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f); e.target.value = '' }} />
                </label>
                {bannerImageUrl && <img src={bannerImageUrl} alt="" className="w-full h-12 object-cover rounded-lg" />}
              </div>

              {/* Banner color */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {BANNER_COLORS.map((_, i) => (
                    <button key={i} onClick={() => saveBannerColor(i)}
                      className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${bannerColorIdx === i ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500 dark:ring-offset-zinc-900 scale-110' : ''}`}
                      style={{ background: BANNER_COLOR_PREVIEWS[i] }} />
                  ))}
                </div>
              </div>

              {/* Cat color */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Cat Color</label>
                <div className="flex gap-3">
                  {CAT_ATLASES.map((a, i) => {
                    const catIdx = typeof entry?.catColor === 'number' ? entry.catColor : 0
                    return (
                      <button key={i} onClick={() => entry?.id && updateDoc(doc(db, 'entries', entry.id), { catColor: i })}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${catIdx === i ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-100'}`}>
                        <div style={{
                          width: FRAME_W, height: FRAME_H,
                          backgroundImage: `url(${a})`,
                          backgroundSize: `${ATLAS_W}px ${ATLAS_H}px`,
                          backgroundPosition: `0px -${FRAME_H * 2}px`, // row 2 = sleep4-L
                          backgroundRepeat: 'no-repeat',
                          imageRendering: 'pixelated',
                        }} />
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{CAT_LABELS[i]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Theme</label>
                <div className="flex gap-2">
                  {[
                    { value: 'default', label: '🎨', name: 'Default' },
                    { value: 'gaming',  label: '🎮', name: 'Gaming' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => saveUiTheme(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        uiTheme === opt.value
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}>
                      <span>{opt.label}</span>{opt.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <button onClick={() => { saveBio(bioInput); saveStatus(statusInput); saveNickname(nicknameInput); setEditBannerOpen(false) }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-2xl transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Avatar picker */}
      {pickingAvatar && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4" onClick={() => setPickingAvatar(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl p-4 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Pick your avatar</p>
              <button onClick={() => setPickingAvatar(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={16} /></button>
            </div>

            {/* Photo upload */}
            <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors mb-3 ${avatarPhotoUrl ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
              {uploadingAvatar
                ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                : <Camera size={15} className="text-zinc-400 shrink-0" />}
              <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-1">{avatarPhotoUrl ? 'Change photo' : 'Upload a photo'}</span>
              {avatarPhotoUrl && <button type="button" onClick={e => { e.preventDefault(); setAvatarPhotoUrl(''); setDoc(sessionDoc, { avatarPhotos: { [name]: '' } }, { merge: true }) }} className="text-xs text-zinc-400 hover:text-red-400 transition-colors">Remove</button>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { uploadAvatarPhoto(f); setPickingAvatar(false) } e.target.value = '' }} />
            </label>

            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-2">Or pick an emoji</p>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => saveAvatar(emoji)}
                  className={`text-2xl rounded-xl p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90 ${avatars[name] === emoji ? 'bg-zinc-200 dark:bg-zinc-700 ring-2 ring-emerald-500' : ''}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
