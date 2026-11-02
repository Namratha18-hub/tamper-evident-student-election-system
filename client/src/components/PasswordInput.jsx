import { useState } from "react";

// A password box with an eye button that shows or hides what is typed.
export default function PasswordInput({ label, value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <span className="pw-wrap">
        <input type={show ? "text" : "password"} value={value} onChange={onChange} {...rest} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          <i className={"fa-solid " + (show ? "fa-eye-slash" : "fa-eye")} aria-hidden="true" />
        </button>
      </span>
    </label>
  );
}