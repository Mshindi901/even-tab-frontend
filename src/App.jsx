import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const token = sessionStorage.getItem('token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && token) {
      sessionStorage.removeItem('token')
      window.dispatchEvent(new Event('eventab:unauthorized'))
    }
    const error = new Error(result.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return result
}

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14Z" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18" /><path d="M16 15h.01" /><path d="M7 5V3h10v2" /></>,
  }

  return <svg {...common}>{paths[name] || paths.spark}</svg>
}

function Brand({ light = false }) {
  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="Eventab home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>eventab<span className="brand-period">.</span></span>
    </Link>
  )
}

function currencyAmount(amount, currency = 'KES') {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${currency} 0`
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function balanceDisplay(balance, currency) {
  const value = Number(balance)
  if (balance === null || balance === undefined || !Number.isFinite(value)) {
    return { label: 'Not calculated', tone: 'pending' }
  }
  if (value > 0) return { label: `+${currencyAmount(value, currency)}`, tone: 'positive' }
  if (value < 0) return { label: `−${currencyAmount(Math.abs(value), currency)}`, tone: 'negative' }
  return { label: currencyAmount(0, currency), tone: 'zero' }
}

function shareUrl(bill) {
  const url = new URL(`/join/${bill.public_token}`, window.location.origin)
  url.searchParams.set('title', bill.title)
  url.searchParams.set('currency', bill.currency || 'KES')
  url.searchParams.set('total', String(bill.bill_total))
  return url.toString()
}

function Header({ onCreate, onLogout }) {
  return (
    <header className="topbar">
      <Brand />
      <nav className="topnav" aria-label="Main navigation">
        <a href="#your-events">Your events</a>
        <a href="#how-it-works">How it works</a>
      </nav>
      <div className="topbar-actions">
        <button className="button button-outline topbar-logout" onClick={onLogout}>Sign out</button>
        <button className="button button-dark topbar-cta" onClick={onCreate}>
          <Icon name="plus" size={18} />
          <span>New split</span>
        </button>
      </div>
    </header>
  )
}

function CreateDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('KES')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPaid, setOwnerPaid] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const billTotal = Number(amount)
    const ownerAmountPaid = Number(ownerPaid)
    if (!title.trim() || !Number.isFinite(billTotal) || billTotal <= 0 || !ownerName.trim() || !Number.isFinite(ownerAmountPaid) || ownerAmountPaid <= 0) {
      setError('Add an event name, a total, your name, and an amount you’ve paid greater than zero.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const before = await request('/bills').catch((requestError) => {
        if (requestError.status === 404) return { data: [] }
        throw requestError
      })
      const existingIds = new Set((before.data || []).map((bill) => bill.id))
      const createdResult = await request('/bills', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), currency, bill_total: billTotal }),
      })
      let created = createdResult.data
      if (!created?.public_token) {
        const after = await request('/bills')
        created = (after.data || []).find((bill) => !existingIds.has(bill.id))
      }
      if (!created?.public_token) {
        onCreated(null, 'Your event was created, but we couldn’t prepare its joining link. Please refresh and try again.')
        return
      }

      try {
        await request(`/participants/${encodeURIComponent(created.public_token)}/join`, {
          method: 'POST',
          body: JSON.stringify({ name: ownerName.trim(), amount_paid: ownerAmountPaid }),
        })
      } catch {
        onCreated(created, 'Your event was created, but we couldn’t add you as its first participant. You can still join using the event link.')
        return
      }

      try {
        await request(`/participants/${encodeURIComponent(created.public_token)}/balance`)
        onCreated(created, 'Event created — you’re in as the first participant.')
      } catch {
        onCreated(created, 'Event created and you’re in. We couldn’t refresh balances right now.')
      }
    } catch {
      setError('We couldn’t create your event. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog" disabled={busy}>
          <Icon name="close" />
        </button>
        <div className="eyebrow"><span className="eyebrow-dot" /> START A SHARED EVENT</div>
        <h2 id="create-title">What are we<br />splitting?</h2>
        <p className="dialog-intro">Set the event total and add yourself as the first participant.</p>
        <form onSubmit={submit} className="create-form">
          <label>
            <span>Give it a name</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Nyama choma with the crew" maxLength={100} />
          </label>
          <label>
            <span>How much is the total?</span>
            <div className="amount-input">
              <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
              <input inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
          </label>
          <label>
            <span>Your name</span>
            <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="What should we call you?" maxLength={80} />
          </label>
          <label>
            <span>How much have you paid so far?</span>
            <div className="amount-input">
              <span className="currency-static">{currency}</span>
              <input inputMode="decimal" type="number" min="0.01" step="0.01" value={ownerPaid} onChange={(event) => setOwnerPaid(event.target.value)} placeholder="0.00" />
            </div>
          </label>
          <p className="field-hint">Add a contribution above zero to join. You can update it as the event progresses.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-yellow form-submit" type="submit" disabled={busy}>
            {busy ? 'Making your split…' : <>Make a split <Icon name="arrow" size={18} /></>}
          </button>
        </form>
        <p className="dialog-footnote"><Icon name="people" size={16} /> Your account keeps your events in one place.</p>
      </section>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { number: '01', title: 'Create your event', text: 'Name the plan and set the total in KES. Chama contribution, nyama choma, or a trip upcountry — it all starts here.' },
    { number: '02', title: 'Share the link', text: 'Copy your event link and send it to the WhatsApp group. Your people can join from their phones.' },
    { number: '03', title: 'Track the split', text: 'Everyone adds their name and what they have paid. See the crew’s contributions together.' },
  ]

  return (
    <section className="how-section" id="how-it-works">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> MADE FOR KENYAN PLANS</div>
          <h2>How Eventab<br /><span>works.</span></h2>
        </div>
        <p>Keep the money talk clear.<br />Keep the good times coming.</p>
      </div>
      <div className="steps-grid">
        {steps.map((step) => (
          <article className="step-card" key={step.number}>
            <span className="step-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function BillCard({ bill, onCopy, onStatusChange, statusBusy, onDelete, deleteBusy }) {
  const [participants, setParticipants] = useState([])
  const [participantsVisible, setParticipantsVisible] = useState(false)
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsError, setParticipantsError] = useState('')
  const [balanceNotice, setBalanceNotice] = useState('')

  async function loadParticipants() {
    if (!bill.public_token) {
      setParticipantsError('Participant details are unavailable for this event.')
      return
    }

    setParticipantsLoading(true)
    setParticipantsError('')
    setBalanceNotice('')
    try {
      const path = `/participants/${encodeURIComponent(bill.public_token)}`
      const initialResult = await request(path)
      setParticipants(initialResult.data || [])
      try {
        await request(`${path}/balance`)
        const updatedResult = await request(path)
        setParticipants(updatedResult.data || [])
      } catch {
        setBalanceNotice('Balances could not be refreshed. Showing the last saved amounts.')
      }
    } catch (error) {
      if (error.status === 404) {
        setParticipants([])
      } else {
        setParticipantsError('Couldn’t load participants. Please try again.')
      }
    } finally {
      setParticipantsLoading(false)
    }
  }

  function toggleParticipants() {
    if (participantsVisible) {
      setParticipantsVisible(false)
      return
    }

    setParticipantsVisible(true)
    if (!participants.length && !participantsLoading) loadParticipants()
  }

  return (
    <article className="bill-card">
      <div className="bill-card-top">
        <span className={`status-pill${bill.status === 'closed' ? ' status-closed' : ''}`}>
          <span /> {bill.status || 'open'}
        </span>
        <div className="bill-card-actions">
          <button
            className={`status-action${bill.status === 'closed' ? '' : ' status-action-close'}`}
            onClick={() => onStatusChange(bill)}
            disabled={statusBusy || deleteBusy}
          >
            {statusBusy ? 'Updating…' : bill.status === 'closed' ? 'Reopen' : 'Close'}
          </button>
          <button
            className="delete-action"
            onClick={() => onDelete(bill)}
            disabled={deleteBusy || statusBusy}
            aria-label={`Delete ${bill.title}`}
            title="Delete event"
          >
            {deleteBusy ? 'Deleting…' : <><Icon name="trash" size={14} /><span>Delete</span></>}
          </button>
        </div>
      </div>
      <h3>{bill.title}</h3>
      <div className="bill-total-panel">
        <p className="bill-total-label">EVENT TOTAL</p>
        <div className="bill-total">{currencyAmount(bill.bill_total, bill.currency)}</div>
      </div>
      <div className="bill-card-bottom">
        <button className="text-button" onClick={toggleParticipants} aria-expanded={participantsVisible}>
          <Icon name="people" size={16} />
          {participantsVisible ? 'Hide participants' : 'View participants'}
        </button>
        {bill.status !== 'closed' && (
          <button className="text-button" onClick={() => onCopy(bill)}>Copy link <Icon name="arrow" size={15} /></button>
        )}
      </div>
      {participantsVisible && (
        <div className="bill-participants">
          <div className="bill-participants-heading">PARTICIPANTS <span>{participants.length}</span></div>
          {participantsLoading ? (
            <p className="bill-participants-message">Loading participants…</p>
          ) : participantsError ? (
            <p className="bill-participants-message">{participantsError} <button className="inline-button" onClick={loadParticipants}>Try again</button></p>
          ) : null}
          {!participantsLoading && balanceNotice && <p className="bill-balance-notice">{balanceNotice}</p>}
          {!participantsLoading && participants.length > 0 && (
            <>
              <div className="participant-columns"><span>PARTICIPANT</span><span>PAID</span><span>BALANCE</span></div>
              <ul className="bill-participants-list">
                {participants.map((participant) => {
                  const balance = balanceDisplay(participant.balance, bill.currency)
                  return (
                    <li className="bill-participant-row" key={participant.id}>
                      <span className="bill-participant-person">
                        <span className="person-avatar">{participant.name.slice(0, 1).toUpperCase()}</span>
                        <span className="bill-participant-name">{participant.name}</span>
                      </span>
                      <strong className="participant-paid">{currencyAmount(participant.amount_paid, bill.currency)}</strong>
                      <strong className={`participant-balance participant-balance-${balance.tone}`}>{balance.label}</strong>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!participantsLoading && !participantsError && participants.length === 0 && (
            <p className="bill-participants-message">No participants have joined yet.</p>
          )}
        </div>
      )}
    </article>
  )
}

function Dashboard({ onLogout }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [copied, setCopied] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [statusUpdatingId, setStatusUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const refreshBills = useCallback(async () => {
    try {
      const result = await request('/bills')
      setLoadError('')
      setBills(result.data || [])
    } catch (error) {
      if (error.status === 404) {
        setLoadError('')
        setBills([])
      } else {
        setLoadError('We couldn’t load your events just now.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    request('/bills').then((result) => {
      if (!active) return
      setLoadError('')
      setBills(result.data || [])
    }).catch((error) => {
      if (!active) return
      if (error.status === 404) setBills([])
      else setLoadError('We couldn’t load your events just now.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const openCount = useMemo(() => bills.filter((bill) => bill.status !== 'closed').length, [bills])
  const totalPlanned = useMemo(
    () => bills.reduce((sum, bill) => sum + (Number(bill.bill_total) || 0), 0),
    [bills],
  )

  async function copyBillLink(bill) {
    try {
      await navigator.clipboard.writeText(shareUrl(bill))
      setCopied(bill.id)
      window.setTimeout(() => setCopied(''), 2400)
    } catch {
      setNotice('Could not access your clipboard. Open the split to copy its link from your browser address bar.')
    }
  }

  async function changeBillStatus(bill) {
    const status = bill.status === 'closed' ? 'open' : 'closed'
    setStatusUpdatingId(bill.id)
    try {
      await request(`/bills/${encodeURIComponent(bill.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      setBills((current) => current.map((item) => item.id === bill.id ? { ...item, status } : item))
      setNotice(status === 'closed'
        ? 'Event closed. Existing invite links may still accept participants.'
        : 'Event reopened. You can share its invite link again.')
    } catch {
      setNotice('Couldn’t update this event. Please try again.')
    } finally {
      setStatusUpdatingId('')
    }
  }

  async function deleteBill(bill) {
    const confirmed = window.confirm(`Delete "${bill.title}" and its event record? This can’t be undone.`)
    if (!confirmed) return

    setDeletingId(bill.id)
    try {
      await request(`/bills/${encodeURIComponent(bill.id)}`, { method: 'DELETE' })
      setBills((current) => current.filter((item) => item.id !== bill.id))
      setNotice(`“${bill.title}” was deleted.`)
    } catch {
      setNotice('Couldn’t delete this event. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  function handleCreated(bill, message) {
    setDialogOpen(false)
    if (bill) {
      setBills((current) => [bill, ...current])
      setNotice(message || 'Your event is ready. Copy its link to invite your crew.')
    } else {
      setNotice(message)
      refreshBills()
    }
  }

  return (
    <>
      <div className="page-shell">
        <Header onCreate={() => setDialogOpen(true)} onLogout={onLogout} />
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="hero-kicker-dot" /> MADE FOR KENYA, MADE FOR YOUR CREW</div>
              <h1>Make plans.<br />Split <span>the buzz.</span></h1>
              <p>From nyama choma to coast trips, big plans are better together. Keep the costs clear and the crew in the loop.</p>
              <button className="button button-yellow hero-button" onClick={() => setDialogOpen(true)}>
                Start a split <Icon name="arrow" size={18} />
              </button>
              <div className="hero-social-proof"><span className="avatar-stack"><i>J</i><i>A</i><i>M</i></span><span>Made for your whole crew</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-sun" />
              <div className="ticket-card">
                <div className="ticket-top"><span>THE CREW FUND</span><span className="ticket-spark">✳</span></div>
                <div className="ticket-title">Lake day<br />☀️ loading...</div>
                <div className="ticket-progress"><span /></div>
                <div className="ticket-meta"><span>4 friends in</span><strong>GOOD VIBES ONLY</strong></div>
              </div>
              <div className="floating-note note-left"><span className="note-icon">↗</span><span>link sent!<small>the group chat</small></span></div>
              <div className="floating-note note-right"><span className="note-check"><Icon name="check" size={15} /></span><span>all pitching in<small>love to see it</small></span></div>
              <div className="bee-bee">b<span>z</span></div>
              <div className="hero-caption">GOOD TIMES, SHARED</div>
            </div>
          </section>

          <HowItWorks />

          <section className="plans-section" id="your-events">
            <div className="plans-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> YOUR GROUP PLANS, IN ONE PLACE</div>
                <h2>Your events<span className="yellow-period">.</span></h2>
              </div>
              <button className="button button-outline" onClick={() => setDialogOpen(true)}><Icon name="plus" size={18} /> New split</button>
            </div>
            <div className="stats-row">
              <div className="stat-item"><span>EVENTS YOU’VE STARTED</span><strong>{bills.length.toString().padStart(2, '0')}</strong></div>
              <div className="stat-item"><span>OPEN RIGHT NOW</span><strong>{openCount.toString().padStart(2, '0')}</strong></div>
              <div className="stat-item"><span>GOOD TIMES PLANNED</span><strong>{currencyAmount(totalPlanned, bills[0]?.currency || 'KES')}</strong></div>
              <div className="stat-doodle" aria-hidden="true">✳</div>
            </div>
            {notice && <div className="notice" role="status"><span>{notice}</span><button className="notice-close" onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close" size={16} /></button></div>}
            <div className="list-heading"><h3>Your recent events</h3><span>{bills.length} {bills.length === 1 ? 'event' : 'events'}</span></div>
            {loading ? (
              <div className="loading-state"><span className="loader" /> Loading your events…</div>
            ) : loadError ? (
              <div className="empty-state error-state">
                <div className="empty-icon"><Icon name="spark" size={24} /></div>
                <h3>Eventab is having a moment.</h3>
                <p>Please check your connection and try again in a moment.</p>
                <button className="button button-dark" onClick={() => { setLoading(true); refreshBills() }}>Try again</button>
              </div>
            ) : bills.length ? (
              <div className="bills-grid">
                {bills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} onStatusChange={changeBillStatus} statusBusy={statusUpdatingId === bill.id} onDelete={deleteBill} deleteBusy={deletingId === bill.id} onCopy={(item) => {
                    if (!item.public_token) {
                      setNotice('This split has no public token in the bill list, so a joining link cannot be made yet.')
                    } else {
                      copyBillLink(item)
                    }
                  }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="wallet" size={24} /></div>
                <h3>A little quiet in here.</h3>
                <p>Kick things off with your first shared plan. We’ll save you a spot in the group chat.</p>
                <button className="button button-dark" onClick={() => setDialogOpen(true)}><Icon name="plus" size={17} /> Start your first split</button>
              </div>
            )}
            {copied && <div className="toast" role="status"><Icon name="check" size={18} /> Link copied — let the group chat know.</div>}
          </section>

        </main>
        <footer className="footer"><Brand /><p>Good plans. Good people. Nice and simple.</p><span>© {new Date().getFullYear()} Eventab</span></footer>
      </div>
      {dialogOpen && <CreateDialog onClose={() => setDialogOpen(false)} onCreated={handleCreated} />}
    </>
  )
}

function JoinPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const title = searchParams.get('title') || 'A shared plan'
  const currency = searchParams.get('currency') || 'KES'
  const total = searchParams.get('total')
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [paid, setPaid] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refreshParticipants = useCallback(async () => {
    try {
      try {
        await request(`/participants/${encodeURIComponent(token)}/balance`)
      } catch {
        setMessage('Balances may be out of date. Please try refreshing later.')
      }
      const result = await request(`/participants/${encodeURIComponent(token)}`)
      setLoadError('')
      setParticipants(result.data || [])
    } catch (error) {
      if (error.status === 404) {
        setLoadError('')
        setParticipants([])
      } else {
        setLoadError('We couldn’t load the guest list just now.')
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    const path = `/participants/${encodeURIComponent(token)}`
    async function load() {
      try {
        await request(`${path}/balance`)
      } catch {
        if (active) setMessage('Balances may be out of date. Please try refreshing later.')
      }

      try {
        const result = await request(path)
        if (!active) return
        setLoadError('')
        setParticipants(result.data || [])
      } catch (error) {
        if (!active) return
        if (error.status === 404) setParticipants([])
        else setLoadError('We couldn’t load the guest list just now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [token])

  async function join(event) {
    event.preventDefault()
    const amountPaid = Number(paid)
    if (!name.trim() || !Number.isFinite(amountPaid) || amountPaid <= 0) {
      setMessage('Add your name and an amount greater than zero.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await request(`/participants/${encodeURIComponent(token)}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), amount_paid: amountPaid }),
      })
      setName('')
      setPaid('')
      let successMessage = 'You’re in! Your event is one person stronger.'
      try {
        await request(`/participants/${encodeURIComponent(token)}/balance`)
      } catch {
        successMessage = 'You joined, but we couldn’t refresh balances right now.'
      }
      setMessage(successMessage)
      await refreshParticipants()
    } catch {
      setMessage('We couldn’t add you to this event. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="join-page">
      <header className="join-header"><Brand /><Link className="back-link" to="/">Make your own <Icon name="arrow" size={16} /></Link></header>
      <main className="join-layout">
        <section className="join-intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOU’RE INVITED</div>
          <h1>Come on in,<br /><span>there’s room.</span></h1>
          <p>Good plans are better with friends. Add your name and what you’ve covered so everyone’s on the same page.</p>
          <div className="join-plan-card">
            <div className="join-plan-icon"><Icon name="spark" size={22} /></div>
            <div><span>THE PLAN</span><h2>{title}</h2></div>
            {total && <strong>{currencyAmount(total, currency)}</strong>}
          </div>
          <div className="join-illustration" aria-hidden="true"><div className="join-flower">✳</div><div className="join-smile">☺</div><div className="join-bee">●<span>)))</span></div><div className="join-doodle">GOOD<br />TIMES</div></div>
        </section>
        <section className="join-form-card">
          <div className="eyebrow"><span className="eyebrow-dot" /> JOIN THE EVENT</div>
          <h2>Save your seat.</h2>
          <p className="join-card-copy">Let the crew know who’s in and what you’ve put toward the plan so far.</p>
          <form onSubmit={join} className="create-form">
            <label><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" maxLength={80} /></label>
            <label><span>What have you paid so far?</span><div className="amount-input"><span className="currency-static">{currency}</span><input inputMode="decimal" type="number" min="0.01" step="0.01" value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="0.00" /></div></label>
            {message && <p className={message.startsWith('You’re in') ? 'form-success' : 'form-error'} role="status">{message}</p>}
            <button className="button button-yellow form-submit" disabled={busy}>{busy ? 'Joining…' : <>Count me in <Icon name="arrow" size={18} /></>}</button>
          </form>
          <div className="participants">
            <div className="participants-heading"><span>THE CREW SO FAR</span><span>{participants.length} {participants.length === 1 ? 'person' : 'people'}</span></div>
            {loading ? <p className="participants-empty">Checking who’s in…</p> : loadError ? (
              <p className="participants-empty">{loadError} <button className="inline-button" onClick={() => { setLoading(true); refreshParticipants() }}>Try again</button></p>
            ) : participants.length ? (
              <ul>{participants.map((participant) => {
                const balance = balanceDisplay(participant.balance, currency)

                return (
                  <li key={participant.id}>
                    <span className="person-avatar">{participant.name.slice(0, 1).toUpperCase()}</span>
                    <span className="participant-details">
                      <span>{participant.name}</span>
                      <small>Paid {currencyAmount(participant.amount_paid, currency)}</small>
                    </span>
                    <strong className={`participant-balance participant-balance-${balance.tone}`}>Balance {balance.label}</strong>
                  </li>
                )
              })}</ul>
            ) : <p className="participants-empty">You could be the first to join this plan.</p>}
          </div>
        </section>
      </main>
      <footer className="join-footer"><Brand /><span>Good plans, shared.</span></footer>
    </div>
  )
}

function AuthPage({ onAuthenticated }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('sign_in')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSignUp = mode === 'sign_up'

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      let result = await request(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      })
      if (isSignUp && !result.token) {
        result = await request('/auth/sign_in', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      }
      if (!result.token) {
        throw new Error('Authentication succeeded without a session token. Please try again.')
      }
      sessionStorage.setItem('token', result.token)
      onAuthenticated()
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'We couldn’t sign you in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header"><Brand /></header>
      <section className="auth-card">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PLANS, ALL TOGETHER</div>
        <h1>{isSignUp ? 'Make room for' : 'Good to see'}<br /><span>{isSignUp ? 'good plans.' : 'you again.'}</span></h1>
        <p className="auth-copy">{isSignUp ? 'Create an account to keep your shared events together.' : 'Sign in to pick up where your plans left off.'}</p>
        <form className="create-form" onSubmit={submit}>
          {isSignUp && (
            <label>
              <span>Your name</span>
              <input autoComplete="name" required maxLength={80} value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
          )}
          <label>
            <span>Email address</span>
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={isSignUp ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {isSignUp && <p className="field-hint">Use at least 8 characters.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-yellow form-submit" type="submit" disabled={busy}>
            {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'} <Icon name="arrow" size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New to Eventab?'}{' '}
          <button type="button" className="inline-button" onClick={() => {
            setMode(isSignUp ? 'sign_in' : 'sign_up')
            setError('')
          }}>
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="auth-join-link">Joining an event? Use the invite link you received.</p>
      </section>
      <footer className="join-footer"><Brand /><span>Good plans, shared.</span></footer>
    </main>
  )
}

function NotFound() {
  return <main className="not-found"><Brand /><div className="eyebrow"><span className="eyebrow-dot" /> WRONG TURN</div><h1>This link wandered<br />off for a <span>snack.</span></h1><p>Let’s get you back to Eventab.</p><Link className="button button-yellow" to="/">Back to Eventab <Icon name="arrow" size={18} /></Link></main>
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(sessionStorage.getItem('token')))
  const navigate = useNavigate()

  useEffect(() => {
    function handleUnauthorized() {
      setAuthenticated(false)
    }
    window.addEventListener('eventab:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('eventab:unauthorized', handleUnauthorized)
  }, [])

  function logout() {
    sessionStorage.removeItem('token')
    setAuthenticated(false)
    navigate('/auth', { replace: true })
  }

  return (
    <Routes>
      <Route path="/" element={authenticated ? <Dashboard onLogout={logout} /> : <Navigate to="/auth" replace />} />
      <Route path="/auth" element={authenticated ? <Navigate to="/" replace /> : <AuthPage onAuthenticated={() => setAuthenticated(true)} />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
