import { SignOutIcon, SlidersIcon } from './Icons';
import { AnchoredPopover, useAnchoredPopover } from './Popover';
import { displayNameFor, initialsFor, type Session } from '../../auth/session';

import { ButtonBase } from '../../design-system';
export function AccountMenu({
  session,
  onSignOut,
  onOpenSettings
}: {
  session: Session | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
}) {
  const anchor = useAnchoredPopover();
  const name = displayNameFor(session);

  return (
    <div className="account-menu">
      <ButtonBase
        ref={anchor.triggerRef}
        className="avatar"
        type="button"
        title={name}
        aria-label={name}
        aria-haspopup="menu"
        aria-expanded={anchor.open}
        onClick={anchor.toggle}
      >
        {session?.photoURL
          ? <img src={session.photoURL} alt="" />
          : initialsFor(session)}
      </ButtonBase>

      <AnchoredPopover
        anchor={anchor}
        width={214}
        className="account-popover"
        label="Account"
        title={name}
        role="menu"
      >
        <ButtonBase type="button" role="menuitem" onClick={() => { anchor.close(); onOpenSettings(); }}>
          <SlidersIcon size={18} />
          <span>App settings</span>
        </ButtonBase>
        <ButtonBase type="button" role="menuitem" onClick={() => { anchor.close(); onSignOut(); }}>
          <SignOutIcon size={18} />
          <span>Sign out</span>
        </ButtonBase>
      </AnchoredPopover>
    </div>
  );
}
