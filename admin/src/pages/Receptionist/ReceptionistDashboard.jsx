import React, { useContext, useEffect, useState } from "react";
import { CalendarCheck, Clock, CreditCard, DoorOpen, UserCheck } from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";

const ReceptionistDashboard = () => {
  const { rToken, dashData, getReceptionistDashboard } = useContext(ReceptionistContext);
  const { slotDateFormat, currency } = useContext(AppContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (rToken) {
        setLoading(true);
        await getReceptionistDashboard();
        setLoading(false);
      }
    };
    fetchData();
  }, [rToken]);

  const stats = dashData ? [
    { label: "Today", value: dashData.todayAppointments, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Checked In", value: dashData.checkedIn, icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "In Progress", value: dashData.inProgress, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Unpaid", value: dashData.unpaid, icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
  ] : [];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl animate-pulse space-y-5">
          <div className="h-8 bg-gray-200 rounded w-56"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-white border rounded-lg"></div>)}
          </div>
          <div className="h-80 bg-white border rounded-lg"></div>
        </div>
      </div>
    );
  }

  return dashData && (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-primary" />
            Reception Desk
          </h1>
          <p className="text-sm text-gray-600 mt-1 ml-8">Today's front desk queue, check-ins, and payments</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(({ label, value, icon, color, bg }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
              <div className={`${bg} ${color} p-3 rounded-lg`}>
                {React.createElement(icon, { className: "w-6 h-6" })}
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-700">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
            <p className="font-semibold text-gray-700">Latest Appointments</p>
            <p className="text-sm font-medium text-green-700">{currency} {dashData.paidToday} paid today</p>
          </div>
          {dashData.latestAppointments.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No appointments yet</div>
          ) : (
            <div className="divide-y">
              {dashData.latestAppointments.map((item) => (
                <div key={item._id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-800">{item.userData.name}</p>
                    <p className="text-sm text-gray-500">{item.docData.name} - {slotDateFormat(item.slotDate)}, {item.slotTime}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700">{item.appointmentStatus || (item.cancelled ? "Cancelled" : item.isCompleted ? "Finished" : "Booked")}</span>
                    <span className={`px-3 py-1 rounded-full ${item.paymentStatus === "Paid" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{item.paymentStatus || "Not Paid"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
