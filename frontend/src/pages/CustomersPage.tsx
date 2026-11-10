import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, apiForm } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { CustomerAvatar } from '../components/CustomerAvatar'
import {
  LoanApplicationPanel,
  PaymentSummaryPanel,
  PaymentTermsPanel,
  RecordPaymentPanel,
  StatementOfAccountPanel,
} from '../components/customers/CustomerFinancePanels'
import { LoadingBlock } from '../components/ListLoading'
import type { AgentOption, Branch, CustomerDetail, CustomerGroup, CustomerListItem } from '../types'
import { useToast } from '../toast/ToastContext'

type CustomerTab = 'profile' | 'application' | 'terms' | 'summary' | 'payment' | 'statement'

type CustomerForm = {
  firstName: string
  middleName: string
  lastName: string
  branchId: number | ''
  groupId: number | ''
  agent1UserId: string
  agent2UserId: string
  agent3UserId: string
  houseUnit: string
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
  mobile: string
  phone: string
  email: string
  referredBy: string
  dateOfBirth: string
  idType: string
  idNumber: string
  coMakerName: string
  coMakerMobile: string
  coMakerIdNumber: string
  guarantorName: string
  guarantorMobile: string
  guarantorIdNumber: string
  latitude: string
  longitude: string
}

const ID_TYPES = ['National ID', 'Driver License', 'Passport', 'Other'] as const

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function parseCoord(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

type PendingDoc = { key: string; label: string; file: File | null }

const fieldClass =
  'cust-field w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500'

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500">{children}</label>
}

const emptyForm = (): CustomerForm => ({
  firstName: '',
  middleName: '',
  lastName: '',
  branchId: '',
  groupId: '',
  agent1UserId: '',
  agent2UserId: '',
  agent3UserId: '',
  houseUnit: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  mobile: '',
  phone: '',
  email: '',
  referredBy: '',
  dateOfBirth: '',
  idType: '',
  idNumber: '',
  coMakerName: '',
  coMakerMobile: '',
  coMakerIdNumber: '',
  guarantorName: '',
  guarantorMobile: '',
  guarantorIdNumber: '',
  latitude: '',
  longitude: '',
})

