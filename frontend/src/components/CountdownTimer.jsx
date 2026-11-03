import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";

const secondsUntil = (timestamp) => Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));

const formatClock = (seconds, localizeDigits) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return localizeDigits(`${mins}:${secs.toString().padStart(2, "0")}`);
};

/** Counts to a fixed moment, so a throttled background tab cannot make it run slow. */
const DeadlineClock = ({ expiresAt, onExpire }) => {
  const { localizeDigits } = useLanguage();
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;
    const tick = () => {
      const next = secondsUntil(expiresAt);
      setRemaining(next);
      if (next === 0 && !expired.current) {
        expired.current = true;
        onExpire?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return <span role="timer" dir="ltr" className="tabular-nums">{formatClock(remaining, localizeDigits)}</span>;
};

const ResendCountdown = ({ duration, onResend }) => {
  const { t, localizeDigits } = useLanguage();
  const [resendAt, setResendAt] = useState(() => Date.now() + duration * 1000);
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const tick = () => setRemaining(secondsUntil(resendAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [resendAt]);

  const handleResend = () => {
    setResendAt(Date.now() + duration * 1000);
    onResend();
  };

  return (
    <div className="text-start text-sm">
      {remaining === 0 ? (
        <button type="button" onClick={handleResend} className="text-primary underline cursor-pointer hover:text-primary/80">
          {t("Resend OTP")}
        </button>
      ) : (
        <p className="text-gray-500 font-medium" dir="ltr">{formatClock(remaining, localizeDigits)}</p>
      )}
    </div>
  );
};

/** Pass `expiresAt` for a hold countdown, or `duration` and `onResend` for the code-resend timer. */
const CountdownTimer = ({ duration = 120, onResend, expiresAt, onExpire }) =>
  expiresAt
    ? <DeadlineClock expiresAt={expiresAt} onExpire={onExpire} />
    : <ResendCountdown duration={duration} onResend={onResend} />;

export default CountdownTimer;
