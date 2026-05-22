import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Building2, Camera, Eye, EyeOff, IdCard, Loader2, RotateCcw, UserCog } from "lucide-react";
import { toast } from "react-toastify";
import { AdminContext } from "../../context/AdminContext";
import { emptyAddress, emptyEmergencyContact } from "../../utils/receptionistProfileForm";
import { useLanguage } from "../../i18n";

const addressLabels = {
  line1: "Address line 1",
  line2: "Address line 2",
  city: "City",
  state: "State / region",
  postalCode: "Postal code",
  country: "Country",
};

const AddReceptionist = () => {
  const { backendUrl, aToken, getReceptionists } = useContext(AdminContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("Receptionist");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [bio, setBio] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [address, setAddress] = useState(emptyAddress());
  const [emergencyContact, setEmergencyContact] = useState(emptyEmergencyContact());
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const setAddressField = (key, value) =>
    setAddress((prev) => ({ ...prev, [key]: value }));
  const setEmergencyField = (key, value) =>
    setEmergencyContact((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setJobTitle("Receptionist");
    setDepartment("");
    setEmployeeId("");
    setBio("");
    setAdminNotes("");
    setAddress(emptyAddress());
    setEmergencyContact(emptyEmergencyContact());
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("email", email);
      fd.append("phone", phone);
      fd.append("password", password);
      fd.append("jobTitle", jobTitle || "Receptionist");
      fd.append("department", department);
      fd.append("employeeId", employeeId);
      fd.append("bio", bio);
      fd.append("adminNotes", adminNotes);
      fd.append("address", JSON.stringify(address));
      fd.append("emergencyContact", JSON.stringify(emergencyContact));
      if (photoFile) fd.append("image", photoFile);

      const { data } = await axios.post(backendUrl + "/api/admin/add-receptionist", fd, {
        headers: { aToken },
      });
      if (data.success) {
        toast.success(data.message);
        await getReceptionists();
        navigate("/receptionist-list");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayImage = photoPreview;

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <div className="mb-4">
          <Link
            to="/receptionist-list"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Back to receptionists")}
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            {t("Add Receptionist")}
          </h1>
          <p className="mt-2 text-sm text-gray-600 ml-8">
            Create staff accounts with optional photo, address, emergency contact, and HR notes.
          </p>
        </div>

        <form onSubmit={onSubmitHandler} className="bg-white rounded-xl shadow border border-gray-200 p-5 sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50">
                {displayImage ? (
                  <img src={displayImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm text-center px-2">
                    No photo
                  </div>
                )}
              </div>
              <label className="mt-3 cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Camera className="w-4 h-4" />
                Profile photo (optional)
                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 pr-10 outline-none focus:border-primary" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <IdCard className="w-4 h-4" /> Job title
                </label>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Building2 className="w-4 h-4" /> Department
                </label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Employee ID</label>
                <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary" placeholder="Optional internal ID" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary resize-y" placeholder="Optional short introduction" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Admin / HR notes (internal)</label>
            <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary resize-y" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(addressLabels).map(([key, label]) => (
                <div key={key} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input value={address[key]} onChange={(e) => setAddressField(key, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Emergency contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <input value={emergencyContact.name} onChange={(e) => setEmergencyField("name", e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input value={emergencyContact.phone} onChange={(e) => setEmergencyField("phone", e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship</label>
                <input value={emergencyContact.relationship} onChange={(e) => setEmergencyField("relationship", e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button disabled={isLoading} className="bg-primary text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:bg-gray-400">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCog className="w-5 h-5" />}
              Create receptionist
            </button>
            <button type="button" onClick={resetForm} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddReceptionist;
