// Tooltips that open on hover, keyboard focus and tap; Escape closes them; the
// trigger points at the tooltip with aria-describedby (set by useRole) so screen
// readers announce it.
//
// Floating UI's `refs` is a plain object of callbacks, not React refs, so the
// React compiler's refs rule does not apply to it.
/* eslint-disable react-hooks/refs */
import {
  FloatingPortal, autoUpdate, flip, offset, shift, useClick, useDismiss, useFocus, useFloating, useHover,
  useInteractions, useMergeRefs, useRole, safePolygon,
} from "@floating-ui/react";
import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode, type Ref } from "react";

// Only one tooltip is open at a time: opening one closes the last.
let closeCurrent: (() => void) | null = null;

export function Tooltip({ content, children, placement = "top", disabled = false }: { content: ReactNode; children: ReactElement; placement?: "top" | "bottom" | "right" | "left"; disabled?: boolean }) {
  const [state, setOpen] = useState(false);
  const open = state && !disabled;
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    if (closeCurrent && closeCurrent !== close) closeCurrent();
    closeCurrent = close;
    return () => {
      if (closeCurrent === close) closeCurrent = null;
    };
  }, [open]);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: 250, close: 80 }, handleClose: safePolygon(), mouseOnly: true }),
    useFocus(context, { visibleOnly: true }),
    // Tap opens it on touch screens; a second tap or a tap elsewhere closes it.
    useClick(context, { ignoreMouse: true, toggle: true }),
    useDismiss(context, { escapeKey: true, outsidePress: true }),
    useRole(context, { role: "tooltip" }),
  ]);
  const childProps = (isValidElement(children) ? children.props : {}) as Record<string, unknown>;
  const ref = useMergeRefs([refs.setReference, childProps.ref as Ref<Element> | undefined]);
  if (!isValidElement(children)) return children;
  return (
    <>
      {cloneElement(children, getReferenceProps({ ...childProps, ref }) as Record<string, unknown>)}
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} className="tooltip" style={floatingStyles} {...getFloatingProps()}>
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
