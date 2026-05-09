import React, { useContext, useState } from "react";
import axios from "axios";
import { Eye, EyeOff, Loader2, RotateCcw, UserCog } from "lucide-react";
import { toast } from "react-toastify";
import { AdminContext } from "../../context/AdminContext";

const AddReceptionist = () => {
  const { backendUrl, aToken } = useContext(AdminContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await axios.post(backendUrl + "/api/admin/add-receptionist", { name, email, phone, password }, { headers: { aToken } });
      if (data.success) {
        toast.success(data.message);
        resetForm();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            Add Receptionist
          </h1>
          <p className="mt-2 text-sm text-gray-600 ml-8">Create staff accounts for reception access. Receptionists cannot self-register.</p>
        </div>

        <form onSubmit={onSubmitHandler} className="bg-white rounded-xl shadow border border-gray-200 p-5 sm:p-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
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
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button disabled={isLoading} className="bg-primary text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:bg-gray-400">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCog className="w-5 h-5" />}
              Create Receptionist
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
