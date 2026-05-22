import React, { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'
import { AlertCircle, Calendar, CheckCircle2, Filter, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'

const initialFilters = {
  action: '',
  actorUserId: '',
  entityType: '',
  status: '',
  startDate: '',
  endDate: ''
}

const AuditLogs = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const [logs, setLogs] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [auditPolicy, setAuditPolicy] = useState({ enabled: true, retentionDays: null, purgedAuditLogs: 0 })

  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters])

  const getAuditLogs = async () => {
    try {
      setLoading(true)
      const params = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value) acc[key] = value
        return acc
      }, {})

      let response
      try {
        response = await axios.get(backendUrl + '/api/admin/audit-logs', {
          headers: { aToken },
          params
        })
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error
        }

        response = await axios.get(backendUrl + '/api/audit-logs', {
          headers: { aToken },
          params
        })
      }

      const { data } = response

      if (data.success) {
        setLogs(data.logs)
        setAuditPolicy({
          enabled: data.auditLogsEnabled !== false,
          retentionDays: data.retentionDays || null,
          purgedAuditLogs: data.purgedAuditLogs || 0
        })
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (aToken) {
      getAuditLogs()
    }
  }, [aToken])

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters(initialFilters)
  }

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(value).toLocaleString()
  }

  const statusBadge = (status) => {
    const success = status === 'success'
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {success ? <CheckCircle2 className='w-3 h-3' /> : <XCircle className='w-3 h-3' />}
        {status}
      </span>
    )
  }

  return (
    <div className='w-full p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-7xl'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6'>
          <div>
            <h1 className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2'>
              <ShieldCheck className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-blue-600' />
              Audit Logs
            </h1>
            <p className='text-xs sm:text-sm md:text-base text-gray-600 mt-1 ml-7 sm:ml-9'>Review security, payment, profile, and medical-record activity</p>
          </div>

          <button
            onClick={getAuditLogs}
            className='inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium'
          >
            <RefreshCw className='w-4 h-4' />
            Refresh
          </button>
        </div>

        <div className='bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6'>
          <div className='flex items-center gap-2 mb-3 text-gray-700 font-semibold text-sm sm:text-base'>
            <Filter className='w-4 h-4' />
            Filters
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3'>
            <input
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              placeholder='Action'
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <input
              value={filters.actorUserId}
              onChange={(e) => updateFilter('actorUserId', e.target.value)}
              placeholder='Actor user ID'
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <input
              value={filters.entityType}
              onChange={(e) => updateFilter('entityType', e.target.value)}
              placeholder='Entity type'
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All statuses</option>
              <option value='success'>Success</option>
              <option value='failed'>Failed</option>
            </select>
            <input
              type='date'
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <input
              type='date'
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='flex flex-wrap gap-2 mt-4'>
            <button
              onClick={getAuditLogs}
              className='inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium'
            >
              <Search className='w-4 h-4' />
              Apply
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className='inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium'
              >
                <XCircle className='w-4 h-4' />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className='flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 text-[10px] sm:text-xs md:text-sm'>
          <span className='px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 rounded-full whitespace-nowrap'>
            Showing: {logs.length}
          </span>
          <span className='px-2 sm:px-3 py-1 bg-green-50 text-green-700 rounded-full whitespace-nowrap'>
            Success: {logs.filter(log => log.status === 'success').length}
          </span>
          <span className='px-2 sm:px-3 py-1 bg-red-50 text-red-700 rounded-full whitespace-nowrap'>
            Failed: {logs.filter(log => log.status === 'failed').length}
          </span>
          <span className='px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-full whitespace-nowrap'>
            Retention: {auditPolicy.retentionDays ? `${auditPolicy.retentionDays} days` : 'Policy default'}
          </span>
          {auditPolicy.purgedAuditLogs > 0 && (
            <span className='px-2 sm:px-3 py-1 bg-amber-50 text-amber-700 rounded-full whitespace-nowrap'>
              Purged expired: {auditPolicy.purgedAuditLogs}
            </span>
          )}
        </div>

        <div className='bg-white border rounded-lg text-xs sm:text-sm max-h-[70vh] sm:max-h-[80vh] min-h-[40vh] overflow-y-auto overflow-x-auto'>
          <div className='hidden xl:grid grid-cols-[1.2fr_0.8fr_1fr_1fr_1fr_1.1fr_1.3fr] gap-3 py-3 px-5 border-b bg-gray-50 sticky top-0 z-10'>
            <p className='font-medium'>Action</p>
            <p className='font-medium'>Status</p>
            <p className='font-medium'>Actor</p>
            <p className='font-medium'>Entity</p>
            <p className='font-medium'>Target</p>
            <p className='font-medium'>Date</p>
            <p className='font-medium'>Reason</p>
          </div>

          {loading ? (
            <div className='p-6 text-center text-gray-500'>Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className='py-12 sm:py-16 text-center px-4'>
              <div className='mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4'>
                <AlertCircle className='w-6 h-6 sm:w-8 sm:h-8 text-gray-400' />
              </div>
              <h3 className='text-base sm:text-lg font-medium text-gray-700 mb-2'>No audit logs found</h3>
              <p className='text-xs sm:text-sm text-gray-500'>Try refreshing or changing the filters.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log._id} className='flex flex-col xl:grid xl:grid-cols-[1.2fr_0.8fr_1fr_1fr_1fr_1.1fr_1.3fr] gap-2 xl:gap-3 py-3 sm:py-4 px-3 sm:px-5 border-b hover:bg-gray-50 text-gray-600'>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Action</p>
                <p className='font-semibold text-gray-800 break-words'>{log.action}</p>
                {log.metadata?.username && (
                  <p className='text-[11px] text-gray-500 mt-1'>User: {log.metadata.username}</p>
                )}
                {log.metadata?.loginId && (
                  <p className='text-[11px] text-gray-400 break-all'>Login ID: {log.metadata.loginId}</p>
                )}
                <p className='text-[11px] text-gray-400 mt-1'>{log.ipAddress || 'No IP'}</p>
                {(log.location?.city || log.location?.country) && (
                  <p className='text-[11px] text-gray-400'>
                    {[log.location.city, log.location.region, log.location.country].filter(Boolean).join(', ')}
                  </p>
                )}
                </div>
                <div>{statusBadge(log.status)}</div>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Actor</p>
                  <p className='font-medium text-gray-700'>{log.actorRole || 'N/A'}</p>
                  <p className='text-[11px] text-gray-400 break-all'>{log.actorUserId || 'N/A'}</p>
                </div>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Entity</p>
                  <p className='font-medium text-gray-700'>{log.entityType || 'N/A'}</p>
                  <p className='text-[11px] text-gray-400 break-all'>{log.entityId || 'N/A'}</p>
                </div>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Target</p>
                  <p className='break-all'>{log.targetUserId || 'N/A'}</p>
                </div>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Date</p>
                  <p className='inline-flex items-center gap-1'>
                    <Calendar className='w-3 h-3 text-gray-400' />
                    {formatDate(log.createdAt)}
                  </p>
                </div>
                <div>
                  <p className='xl:hidden text-[10px] uppercase tracking-wide text-gray-400 mb-1'>Reason</p>
                  <p className='break-words'>{log.reason || 'N/A'}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className='mt-2'>
                      <summary className='cursor-pointer text-blue-600 font-medium'>Metadata</summary>
                      <pre className='mt-2 max-w-full overflow-x-auto rounded-lg bg-gray-100 p-2 text-[11px] text-gray-700'>
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default AuditLogs
