import { useEffect, useRef } from "react";
import Icon from "./Icon";
export default function Modal({ open, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open) dialog.showModal();
    else if (dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="expense-dialog"
      aria-labelledby="add-expense-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="Close add expense"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
