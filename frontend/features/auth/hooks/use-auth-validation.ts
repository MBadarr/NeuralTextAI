"use client";

import { type ChangeEvent, useCallback, useState } from "react";
import {
  type AuthField,
  type AuthFormMode,
  type AuthValues,
  emptyAuthValues,
  validateAuthValues,
} from "@/features/auth/lib/auth-validation";

export function useAuthValidation(mode: AuthFormMode, initialEmail = "") {
  const [values, setValues] = useState<AuthValues>({
    ...emptyAuthValues,
    email: initialEmail,
  });
  const [touched, setTouched] = useState<Partial<Record<AuthField, boolean>>>(
    {},
  );
  const errors = validateAuthValues(mode, values);
  const setEmail = useCallback((value: string) => {
    setValues((current) => ({ ...current, email: value }));
  }, []);
  function setValue(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  function message(field: AuthField) {
    return touched[field] ? errors[field] || "" : "";
  }
  function bind(field: AuthField, id: string = field) {
    return {
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setValue(field, event.target.value);
        if (field === "password" || field === "confirmPassword")
          setTouched((current) => ({ ...current, [field]: true }));
      },
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
      "aria-invalid": Boolean(message(field)),
      "aria-describedby": `${id}-error`,
    };
  }
  function validate(fields: FormData) {
    const submitted = { ...emptyAuthValues };
    for (const field of Object.keys(submitted) as AuthField[])
      submitted[field] = String(fields.get(field) || "");
    setValues(submitted);
    const invalid = validateAuthValues(mode, submitted);
    setTouched({
      name: true,
      email: true,
      password: true,
      otp: true,
      confirmPassword: true,
    });
    return Object.values(invalid)[0] || "";
  }
  function clearPasswords() {
    setTouched({});
    setValues((current) => ({
      ...current,
      password: "",
      confirmPassword: "",
      otp: "",
    }));
  }
  return {
    values,
    setValue,
    setEmail,
    message,
    bind,
    validate,
    clearPasswords,
    resetFeedback: () => setTouched({}),
  };
}