export function CustomersPage() {
  const { can } = useAuth()
  const { filterBranchId, isAdmin, userBranchId, userBranchName } = useBranchScope()
  const canManage = can('customers.manage')
  const [list, setList] = useState<CustomerListItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null)
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm())
  const [docs, setDocs] = useState<CustomerDetail['documents']>([])
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([{ key: '1', label: '', file: null }])
  const [hasProfilePicture, setHasProfilePicture] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [q, setQ] = useState('')
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [tab, setTab] = useState<CustomerTab>('profile')

  const pendingPhotoPreview = useMemo(
    () => (pendingPhoto ? URL.createObjectURL(pendingPhoto) : null),
    [pendingPhoto],
  )
  useEffect(() => {
    return () => {
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview)
    }
  }, [pendingPhotoPreview])

  const loadList = async (term = q) => {
    setLoadingList(true)
    try {
      const base = term.trim() ? `/api/customers?q=${encodeURIComponent(term.trim())}` : '/api/customers'
      setList(await api<CustomerListItem[]>(withBranchQuery(base, filterBranchId)))
    } finally {
      setLoadingList(false)
    }
  }

  const loadBranches = async () => {
    setBranches(await api<Branch[]>(withBranchQuery('/api/branches?activeOnly=true', filterBranchId)))
  }

  const loadGroups = async () => {
    setGroups(await api<CustomerGroup[]>('/api/groups?activeOnly=true'))
  }

  const loadAgents = async () => {
    setAgents(await api<AgentOption[]>(withBranchQuery('/api/users/options', filterBranchId)))
  }

  useEffect(() => {
    setLoadingList(true)
    Promise.all([loadList(), loadBranches(), loadGroups(), loadAgents()]).catch((err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to load'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  const resetNew = () => {
    setSelectedId(null)
    setSelectedBranchName(null)
    setSelectedGroupName(null)
    const lockedBranch = !isAdmin ? userBranchId ?? '' : filterBranchId ?? ''
    setForm({ ...emptyForm(), branchId: lockedBranch === null || lockedBranch === undefined ? '' : lockedBranch })
    setDocs([])
    setHasProfilePicture(false)
    setPendingPhoto(null)
    setPendingDocs([{ key: crypto.randomUUID(), label: '', file: null }])
    setTab('profile')
  }

  const selectCustomer = async (id: number, opts?: { keepTab?: boolean }) => {
    if (!opts?.keepTab) setTab('profile')
    try {
      const detail = await api<CustomerDetail>(`/api/customers/${id}`)
      setSelectedId(detail.id)
      setSelectedBranchName(detail.branchName ?? null)
      setSelectedGroupName(detail.groupName ?? null)
      setForm({
        firstName: detail.firstName,
        middleName: detail.middleName ?? '',
        lastName: detail.lastName,
        branchId: detail.branchId ?? '',
        groupId: detail.groupId ?? '',
        agent1UserId: detail.agent1UserId ?? '',
        agent2UserId: detail.agent2UserId ?? '',
        agent3UserId: detail.agent3UserId ?? '',
        houseUnit: detail.houseUnit ?? '',
        street: detail.street ?? '',
        barangay: detail.barangay ?? '',
        city: detail.city ?? '',
        province: detail.province ?? '',
        zipCode: detail.zipCode ?? '',
        mobile: detail.mobile ?? '',
        phone: detail.phone ?? '',
        email: detail.email ?? '',
        referredBy: detail.referredBy ?? '',
        dateOfBirth: toDateInput(detail.dateOfBirth),
        idType: detail.idType ?? '',
        idNumber: detail.idNumber ?? '',
        coMakerName: detail.coMakerName ?? '',
        coMakerMobile: detail.coMakerMobile ?? '',
        coMakerIdNumber: detail.coMakerIdNumber ?? '',
        guarantorName: detail.guarantorName ?? '',
        guarantorMobile: detail.guarantorMobile ?? '',
        guarantorIdNumber: detail.guarantorIdNumber ?? '',
        latitude: detail.latitude != null ? String(detail.latitude) : '',
        longitude: detail.longitude != null ? String(detail.longitude) : '',
      })
      setDocs(detail.documents ?? [])
      setHasProfilePicture(!!detail.hasProfilePicture)
      setPendingPhoto(null)
      setPendingDocs([{ key: crypto.randomUUID(), label: '', file: null }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load customer')
    }
  }

  const uploadProfilePicture = async (customerId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    await apiForm(`/api/customers/${customerId}/profile-picture`, fd)
  }

  const uploadPending = async (customerId: number) => {
    const rows = pendingDocs.filter((d) => d.label.trim() && d.file)
    for (const row of rows) {
      const fd = new FormData()
      fd.append('label', row.label.trim())
      fd.append('file', row.file!)
      await apiForm(`/api/customers/${customerId}/documents`, fd)
    }
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!form.agent1UserId) throw new Error('Collection agent 1 is required.')
      const payload = {
        firstName: form.firstName,
        middleName: form.middleName || null,
        lastName: form.lastName,
        branchId: form.branchId === '' ? null : Number(form.branchId),
        groupId: form.groupId === '' ? null : Number(form.groupId),
        agent1UserId: form.agent1UserId,
        agent2UserId: form.agent2UserId || null,
        agent3UserId: form.agent3UserId || null,
        houseUnit: form.houseUnit || null,
        street: form.street || null,
        barangay: form.barangay || null,
        city: form.city || null,
        province: form.province || null,
        zipCode: form.zipCode || null,
        mobile: form.mobile || null,
        phone: form.phone || null,
        email: form.email || null,
        referredBy: form.referredBy || null,
        dateOfBirth: form.dateOfBirth || null,
        idType: form.idType || null,
        idNumber: form.idNumber || null,
        coMakerName: form.coMakerName || null,
        coMakerMobile: form.coMakerMobile || null,
        coMakerIdNumber: form.coMakerIdNumber || null,
        guarantorName: form.guarantorName || null,
        guarantorMobile: form.guarantorMobile || null,
        guarantorIdNumber: form.guarantorIdNumber || null,
        latitude: parseCoord(form.latitude),
        longitude: parseCoord(form.longitude),
      }

      let id = selectedId
      if (id == null) {
        const created = await api<CustomerDetail>('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        id = created.id
      } else {
        await api(`/api/customers/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      }

      const hadPendingUploads = pendingDocs.some((d) => d.label.trim() && d.file)
      if (hadPendingUploads || pendingPhoto) {
        setUploading(true)
        try {
          if (pendingPhoto) await uploadProfilePicture(id, pendingPhoto)
          if (hadPendingUploads) await uploadPending(id)
        } catch (uploadErr) {
          await loadList()
          await selectCustomer(id)
          throw new Error(
            uploadErr instanceof Error
              ? `Customer saved, but upload failed: ${uploadErr.message}`
              : 'Customer saved, but upload failed.',
          )
        }
      }

      setPendingPhoto(null)
      toast.success(selectedId == null ? 'Customer created.' : 'Customer updated.')
      await loadList()
      await selectCustomer(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const onDeleteDoc = async (docId: number) => {
    if (selectedId == null) return
    if (!confirm('Delete this document?')) return
    try {
      await api(`/api/customers/${selectedId}/documents/${docId}`, { method: 'DELETE' })
      await selectCustomer(selectedId)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const downloadDocAuth = async (doc: CustomerDetail['documents'][number]) => {
    if (selectedId == null) return
    const token = localStorage.getItem('ml_token')
    const res = await fetch(`/api/customers/${selectedId}/documents/${doc.id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      toast.error('Download failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.originalFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const setField = (key: keyof CustomerForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        toast.success('Location captured.')
      },
      (err) => toast.error(err.message || 'Could not get location.'),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const mapsUrl =
    form.latitude.trim() && form.longitude.trim()
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude.trim()},${form.longitude.trim()}`)}`
      : null

  const displayName =
    [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ').trim() || 'New customer'
  const selectedListItem = list.find((c) => c.id === selectedId)

  const tabs = [
    ['profile', 'Profile'],
    ['application', 'Loan Application'],
    ['terms', 'Payment Terms'],
    ['summary', 'Payment Summary'],
    ['payment', 'Record Payment'],
    ['statement', 'Statement'],
  ] as const

  return (
    <div className="cust-page space-y-5">
      <header className="cust-hero relative px-6 py-7 sm:px-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/90">Transaction</p>
            <h2 className="cust-display mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Customers</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-200/90">
              Build complete borrower profiles, then move into loans, terms, payments, and statements — all from one desk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-wide text-sky-100/80">Registry</div>
              <div className="cust-display text-2xl font-semibold text-white">{list.length}</div>
            </div>
            {canManage && (
              <ActionButton type="button" variant="light" onClick={resetNew}>
                New customer
              </ActionButton>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-24px_rgba(15,39,68,0.45)] backdrop-blur">
          <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4">
            <FieldLabel>Find a customer</FieldLabel>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                placeholder="Name, mobile, or email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadList()
                }}
              />
              <ActionButton
                type="button"
                onClick={() => void loadList()}
                loading={loadingList}
                loadingText="…"
                className="shrink-0 px-3"
              >
                Go
              </ActionButton>
            </div>
          </div>
          <div className="max-h-[68vh] space-y-1 overflow-auto p-2">
            {loadingList && list.length === 0 ? (
              <LoadingBlock label="Loading customers..." compact />
            ) : (
              <>
            {list.map((c, index) => {
              const active = selectedId === c.id
              const zebra = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void selectCustomer(c.id)}
                  className={`cust-list-item flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-sky-400 bg-sky-100 shadow-[inset_3px_0_0_0_#0284c7] ring-2 ring-sky-300/70'
                      : `${zebra} border-transparent hover:border-slate-200 hover:bg-teal-50/70`
                  }`}
                >
                  <CustomerAvatar
                    customerId={c.id}
                    hasPicture={c.hasProfilePicture}
                    name={c.fullName}
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-xl text-xs"
                    textClassName={active ? 'bg-[#0f2744] text-sky-100' : 'bg-slate-100 text-slate-600'}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-semibold ${active ? 'text-sky-950' : 'text-slate-900'}`}
                    >
                      {c.fullName}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span
                        className={`rounded border px-1.5 py-0.5 ${
                          active ? 'border-sky-200 bg-white/90 text-sky-900' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {c.branchName || 'No branch'}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 ${
                          active ? 'border-sky-200 bg-white/90 text-sky-900' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {c.groupName || 'No group'}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 ${
                          active ? 'border-sky-200 bg-white/90 text-sky-900' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {c.documentCount} doc{c.documentCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className={`mt-1 block truncate text-xs ${active ? 'text-sky-800/80' : 'text-slate-400'}`}>
                      {c.mobile || 'No mobile'}
                      {c.agent1Name ? ` · ${c.agent1Name}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
            {!loadingList && list.length === 0 && (
              <div className="px-3 py-10 text-center text-sm text-slate-500">No customers found.</div>
            )}
              </>
            )}
          </div>
        </aside>

        <div
          key={`${selectedId ?? 'new'}-${tab}`}
          className="cust-panel space-y-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-24px_rgba(15,39,68,0.45)]"
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-teal-50/40 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <CustomerAvatar
                customerId={selectedId}
                hasPicture={hasProfilePicture}
                name={displayName}
                className="h-12 w-12 rounded-2xl text-sm"
                textClassName="bg-[#0f2744] text-sky-100"
              />
              <div className="min-w-0">
                <h3 className="cust-display truncate text-2xl font-semibold text-slate-900">{displayName}</h3>
                <p className="text-sm text-slate-500">
                  {selectedId == null
                    ? 'Creating a new borrower profile'
                    : `${selectedListItem?.branchName || selectedBranchName || 'Branch TBD'} · ${
                        selectedListItem?.groupName || selectedGroupName || 'Group TBD'
                      }`}
                </p>
              </div>
            </div>

            {selectedId != null && (
              <nav className="mt-4 flex flex-wrap gap-1 border-b border-slate-200/80">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-active={tab === key}
                    className={`cust-tab px-3 py-2.5 text-sm font-medium ${
                      tab === key ? 'text-sky-700' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => {
                      setTab(key)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {selectedId != null && tab === 'application' && (
              <LoanApplicationPanel customerId={selectedId} onError={toast.error} onMessage={toast.success} />
            )}
            {selectedId != null && tab === 'terms' && (
              <PaymentTermsPanel customerId={selectedId} onError={toast.error} onMessage={toast.success} />
            )}
            {selectedId != null && tab === 'summary' && (
              <PaymentSummaryPanel customerId={selectedId} onError={toast.error} onMessage={toast.success} />
            )}
            {selectedId != null && tab === 'payment' && (
              <RecordPaymentPanel customerId={selectedId} onError={toast.error} onMessage={toast.success} />
            )}
            {selectedId != null && tab === 'statement' && (
              <StatementOfAccountPanel customerId={selectedId} onError={toast.error} onMessage={toast.success} />
            )}

            {(selectedId == null || tab === 'profile') && (
              <form onSubmit={onSave} className="space-y-7">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-teal-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Personal</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <CustomerAvatar
                      customerId={selectedId}
                      hasPicture={hasProfilePicture && !pendingPhoto}
                      name={displayName}
                      className="h-20 w-20 rounded-2xl text-lg"
                      textClassName="bg-[#0f2744] text-sky-100"
                    />
                    {pendingPhotoPreview && (
                      <img
                        src={pendingPhotoPreview}
                        alt="Selected profile"
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <FieldLabel>Profile picture (optional)</FieldLabel>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
                        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-sky-700"
                        disabled={!canManage || photoBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setPendingPhoto(file)
                          e.target.value = ''
                        }}
                      />
                      <p className="text-xs text-slate-500">JPG, PNG, GIF, or WebP up to 5 MB. Not required.</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedId != null && canManage && pendingPhoto && (
                          <ActionButton
                            type="button"
                            loading={photoBusy}
                            loadingText="Uploading…"
                            onClick={async () => {
                              setPhotoBusy(true)
                              try {
                                await uploadProfilePicture(selectedId, pendingPhoto)
                                setPendingPhoto(null)
                                setHasProfilePicture(true)
                                toast.success('Profile picture updated.')
                                await loadList()
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Photo upload failed')
                              } finally {
                                setPhotoBusy(false)
                              }
                            }}
                          >
                            Upload now
                          </ActionButton>
                        )}
                        {selectedId != null && canManage && hasProfilePicture && (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
                            disabled={photoBusy}
                            onClick={async () => {
                              if (!confirm('Remove profile picture?')) return
                              setPhotoBusy(true)
                              try {
                                await api(`/api/customers/${selectedId}/profile-picture`, { method: 'DELETE' })
                                setHasProfilePicture(false)
                                setPendingPhoto(null)
                                toast.success('Profile picture removed.')
                                await loadList()
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Could not remove photo')
                              } finally {
                                setPhotoBusy(false)
                              }
                            }}
                          >
                            Remove photo
                          </button>
                        )}
                        {pendingPhoto && (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-white"
                            onClick={() => setPendingPhoto(null)}
                          >
                            Clear selection
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>First name *</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.firstName}
                        onChange={(e) => setField('firstName', e.target.value)}
                        required
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Middle name</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.middleName}
                        onChange={(e) => setField('middleName', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Last name *</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.lastName}
                        onChange={(e) => setField('lastName', e.target.value)}
                        required
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Branch</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.branchId === '' ? '' : String(form.branchId)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            branchId: e.target.value ? Number(e.target.value) : '',
                          }))
                        }
                        disabled={!canManage || !isAdmin}
                        required={!isAdmin}
                      >
                        {isAdmin && <option value="">Select branch</option>}
                        {!isAdmin && userBranchId != null && (
                          <option value={userBranchId}>{userBranchName || `Branch #${userBranchId}`}</option>
                        )}
                        {form.branchId !== '' && !branches.some((b) => b.id === form.branchId) && isAdmin && (
                          <option value={form.branchId}>
                            {selectedBranchName || `Branch #${form.branchId}`} (inactive)
                          </option>
                        )}
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                            {b.code ? ` (${b.code})` : ''}
                          </option>
                        ))}
                      </select>
                      {!isAdmin && (
                        <p className="mt-1 text-xs text-slate-500">Customers are saved to your assigned branch.</p>
                      )}
                      {isAdmin && branches.length === 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          No active branches. Create one under Settings → Branches.
                        </p>
                      )}
                    </div>
                    <div>
                      <FieldLabel>Group</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.groupId === '' ? '' : String(form.groupId)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            groupId: e.target.value ? Number(e.target.value) : '',
                          }))
                        }
                        disabled={!canManage}
                      >
                        <option value="">Select group</option>
                        {form.groupId !== '' && !groups.some((g) => g.id === form.groupId) && (
                          <option value={form.groupId}>
                            {selectedGroupName || `Group #${form.groupId}`} (inactive)
                          </option>
                        )}
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      {groups.length === 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          No active groups. Create one under Settings → Groups.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-sky-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Field agents</h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    Collection agents are system users. Agent 1 is required; 2 and 3 are optional.
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Field agent 1 *</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.agent1UserId}
                        onChange={(e) => setForm((prev) => ({ ...prev, agent1UserId: e.target.value }))}
                        required
                        disabled={!canManage}
                      >
                        <option value="">Select field agent</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName}
                            {a.email ? ` (${a.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Field agent 2</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.agent2UserId}
                        onChange={(e) => setForm((prev) => ({ ...prev, agent2UserId: e.target.value }))}
                        disabled={!canManage}
                      >
                        <option value="">None</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName}
                            {a.email ? ` (${a.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Field agent 3</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.agent3UserId}
                        onChange={(e) => setForm((prev) => ({ ...prev, agent3UserId: e.target.value }))}
                        disabled={!canManage}
                      >
                        <option value="">None</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName}
                            {a.email ? ` (${a.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {agents.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No system users yet. Create them under Accessibility → Users.
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-cyan-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Address</h4>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>House / Unit</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.houseUnit}
                        onChange={(e) => setField('houseUnit', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Street</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.street}
                        onChange={(e) => setField('street', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Barangay</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.barangay}
                        onChange={(e) => setField('barangay', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>City / Municipality</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Province</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.province}
                        onChange={(e) => setField('province', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>ZIP code</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.zipCode}
                        onChange={(e) => setField('zipCode', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Contact</h4>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Mobile</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.mobile}
                        onChange={(e) => setField('mobile', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Phone</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <input
                        className={fieldClass}
                        type="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-amber-400" />
                    <h4 className="text-sm font-semibold text-slate-800">Referral</h4>
                  </div>
                  <div>
                    <FieldLabel>Referred by</FieldLabel>
                    <input
                      className={fieldClass}
                      value={form.referredBy}
                      onChange={(e) => setField('referredBy', e.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-violet-500" />
                    <h4 className="text-sm font-semibold text-slate-800">KYC</h4>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Date of birth</FieldLabel>
                      <input
                        className={fieldClass}
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setField('dateOfBirth', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>ID type</FieldLabel>
                      <select
                        className={fieldClass}
                        value={form.idType}
                        onChange={(e) => setField('idType', e.target.value)}
                        disabled={!canManage}
                      >
                        <option value="">Select ID type</option>
                        {ID_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        {form.idType && !(ID_TYPES as readonly string[]).includes(form.idType) && (
                          <option value={form.idType}>{form.idType}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>ID number</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.idNumber}
                        onChange={(e) => setField('idNumber', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Co-maker name</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.coMakerName}
                        onChange={(e) => setField('coMakerName', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Co-maker mobile</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.coMakerMobile}
                        onChange={(e) => setField('coMakerMobile', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Co-maker ID number</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.coMakerIdNumber}
                        onChange={(e) => setField('coMakerIdNumber', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Guarantor name</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.guarantorName}
                        onChange={(e) => setField('guarantorName', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Guarantor mobile</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.guarantorMobile}
                        onChange={(e) => setField('guarantorMobile', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <FieldLabel>Guarantor ID number</FieldLabel>
                      <input
                        className={fieldClass}
                        value={form.guarantorIdNumber}
                        onChange={(e) => setField('guarantorIdNumber', e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full bg-indigo-500" />
                      <h4 className="text-sm font-semibold text-slate-800">Location</h4>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="text-sm font-medium text-sky-700 hover:text-sky-900"
                        onClick={useMyLocation}
                      >
                        Use my location
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Latitude</FieldLabel>
                      <input
                        className={fieldClass}
                        type="number"
                        step="any"
                        value={form.latitude}
                        onChange={(e) => setField('latitude', e.target.value)}
                        disabled={!canManage}
                        placeholder="e.g. 14.599500"
                      />
                    </div>
                    <div>
                      <FieldLabel>Longitude</FieldLabel>
                      <input
                        className={fieldClass}
                        type="number"
                        step="any"
                        value={form.longitude}
                        onChange={(e) => setField('longitude', e.target.value)}
                        disabled={!canManage}
                        placeholder="e.g. 120.984200"
                      />
                    </div>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-medium text-sky-700 hover:underline"
                    >
                      Open in maps
                    </a>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full bg-rose-400" />
                      <h4 className="text-sm font-semibold text-slate-800">Documents</h4>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="text-sm font-medium text-sky-700 hover:text-sky-900"
                        onClick={() =>
                          setPendingDocs((prev) => [...prev, { key: crypto.randomUUID(), label: '', file: null }])
                        }
                      >
                        Add document row
                      </button>
                    )}
                  </div>

                  {docs.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5 font-medium">Label</th>
                            <th className="px-3 py-2.5 font-medium">File</th>
                            <th className="px-3 py-2.5 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docs.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-3 py-2.5 font-medium text-slate-800">{d.label}</td>
                              <td className="px-3 py-2.5 text-slate-600">{d.originalFileName}</td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  className="mr-3 text-sky-700 hover:underline"
                                  onClick={() => void downloadDocAuth(d)}
                                >
                                  Download
                                </button>
                                {canManage && (
                                  <button
                                    type="button"
                                    className="text-red-600 hover:underline"
                                    onClick={() => void onDeleteDoc(d.id)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canManage &&
                    pendingDocs.map((row, index) => (
                      <div
                        key={row.key}
                        className="grid gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <input
                          className={fieldClass}
                          placeholder="Label (e.g. Valid ID)"
                          value={row.label}
                          onChange={(e) =>
                            setPendingDocs((prev) =>
                              prev.map((d, i) => (i === index ? { ...d, label: e.target.value } : d)),
                            )
                          }
                        />
                        <input
                          className={fieldClass}
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,image/*,application/pdf"
                          onChange={(e) =>
                            setPendingDocs((prev) =>
                              prev.map((d, i) => (i === index ? { ...d, file: e.target.files?.[0] ?? null } : d)),
                            )
                          }
                        />
                        {pendingDocs.length > 1 && (
                          <button
                            type="button"
                            className="text-sm text-red-600 hover:underline"
                            onClick={() => setPendingDocs((prev) => prev.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  <p className="text-xs text-slate-500">
                    Allowed files: images, PDF, Word (.doc/.docx). Max 15 MB each.
                  </p>
                </section>

                {canManage && (
                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <ActionButton
                      type="submit"
                      loading={saving || uploading}
                      loadingText={uploading ? 'Uploading…' : 'Saving…'}
                    >
                      {selectedId == null ? 'Create customer' : 'Save customer'}
                    </ActionButton>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
