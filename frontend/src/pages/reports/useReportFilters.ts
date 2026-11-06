import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useBranchScope, withBranchQuery } from '../../branch/BranchContext'
import type { AgentOption, CustomerGroup } from '../../types'

export function useReportFilters() {
  const { filterBranchId } = useBranchScope()
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])

  useEffect(() => {
    void Promise.all([
      api<AgentOption[]>(withBranchQuery('/api/users/options', filterBranchId)),
      api<CustomerGroup[]>('/api/groups?activeOnly=true'),
    ])
      .then(([a, g]) => {
        setAgents(a)
        setGroups(g)
      })
      .catch(() => {
        setAgents([])
        setGroups([])
      })
  }, [filterBranchId])

  return { filterBranchId, agents, groups }
}
