export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: string
  isAdmin: boolean
  branchId?: number | null
  branchName?: string | null
  permissions: string[]
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  mobile?: string | null
  phone?: string | null
  houseUnit?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  zipCode?: string | null
  addressDisplay?: string | null
  hasProfilePicture?: boolean
}

export type FieldDuePayment = {
  scheduleItemId: number
  customerId: number
  customerName: string
  customerMobile?: string | null
  loanId: number
  loanNumber: string
  installmentNumber: number
  dueDate: string
  amountDue: number
  penaltyAmount: number
  paidAmount: number
  remaining: number
  isOverdue: boolean
  loanStatus: string
}

export type LoanFieldNoteAttachment = {
  id: number
  originalFileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
  downloadUrl: string
}

export type LoanFieldNote = {
  id: number
  loanId: number
  body: string
  createdBy: string
  createdByUserId: string
  createdAt: string
  attachments: LoanFieldNoteAttachment[]
}

export type Role = {
  id: string
  name: string
  description?: string | null
  isSystem: boolean
  permissions: string[]
}

export type AppPage = {
  id: number
  code: string
  name: string
  path: string
  groupName: string
  sortOrder: number
  permissionCode: string
}

export type RolePageAccess = {
  roleId: string
  roleName: string
  pageCodes: string[]
}

export type AppUser = {
  id: string
  email: string
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  mobile?: string | null
  phone?: string | null
  houseUnit?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  zipCode?: string | null
  addressDisplay?: string | null
  hasProfilePicture: boolean
  role: string
  branchId?: number | null
  branchName?: string | null
  isActive: boolean
  isDeleted: boolean
  deletedAt?: string | null
}

export type ProcessStageApproverRole = {
  roleId: string
  roleName: string
}

export type ProcessStageApproverUser = {
  userId: string
  userName: string
}

export type ProcessStage = {
  id: number
  name: string
  sortOrder: number
  requiresApproval: boolean
  approverRoleId?: string | null
  approverRoleName?: string | null
  approverUserId?: string | null
  approverUserName?: string | null
  approverRoles?: ProcessStageApproverRole[]
  approverUsers?: ProcessStageApproverUser[]
  isFinal: boolean
  onApproveStageId?: number | null
  onApproveSortOrder?: number | null
  onApproveStageName?: string | null
  onDeclineStageId?: number | null
  onDeclineSortOrder?: number | null
  onDeclineStageName?: string | null
  onDeclineEndsLoan: boolean
}

export type ProcessFlow = {
  id: number
  name: string
  description?: string | null
  isActive: boolean
  stages: ProcessStage[]
}

export type Loan = {
  id: number
  loanNumber: string
  customerId: number
  customerName: string
  flowId: number
  flowName: string
  currentStageId: number
  currentStageName: string
  amount: number
  interestRatePercent: number
  termCount: number
  paymentFrequency: string
  firstDueDate?: string | null
  interestAmount: number
  totalPayable: number
  installmentAmount: number
  totalPaid: number
  remainingBalance: number
  status: string
  createdBy: string
  notes?: string | null
  createdAt: string
  canApprove: boolean
  canAdvance: boolean
  hasTerms: boolean
  loanProductId?: number | null
  loanProductName?: string | null
  interestMethod?: string
}

export type LoanProduct = {
  id: number
  name: string
  description?: string | null
  amount: number
  interestRatePercent: number
  termCount: number
  paymentFrequency: string
  interestMethod: string
  isActive: boolean
  loanCount: number
  createdAt: string
}

export type LoanScheduleItem = {
  id: number
  installmentNumber: number
  dueDate: string
  amountDue: number
  principalPortion: number
  interestPortion: number
  penaltyAmount: number
  paidAmount: number
  balance: number
  status: string
}

export type LateFeeSettings = {
  isEnabled: boolean
  type: 'FlatOnce' | 'FlatPerDay' | 'PercentOfInstallmentPerDay' | string
  amount: number
  percent: number
  graceDays: number
  maxPerInstallment?: number | null
  updatedAt: string
}

export type LoanPayment = {
  id: number
  amount: number
  paidAt: string
  method?: string | null
  reference?: string | null
  notes?: string | null
  recordedBy: string
  createdAt: string
}

