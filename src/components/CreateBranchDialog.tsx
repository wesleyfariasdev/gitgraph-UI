import { useEffect, useRef, useState, type FormEvent } from "react";
import { useKeydown } from "../hooks/useKeydown";
import { shortHash } from "../utils/format";

interface Props {
  startPoint: { hash: string; subject: string };
  onSubmit: (name: string, checkout: boolean) => void;
  onCancel: () => void;
}

export function CreateBranchDialog({ startPoint, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useKeydown((e) => e.key === "Escape" && onCancel());

  const trimmed = name.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed) onSubmit(trimmed, checkout);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span className="label">// new branch</span>
        </div>
        <div className="modal__body">
          <p className="modal__context">
            Starting from <span className="mono hl-cyan">{shortHash(startPoint.hash)}</span> {startPoint.subject}
          </p>
          <input
            ref={inputRef}
            className="input"
            placeholder="feature/my-branch"
            value={name}
            // Spaces are never valid in branch names; converting them is friendlier than an error.
            onChange={(e) => setName(e.target.value.replace(/\s/g, "-"))}
            spellCheck={false}
          />
          <label className="checkbox">
            <input type="checkbox" checked={checkout} onChange={(e) => setCheckout(e.target.checked)} />
            Switch to the new branch
          </label>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!trimmed}>
            Create branch
          </button>
        </div>
      </form>
    </div>
  );
}
