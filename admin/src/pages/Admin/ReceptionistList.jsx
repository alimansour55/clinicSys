import React, { useContext, useEffect } from "react";
import { BadgeCheck, UserCog } from "lucide-react";
import { AdminContext } from "../../context/AdminContext";

const ReceptionistList = () => {
  const { aToken, receptionists, getReceptionists, changeReceptionistStatus } = useContext(AdminContext);

  useEffect(() => {
    if (aToken) getReceptionists();
  }, [aToken]);

  return (
    <div className="w-full p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="max-w-5xl">
        <div className="mb-5">
          <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-blue-600" />
            Receptionists
          </h1>
          <p className="text-sm text-gray-600 mt-1 ml-8">Manage front desk staff accounts</p>
        </div>

        <div className="bg-white border rounded-lg overflow-x-auto">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1fr] bg-gray-50 border-b px-5 py-3 text-sm font-medium text-gray-700">
            <p>Name</p>
            <p>Email</p>
            <p>Phone</p>
            <p>Status</p>
          </div>
          {receptionists.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No receptionist accounts yet</div>
          ) : (
            receptionists.map((item) => (
              <div key={item._id} className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1fr] gap-2 md:gap-0 px-5 py-4 border-b text-sm text-gray-600">
                <div className="font-medium text-gray-800 flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-primary" />
                  {item.name}
                </div>
                <p>{item.email}</p>
                <p>{item.phone}</p>
                <button onClick={() => changeReceptionistStatus(item._id)} className={`w-fit px-3 py-1 rounded-full text-xs font-semibold ${item.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {item.isActive ? "Active" : "Disabled"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistList;
