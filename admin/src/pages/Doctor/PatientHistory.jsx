import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { DoctorContext } from "../../context/DoctorContext";
import { AppContext } from "../../context/AppContext";
import { toast } from "react-toastify";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  User,
  Stethoscope,
  Thermometer,
  Pill,
  Clipboard,
  Activity,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  XCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  History,
  Info,
  PencilLine
} from "lucide-react";

const parseSlotDate = (slotDate) => {
  const parts = String(slotDate || "").split("_").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [day, month, year] = parts;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const snippet = (text, max = 72) => {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}…`;
};

const PatientHistory = () => {
  const { dToken, history, getpatienthistory, editPrescription, updatePatientMedicalHistory } = useContext(DoctorContext);
  const { calculateAge, slotDateFormat, currency } = useContext(AppContext);
  
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isHistoryEditing, setIsHistoryEditing] = useState(false);
  const [patientHistoryData, setPatientHistoryData] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    editedStatus: 'all',
    dateRange: 'all',
  });
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

  const refreshList = useCallback(async () => {
    if (!dToken) return;
    setRefreshing(true);
    try {
      await getpatienthistory();
    } finally {
      setRefreshing(false);
    }
  }, [dToken, getpatienthistory]);

  useEffect(() => {
    const fetchData = async () => {
      if (dToken) {
        setLoading(true);
        await getpatienthistory();
        setLoading(false);
      }
    };
    fetchData();
  }, [dToken, getpatienthistory]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, sortBy, pageSize]);

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const blob = [
          item.userData?.patientId,
          item.userData?.name,
          item.userData?.phone,
          item.userData?.email,
          item.diagnosis,
          item.symptoms,
          item.instructions,
          item.documentation
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(query);
      });
    }

    if (filters.editedStatus !== 'all') {
      result = result.filter((item) => {
        if (filters.editedStatus === 'edited') return item.isEdited === true;
        if (filters.editedStatus === 'not-edited') return !item.isEdited;
        return true;
      });
    }

    if (filters.dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      result = result.filter((item) => {
        const appointmentDate = parseSlotDate(item.slotDate);
        if (!appointmentDate) return false;
        appointmentDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((appointmentDate - today) / (1000 * 60 * 60 * 24));

        if (filters.dateRange === 'today') return daysDiff === 0;
        if (filters.dateRange === 'tomorrow') return daysDiff === 1;
        if (filters.dateRange === 'week') return daysDiff >= -7 && daysDiff <= 0;
        if (filters.dateRange === '15days') return daysDiff >= -15 && daysDiff <= 0;
        if (filters.dateRange === 'month') return daysDiff >= -30 && daysDiff <= 0;
        if (filters.dateRange === 'upcoming7') return daysDiff >= 0 && daysDiff <= 7;
        if (filters.dateRange === 'upcoming30') return daysDiff >= 0 && daysDiff <= 30;

        return true;
      });
    }

    const sorted = [...result].sort((a, b) => {
      const da = parseSlotDate(a.slotDate)?.getTime() ?? 0;
      const db = parseSlotDate(b.slotDate)?.getTime() ?? 0;
      const ta = `${a.slotTime || ''}`;
      const tb = `${b.slotTime || ''}`;
      const nameA = (a.userData?.name || '').toLowerCase();
      const nameB = (b.userData?.name || '').toLowerCase();
      const amtA = Number(a.amount || 0);
      const amtB = Number(b.amount || 0);

      if (sortBy === 'date_asc') {
        if (da !== db) return da - db;
        return ta.localeCompare(tb);
      }
      if (sortBy === 'date_desc') {
        if (da !== db) return db - da;
        return tb.localeCompare(ta);
      }
      if (sortBy === 'patient_asc') return nameA.localeCompare(nameB);
      if (sortBy === 'amount_desc') return amtB - amtA;
      if (sortBy === 'amount_asc') return amtA - amtB;
      return 0;
    });

    return sorted;
  }, [history, searchQuery, filters, sortBy]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredHistory.length / pageSize)),
    [filteredHistory.length, pageSize]
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pagedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, page, pageSize]);

  const stats = useMemo(() => {
    const edited = history.filter((h) => h.isEdited).length;
    return {
      total: history.length,
      edited,
      notEdited: history.length - edited
    };
  }, [history]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      editedStatus: 'all',
      dateRange: 'all',
    });
  };

  const exportFilteredCsv = () => {
    if (!filteredHistory.length) {
      toast.info('Nothing to export for current filters.');
      return;
    }
    const headers = ['Patient', 'Patient ID', 'Phone', 'Diagnosis', 'Visit date', 'Time', 'Amount', 'Prescription edited', 'Edited at'];
    const rows = filteredHistory.map((item) => [
      item.userData?.name || '',
      item.userData?.patientId || '',
      item.userData?.phone || '',
      item.diagnosis || '',
      slotDateFormat(item.slotDate),
      item.slotTime || '',
      String(item.amount ?? ''),
      item.isEdited ? 'Yes' : 'No',
      item.isEdited && item.editHistory?.[0]?.editedAt
        ? new Date(item.editHistory[0].editedAt).toLocaleString()
        : ''
    ]);
    const escape = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export ready');
  };

  const handleViewDetails = (item) => {
    setSelectedPatient(item);
    setShowDetail(true);
    setIsEditing(false);
    setEditData({
      diagnosis: item.diagnosis || '',
      symptoms: item.symptoms || '',
      medicines: item.medicines || '',
      medicationItems: item.medicationItems?.length ? item.medicationItems : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      instructions: item.instructions || '',
      nextVisit: item.nextVisit || '',
      labTests: item.labTests || '',
      documentation: item.documentation || ''
    });
    setPatientHistoryData({
      conditions: item.patientMedicalHistory?.conditions || '',
      allergies: item.patientMedicalHistory?.allergies || '',
      surgeries: item.patientMedicalHistory?.surgeries || '',
      familyHistory: item.patientMedicalHistory?.familyHistory || '',
      socialHistory: item.patientMedicalHistory?.socialHistory || '',
      notes: item.patientMedicalHistory?.notes || ''
    });
    setIsHistoryEditing(false);
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedPatient(null);
    setIsEditing(false);
  };

  const shouldShowEditButton = () => {
    if (!selectedPatient) return false;
    if (selectedPatient.isEdited) return false;
    if (!selectedPatient.createdAt) return false;
    
    const createdTime = new Date(selectedPatient.createdAt).getTime();
    const hoursPassed = (Date.now() - createdTime) / (1000 * 60 * 60);
    
    return hoursPassed <= 24;
  };

  const getCannotEditMessage = () => {
    if (!selectedPatient) return null;
    
    if (selectedPatient.isEdited) {
      return "This prescription has already been edited once";
    }
    
    if (!selectedPatient.createdAt) {
      return 'Cannot edit: Prescription is old';
    }
    
    const createdTime = new Date(selectedPatient.createdAt).getTime();
    const hoursPassed = (Date.now() - createdTime) / (1000 * 60 * 60);
    
    if (hoursPassed > 24) {
      return "Cannot edit after 24 hours";
    }
    
    return null;
  };

  const handleEdit = () => setIsEditing(true);
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      diagnosis: selectedPatient.diagnosis || '',
      symptoms: selectedPatient.symptoms || '',
      medicines: selectedPatient.medicines || '',
      medicationItems: selectedPatient.medicationItems?.length ? selectedPatient.medicationItems : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      instructions: selectedPatient.instructions || '',
      nextVisit: selectedPatient.nextVisit || '',
      labTests: selectedPatient.labTests || '',
      documentation: selectedPatient.documentation || ''
    });
  };

  const handleChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleMedicationChange = (index, field, value) => {
    setEditData(prev => ({
      ...prev,
      medicationItems: (prev.medicationItems || []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  };

  const addMedicationItem = () => {
    setEditData(prev => ({
      ...prev,
      medicationItems: [...(prev.medicationItems || []), { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    }));
  };

  const removeMedicationItem = (index) => {
    setEditData(prev => ({
      ...prev,
      medicationItems: (prev.medicationItems || []).length === 1 ? prev.medicationItems : prev.medicationItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const handleHistoryChange = (field, value) => {
    setPatientHistoryData(prev => ({ ...prev, [field]: value }));
  };

  const handleHistorySave = async () => {
    const success = await updatePatientMedicalHistory(selectedPatient.userId, patientHistoryData);
    if (success) {
      await getpatienthistory();
      setIsHistoryEditing(false);
    }
  };

  const handleSave = async () => {
    try {
      const success = await editPrescription(selectedPatient._id, editData);
      if (success) {
        toast.success("Prescription updated successfully!");
        await getpatienthistory();
        setShowDetail(false);
        setSelectedPatient(null);
        setIsEditing(false);
      } else {
        toast.error("Failed to update prescription");
      }
    } catch (error) {
      toast.error("Error updating prescription");
      console.error(error);
    }
  };

  // Detail View
  if (showDetail && selectedPatient) {
    const canShowEdit = shouldShowEditButton();
    const cannotEditMsg = getCannotEditMessage();

  return (
    <div className="w-full p-3 sm:p-5 md:p-6 lg:p-8">
        <div className="max-w-5xl">
          
        {/* Header */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-5 sm:mb-6">
        {/* Left side - Back button */}
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm sm:text-base font-medium flex-shrink-0"
        >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Back to History</span>
          <span className="sm:hidden">Back</span>
        </button>
  
        {/* Right side - Status badge */}
        {selectedPatient.isEdited && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Already Edited</span>
          <span className="sm:hidden">Edited</span>
        </div>
        )}
      </div>


        {/* Cannot Edit Warning */}
          {cannotEditMsg && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 text-red-700 rounded-lg sm:rounded-xl border border-red-200">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm sm:text-base">{cannotEditMsg}</p>
                  {selectedPatient.createdAt && (
                    <div className="text-xs sm:text-sm mt-2 space-y-1">
                      <p>Created: {new Date(selectedPatient.createdAt).toLocaleString()}</p>
                      {selectedPatient.isEdited && selectedPatient.editHistory?.[0] && (
                        <p>Edited: {new Date(selectedPatient.editHistory[0].editedAt).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Patient Info Card */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <img className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg" src={selectedPatient.userData.image} alt="" />
              <div className="flex-1 w-full">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{selectedPatient.userData.name}</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full">
                    <User className="w-3 h-3 sm:w-4 sm:h-4" />
                    {selectedPatient.userData.patientId}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white text-gray-700 text-xs sm:text-sm px-3 py-1 rounded-full border border-gray-200">
                    Age: {calculateAge(selectedPatient.userData.dob)} years
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Email:</span> {selectedPatient.userData.email}
                  </p>
                  {selectedPatient.userData.phone && (
                    <p className="flex items-center gap-2">
                      <span className="font-medium">Phone:</span> {selectedPatient.userData.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              Insurance
            </h3>
            {selectedPatient.patientInsurance?.enabled ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                {selectedPatient.patientInsurance.verificationStatus && (
                  <p className="sm:col-span-2">
                    <span className="font-semibold">Verification:</span>{' '}
                    <span className="capitalize">{selectedPatient.patientInsurance.verificationStatus}</span>
                    {selectedPatient.patientInsurance.declineReason && (
                      <span className="block text-rose-700 mt-1">Reason: {selectedPatient.patientInsurance.declineReason}</span>
                    )}
                  </p>
                )}
                {selectedPatient.patientInsurance.provider && (
                  <p className="sm:col-span-2"><span className="font-semibold">Provider:</span> {selectedPatient.patientInsurance.provider}</p>
                )}
                <p><span className="font-semibold">Full Name:</span> {selectedPatient.patientInsurance.fullName}</p>
                <p><span className="font-semibold">Birth Date:</span> {selectedPatient.patientInsurance.birthDate}</p>
                <p><span className="font-semibold">ID Number:</span> {selectedPatient.patientInsurance.idNumber}</p>
                <p><span className="font-semibold">Expiry Date:</span> {selectedPatient.patientInsurance.expiryDate}</p>
                {selectedPatient.patientInsurance.medicalCardPhoto && (
                  <a className="text-blue-600 underline font-semibold" href={selectedPatient.patientInsurance.medicalCardPhoto} target="_blank" rel="noreferrer">View medical card</a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No insurance information is available for this patient.</p>
            )}
          </div>


          {/* Appointment Details */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Appointment Details
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-100">
                <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  Date
                </p>
                <p className="text-sm sm:text-base font-semibold text-gray-800">{slotDateFormat(selectedPatient.slotDate)}</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-100">
                <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  Time
                </p>
                <p className="text-sm sm:text-base font-semibold text-gray-800">{selectedPatient.slotTime}</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-100">
                <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                  Fees
                </p>
                <p className="text-sm sm:text-base font-semibold text-gray-800">{currency}{Number(selectedPatient.amount || 0).toLocaleString()}</p>
              </div>
              
              <div className="bg-emerald-50 rounded-lg p-3 sm:p-4 border border-emerald-100">
                <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  Status
                </p>
                <p className="text-sm sm:text-base font-semibold text-green-600">Completed</p>
              </div>
            </div>

            {/* Timeline */}
            {selectedPatient.createdAt && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">Prescription Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-700">Created</p>
                      <p className="text-xs text-gray-500">{new Date(selectedPatient.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedPatient.isEdited && selectedPatient.editHistory?.[0] && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-700">Last Edited</p>
                        <p className="text-xs text-gray-500">{new Date(selectedPatient.editHistory[0].editedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Medical Details */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clipboard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                Patient Medical History
              </h3>
              {isHistoryEditing ? (
                <div className="flex gap-2">
                  <button onClick={handleHistorySave} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">Save</button>
                  <button onClick={() => setIsHistoryEditing(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setIsHistoryEditing(true)} className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">Edit History</button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['conditions', 'Conditions'],
                ['allergies', 'Allergies'],
                ['surgeries', 'Surgeries'],
                ['familyHistory', 'Family History'],
                ['socialHistory', 'Social History'],
                ['notes', 'Notes']
              ].map(([field, label]) => (
                <div key={field} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
                  {isHistoryEditing ? (
                    <textarea value={patientHistoryData[field] || ''} onChange={(e) => handleHistoryChange(field, e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-line">{patientHistoryData[field] || 'Not recorded'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                Medical Details
                {isEditing && <span className="text-blue-600 text-sm sm:text-base ml-2">(Editing Mode)</span>}
              </h3>
            </div>
            
            <div className="space-y-5 sm:space-y-6">
              
              {/* Diagnosis */}
              <div className="border-l-4 border-blue-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Diagnosis</label>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.diagnosis}
                    onChange={(e) => handleChange('diagnosis', e.target.value)}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="Enter diagnosis"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm sm:text-base text-gray-800">
                    {selectedPatient.diagnosis || 'Not specified'}
                  </p>
                )}
              </div>

              {/* Symptoms */}
              <div className="border-l-4 border-orange-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Symptoms</label>
                </div>
                {isEditing ? (
                  <textarea
                    value={editData.symptoms}
                    onChange={(e) => handleChange('symptoms', e.target.value)}
                    rows={3}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="Describe symptoms"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-200 text-sm sm:text-base text-gray-800 whitespace-pre-line">
                    {selectedPatient.symptoms || 'Not specified'}
                  </p>
                )}
              </div>

              {/* Medicines */}
              <div className="border-l-4 border-green-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Prescribed Medicines</label>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <button type="button" onClick={addMedicationItem} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-medium">Add medicine</button>
                    {(editData.medicationItems || []).map((item, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input value={item.name} onChange={(e) => handleMedicationChange(index, 'name', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Medicine name" />
                          <input value={item.dosage} onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Dosage" />
                          <input value={item.frequency} onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Frequency" />
                          <input value={item.duration} onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Duration" />
                        </div>
                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                          <input value={item.instructions} onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Instructions" />
                          <button type="button" onClick={() => removeMedicationItem(index)} disabled={(editData.medicationItems || []).length === 1} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm disabled:opacity-40">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  selectedPatient.medicationItems?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-green-100 rounded-lg overflow-hidden">
                        <thead className="bg-green-50 text-gray-700">
                          <tr>
                            <th className="text-left p-2">Medicine</th>
                            <th className="text-left p-2">Dosage</th>
                            <th className="text-left p-2">Frequency</th>
                            <th className="text-left p-2">Duration</th>
                            <th className="text-left p-2">Instructions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPatient.medicationItems.map((item, index) => (
                            <tr key={index} className="border-t border-green-100">
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">{item.dosage}</td>
                              <td className="p-2">{item.frequency}</td>
                              <td className="p-2">{item.duration}</td>
                              <td className="p-2">{item.instructions || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200 text-sm sm:text-base text-gray-800 whitespace-pre-line">
                      {selectedPatient.medicines || 'Not specified'}
                    </p>
                  )
                )}
              </div>

              {/* Instructions */}
              <div className="border-l-4 border-purple-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clipboard className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Patient Instructions</label>
                </div>
                {isEditing ? (
                  <textarea
                    value={editData.instructions}
                    onChange={(e) => handleChange('instructions', e.target.value)}
                    rows={3}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="Enter instructions"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm sm:text-base text-gray-800 whitespace-pre-line">
                    {selectedPatient.instructions || 'Not specified'}
                  </p>
                )}
              </div>

              {/* Lab Tests */}
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Lab Tests</label>
                </div>
                {isEditing ? (
                  <textarea
                    value={editData.labTests}
                    onChange={(e) => handleChange('labTests', e.target.value)}
                    rows={2}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="Recommended tests"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200 text-sm sm:text-base text-gray-800">
                    {selectedPatient.labTests || 'Not specified'}
                  </p>
                )}
              </div>

              {/* Next Visit */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Follow-up Visit</label>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.nextVisit}
                    onChange={(e) => handleChange('nextVisit', e.target.value)}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="e.g., After 1 week"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm sm:text-base text-gray-800">
                    {selectedPatient.nextVisit || 'Not specified'}
                  </p>
                )}
              </div>

              {/* Documentation */}
              <div className="border-l-4 border-indigo-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  <label className="text-sm sm:text-base font-semibold text-gray-700">Documentation</label>
                </div>
                {isEditing ? (
                  <textarea
                    value={editData.documentation}
                    onChange={(e) => handleChange('documentation', e.target.value)}
                    rows={3}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                    placeholder="Additional notes"
                  />
                ) : (
                  <p className="p-2 sm:p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-sm sm:text-base text-gray-800">
                    {selectedPatient.documentation || 'No notes'}
                  </p>
                )}
              </div>
            </div>

          
            {/* Action Buttons */}
            <div className="mt-6 sm:mt-8 pt-6 border-t border-gray-200">
              {!isEditing && canShowEdit && !cannotEditMsg ? (
                <button
                  onClick={handleEdit}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm sm:text-base"
                >
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  Edit Prescription
                </button>
              ) : isEditing ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm sm:text-base"
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold text-sm sm:text-base"
                  >
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    Cancel
                  </button>
                </div>
              ) : cannotEditMsg ? (
                <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold">Note:</span> {cannotEditMsg}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }



  // List View
  return (
    <div className="w-full min-h-full bg-slate-50/80 p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200/60">
              <History className="h-3.5 w-3.5" />
              Clinical records
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              Patient history
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Completed visits with prescriptions. Search across patients and notes, export for audits, and open a record for full context or a one-time prescription correction (when allowed).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshList()}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportFilteredCsv}
              disabled={!filteredHistory.length}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 sm:left-4" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, phone, diagnosis, symptoms…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-blue-500 sm:pl-12 sm:pr-12 sm:text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:right-4"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600 sm:max-w-xs">
              <span className="shrink-0 font-semibold text-slate-700">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">Visit date (newest)</option>
                <option value="date_asc">Visit date (oldest)</option>
                <option value="patient_asc">Patient A–Z</option>
                <option value="amount_desc">Fee (high → low)</option>
                <option value="amount_asc">Fee (low → high)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Rows / page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {showFilters && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Advanced filters</h3>
                <button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Clear all
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                    Prescription correction
                    <span className="relative group inline-flex">
                      <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-hidden title="Edited means the prescription was corrected once after the visit." />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-normal leading-snug text-white shadow-lg group-hover:block">
                        “Edited” means this prescription was corrected once after the visit (clinic rules). Unedited records are unchanged since completion.
                      </span>
                    </span>
                  </label>
                  <select
                    value={filters.editedStatus}
                    onChange={(e) => setFilters({ ...filters, editedStatus: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All records</option>
                    <option value="edited">Edited prescription</option>
                    <option value="not-edited">Never edited</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Visit date</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All dates</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="upcoming7">Next 7 days</option>
                    <option value="upcoming30">Next 30 days</option>
                    <option value="week">Past 7 days</option>
                    <option value="15days">Past 15 days</option>
                    <option value="month">Past 30 days</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                    “{searchQuery}”
                    <button type="button" onClick={() => setSearchQuery("")} className="rounded p-0.5 hover:bg-blue-200" aria-label="Clear search">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.editedStatus !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    {filters.editedStatus === "edited" ? "Edited Rx" : "Original Rx"}
                    <button type="button" onClick={() => setFilters({ ...filters, editedStatus: "all" })} className="rounded p-0.5 hover:bg-amber-200" aria-label="Clear filter">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.dateRange !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
                    {filters.dateRange === "today"
                      ? "Today"
                      : filters.dateRange === "tomorrow"
                        ? "Tomorrow"
                        : filters.dateRange === "week"
                          ? "Past 7d"
                          : filters.dateRange === "15days"
                            ? "Past 15d"
                            : filters.dateRange === "month"
                              ? "Past 30d"
                              : filters.dateRange === "upcoming7"
                                ? "Next 7d"
                                : filters.dateRange === "upcoming30"
                                  ? "Next 30d"
                                  : filters.dateRange}
                    <button type="button" onClick={() => setFilters({ ...filters, dateRange: "all" })} className="rounded p-0.5 hover:bg-violet-200" aria-label="Clear date filter">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total visits</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
            <p className="mt-1 text-xs text-slate-500">Completed in file</p>
          </div>
          <div className="rounded-2xl border border-violet-200/80 bg-violet-50/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800">Prescription edited</p>
            <p className="mt-1 text-2xl font-black text-violet-950">{stats.edited}</p>
            <p className="mt-1 text-xs text-violet-800/80">Corrected once after visit</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Original record</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{stats.notEdited}</p>
            <p className="mt-1 text-xs text-slate-500">Unchanged since completion</p>
          </div>
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">Matching list</p>
            <p className="mt-1 text-2xl font-black text-blue-950">{filteredHistory.length}</p>
            <p className="mt-1 text-xs text-blue-800/80">After search & filters</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs shadow-sm sm:text-sm max-h-[70vh] min-h-[40vh] overflow-y-auto overflow-x-auto sm:max-h-[78vh] sm:min-h-[44vh]">
          <div className="hidden lg:grid lg:grid-cols-[0.45fr_1.65fr_0.85fr_1.45fr_1.35fr_0.7fr_0.75fr_0.95fr] gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sticky top-0 z-10">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">#</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Patient</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Patient ID</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Diagnosis</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Date & time</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fees</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rx</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</p>
          </div>

          {loading ? (
            <>
              <div className="lg:hidden">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse border-b border-slate-100 p-4">
                    <div className="mb-3 flex gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-[75%] rounded bg-slate-200" />
                        <div className="h-3 w-1/2 rounded bg-slate-200" />
                      </div>
                    </div>
                    <div className="h-6 w-40 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
              <div className="hidden lg:block">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[0.45fr_1.65fr_0.85fr_1.45fr_1.35fr_0.7fr_0.75fr_0.95fr] gap-1 border-b border-slate-100 px-6 py-4 animate-pulse"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <div key={j} className="h-4 rounded bg-slate-200" />
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : filteredHistory.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Search className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No records found</h3>
              <p className="mt-2 text-sm text-slate-500">
                {searchQuery ? "Try adjusting your search or filters." : "No patient history available yet."}
              </p>
              {(searchQuery || filters.editedStatus !== "all" || filters.dateRange !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            pagedHistory.map((item, index) => {
              const rowNum = (page - 1) * pageSize + index + 1;
              const dx = snippet(item.diagnosis, 80);
              return (
                <div
                  key={item._id || index}
                  className="flex flex-col border-b border-slate-100 py-3 text-slate-600 transition hover:bg-slate-50/90 sm:py-4 px-3 sm:px-4 lg:grid lg:grid-cols-[0.45fr_1.65fr_0.85fr_1.45fr_1.35fr_0.7fr_0.75fr_0.95fr] lg:items-center lg:gap-1 lg:px-6"
                >
                  <div className="w-full lg:hidden">
                    <div className="mb-3 flex items-start gap-3">
                      <img className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" src={item.userData.image} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{item.userData.name}</p>
                        <p className="text-xs text-slate-500">ID: {item.userData.patientId}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {slotDateFormat(item.slotDate)} · {item.slotTime}
                        </p>
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 rounded-lg bg-violet-50 px-2 py-1.5 text-xs text-violet-900 ring-1 ring-violet-100" title={item.diagnosis || ""}>
                      {dx || "—"}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.isEdited ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            <PencilLine className="h-3 w-3" />
                            Rx edited
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Original Rx</span>
                        )}
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          {currency}
                          {Number(item.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(item)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        View details
                      </button>
                    </div>
                  </div>

                  <p className="hidden tabular-nums text-slate-500 lg:block">{rowNum}</p>
                  <div className="hidden items-center gap-2 lg:flex">
                    <img className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" src={item.userData.image} alt="" />
                    <p className="truncate font-medium text-slate-800">{item.userData.name}</p>
                  </div>
                  <p className="hidden truncate text-slate-700 lg:block">{item.userData.patientId}</p>
                  <div className="hidden lg:block">
                    <span
                      className="line-clamp-2 rounded-lg bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 ring-1 ring-violet-100"
                      title={item.diagnosis || ""}
                    >
                      {dx || "—"}
                    </span>
                  </div>
                  <p className="hidden text-xs leading-snug text-slate-700 lg:block xl:text-sm">
                    {slotDateFormat(item.slotDate)}, {item.slotTime}
                  </p>
                  <p className="hidden font-semibold text-slate-800 lg:block">
                    {currency}
                    {Number(item.amount || 0).toLocaleString()}
                  </p>
                  <div className="hidden lg:block">
                    {item.isEdited ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        <PencilLine className="h-3 w-3 shrink-0" />
                        Edited
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500">Original</span>
                    )}
                  </div>
                  <div className="hidden lg:block">
                    <button
                      type="button"
                      onClick={() => handleViewDetails(item)}
                      className="text-sm font-bold text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                    >
                      View details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredHistory.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:px-6">
            <p className="font-medium text-slate-700">
              Page <span className="tabular-nums text-slate-900">{page}</span> of <span className="tabular-nums text-slate-900">{totalPages}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="tabular-nums">{filteredHistory.length}</span> matching
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientHistory;
