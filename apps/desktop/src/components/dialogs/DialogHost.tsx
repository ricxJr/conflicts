import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";

export function DialogHost() {
  const { t } = useTranslation();
  const dialog = useSession((s) => s.dialog);
  const setDialog = useSession((s) => s.setDialog);

  if (!dialog) return null;

  return (
    <div className="overlay">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
        <h2>{dialog.title}</h2>
        <p>{dialog.message}</p>
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={() => setDialog(null)} autoFocus>
            {dialog.kind === "info" ? t("dialog.close") : t("dialog.keepEditing")}
          </button>
          {dialog.extraActions?.map((a) => (
            <button
              key={a.label}
              className="btn-secondary"
              onClick={() => {
                setDialog(null);
                a.action();
              }}
            >
              {a.label}
            </button>
          ))}
          {dialog.onConfirm && (
            <button
              className="btn-danger"
              onClick={() => {
                const confirm = dialog.onConfirm;
                setDialog(null);
                confirm?.();
              }}
            >
              {dialog.confirmLabel ?? t("dialog.confirm")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
