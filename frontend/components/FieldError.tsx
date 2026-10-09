export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={
        message
          ? "mt-2 text-[11px] leading-normal text-workspace-danger"
          : "sr-only"
      }
    >
      {message}
    </p>
  );
}
