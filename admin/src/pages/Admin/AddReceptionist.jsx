import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Camera, Eye, EyeOff, RotateCcw, UserCog } from "lucide-react";
import { AdminContext } from "../../context/AdminContext";
import { emptyAddress, emptyEmergencyContact } from "../../utils/receptionistProfileForm";
import { useLanguage } from "../../i18n";
import BilingualField from "../../components/BilingualField";
import { AdminPage } from "../../components/admin/AdminPage";
import { useFilePreview } from "../../components/admin/SiteContentForm";
import { Button, Card, CardBody, Field, Input, notify, Textarea } from "../../components/ui";
import { bilingualIsEmpty, bilingualPayload, emptyBilingual } from "../../utils/bilingualValue";

const addressLabels = {
  line1: "Address line 1",
  line2: "Address line 2",
  city: "City",
  state: "State / region",
  postalCode: "Postal code",
  country: "Country",
};

const AddReceptionist = () => {
  const { backendUrl, aToken, getReceptionists, translatePreview } = useContext(AdminContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState(emptyBilingual);
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const photoPreview = useFilePreview(photoFile);

  const setAddressField = (key, value) => setAddress((prev) => ({ ...prev, [key]: value }));
  const setEmergencyField = (key, value) => setEmergencyContact((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setName(emptyBilingual());
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
  };

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.error(t("Please choose an image file"));
      return;
    }
    setPhotoFile(file);
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (bilingualIsEmpty(name)) return;
    setIsLoading(true);

    try {
      const fd = new FormData();
      fd.append("nameI18n", JSON.stringify(bilingualPayload(name)));
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
        notify.success(t(data.message));
        await getReceptionists();
        navigate("/receptionist-list");
      } else {
        notify.error(t(data.message));
      }
    } catch (error) {
      notify.error(t(error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminPage
      icon={UserCog}
      width="max-w-4xl"
      title={t("Add Receptionist")}
      description={t("Create staff accounts with optional photo, address, emergency contact, and HR notes.")}
      actions={
        <Button as={Link} to="/receptionist-list" variant="secondary" size="sm" leadingIcon={<ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />}>
          {t("Back to receptionists")}
        </Button>
      }
    >
      <form onSubmit={onSubmitHandler}>
        <Card variant="flat">
          <CardBody className="space-y-6">
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex flex-col items-center">
                <div className="size-28 overflow-hidden rounded-full border-2 border-dashed border-field bg-surface-sunken">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center px-2 text-center text-caption text-ink-3">{t("No photo")}</div>
                  )}
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-body-sm font-semibold text-brand">
                  <Camera aria-hidden="true" className="size-4" />
                  {t("Profile photo (optional)")}
                  <input type="file" accept="image/*" className="sr-only" onChange={onPickPhoto} />
                </label>
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <BilingualField className="sm:col-span-2" label={t("Full name")} kind="name" value={name} onChange={setName} translate={translatePreview} required />
                <Field label={t("Phone")} required>
                  <Input dir="ltr" style={{ textAlign: "start" }} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </Field>
                <Field label={t("Email")} required>
                  <Input dir="ltr" style={{ textAlign: "start" }} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
                </Field>
                <div className="relative">
                  <Field label={t("Password")} required>
                    <Input className="pe-11" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" required />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                    className="absolute bottom-1 end-1 flex size-9 cursor-pointer items-center justify-center text-ink-3 hover:text-ink"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
                  </button>
                </div>
                <Field label={t("Job title")}>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </Field>
                <Field label={t("Department")}>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
                </Field>
                <Field label={t("Employee ID")} hint={t("Optional internal ID")}>
                  <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
                </Field>
              </div>
            </div>

            <Field label={t("Bio")} hint={t("Optional short introduction")}>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
            </Field>

            <Field label={t("Admin / HR notes (internal)")}>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
            </Field>

            <section>
              <h2 className="mb-3 text-subtitle font-semibold text-ink">{t("Address")}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(addressLabels).map(([key, label]) => (
                  <Field key={key} label={t(label)} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}>
                    <Input value={address[key]} onChange={(e) => setAddressField(key, e.target.value)} />
                  </Field>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-subtitle font-semibold text-ink">{t("Emergency contact")}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={t("Name")}>
                  <Input value={emergencyContact.name} onChange={(e) => setEmergencyField("name", e.target.value)} />
                </Field>
                <Field label={t("Phone")}>
                  <Input dir="ltr" style={{ textAlign: "start" }} value={emergencyContact.phone} onChange={(e) => setEmergencyField("phone", e.target.value)} />
                </Field>
                <Field label={t("Relationship")}>
                  <Input value={emergencyContact.relationship} onChange={(e) => setEmergencyField("relationship", e.target.value)} />
                </Field>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" loading={isLoading} leadingIcon={<UserCog aria-hidden="true" className="size-4" />}>
                {t("Create receptionist")}
              </Button>
              <Button variant="secondary" onClick={resetForm} leadingIcon={<RotateCcw aria-hidden="true" className="size-4" />}>
                {t("Reset")}
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </AdminPage>
  );
};

export default AddReceptionist;