export type LoanApprovalHistory = {
  id: number
  stageName: string
  decision: string
  decidedBy?: string | null
  comments?: string | null
  requestedAt: string
  decidedAt?: string | null
}

export type LoanDetailBundle = {
  loan: Loan
  schedule: LoanScheduleItem[]
  payments: LoanPayment[]
  approvals: LoanApprovalHistory[]
}

export type CustomerPaymentSummary = {
  customerId: number
  customerName: string
  loanCount: number
  totalPrincipal: number
  totalPayable: number
  totalPaid: number
  remainingBalance: number
  overdueAmount: number
  overdueCount: number
  loans: Loan[]
}

export type StatementLine = {
  date: string
  type: string
  description: string
  debit: number
  credit: number
  balance: number
}

export type StatementOfAccount = {
  customerId: number
  customerName: string
  loanId?: number | null
  loanNumber?: string | null
  generatedAt: string
  openingBalance: number
  closingBalance: number
  lines: StatementLine[]
}

export type ApprovalItem = {
  id: number
  loanId: number
  loanNumber: string
  customerName: string
  stageName: string
  amount: number
  decision: string
  requestedAt: string
  canAct: boolean
}

export type LoanActivityStep = {
  id: number
  type: string
  stageName: string
  actorName?: string | null
  notes?: string | null
  occurredAt: string
}

export type LoanActivityTrail = {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  hasCustomerProfilePicture: boolean
  amount: number
  flowName: string
  currentStageName: string
  status: string
  createdAt: string
  createdBy: string
  steps: LoanActivityStep[]
}

export type CustomerDocument = {
  id: number
  label: string
  originalFileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

export type CustomerGroup = {
  id: number
  name: string
  description?: string | null
  isActive: boolean
  customerCount: number
  createdAt: string
}

export type Branch = {
  id: number
  name: string
  code?: string | null
  address?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  zipCode?: string | null
  phone?: string | null
  email?: string | null
  addressDisplay: string
  isActive: boolean
  customerCount: number
  userCount: number
  createdAt: string
}

export type AgentOption = {
  id: string
  fullName: string
  email: string
  hasProfilePicture: boolean
}

export type AuditLogEntry = {
  id: number
  occurredAt: string
  actorUserId?: string | null
  actorUserName: string
  action: string
  entityType: string
  entityId?: string | null
  summary: string
  detailsJson?: string | null
}

export type CashRemittance = {
  id: number
  agentUserId: string
  agentName: string
  branchId?: number | null
  branchName?: string | null
  remittanceDate: string
  collectedAmount: number
  remittedAmount: number
  variance: number
  notes?: string | null
  status: string
  createdByUserId: string
  createdByName: string
  receivedByUserId?: string | null
  receivedByName?: string | null
  createdAt: string
  updatedAt: string
  receivedAt?: string | null
}

export type CustomerDetail = {
  id: number
  firstName: string
  middleName?: string | null
  lastName: string
  fullName: string
  branchId?: number | null
  branchName?: string | null
  groupId?: number | null
  groupName?: string | null
  agent1UserId?: string | null
  agent1Name?: string | null
  agent2UserId?: string | null
  agent2Name?: string | null
  agent3UserId?: string | null
  agent3Name?: string | null
  houseUnit?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  zipCode?: string | null
  addressDisplay: string
  mobile?: string | null
  phone?: string | null
  email?: string | null
  referredBy?: string | null
  dateOfBirth?: string | null
  idType?: string | null
  idNumber?: string | null
  coMakerName?: string | null
  coMakerMobile?: string | null
  coMakerIdNumber?: string | null
  guarantorName?: string | null
  guarantorMobile?: string | null
  guarantorIdNumber?: string | null
  latitude?: number | null
  longitude?: number | null
  createdAt: string
  hasProfilePicture: boolean
  documents: CustomerDocument[]
}

export type CustomerListItem = {
  id: number
  firstName: string
  middleName?: string | null
  lastName: string
  fullName: string
  branchId?: number | null
  branchName?: string | null
  groupId?: number | null
  groupName?: string | null
  agent1UserId?: string | null
  agent1Name?: string | null
  mobile?: string | null
  email?: string | null
  city?: string | null
  referredBy?: string | null
  documentCount: number
  hasProfilePicture: boolean
  createdAt: string
}
