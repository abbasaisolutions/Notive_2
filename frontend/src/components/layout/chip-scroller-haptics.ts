const CHIP_SCROLLER_INTERACTIVE_SELECTOR = 'button, a, [role="radio"], [role="tab"]';

export function isChipScrollerInteraction(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    const scroller = target.closest('.chip-scroller');
    if (!scroller) return false;

    const interactive = target.closest(CHIP_SCROLLER_INTERACTIVE_SELECTOR);
    if (!interactive || !scroller.contains(interactive)) return false;
    if (interactive.getAttribute('aria-disabled') === 'true') return false;
    if (interactive instanceof HTMLButtonElement && interactive.disabled) return false;

    return true;
}
